const REVIEW_TYPES = new Set(["new_value", "new_pairing", "new_combination"]);

export class ConsistencyNotificationService {
  constructor({ settingsRepository, requestRepository, acknowledgementRepository, mailer, appBaseUrl, timezone, logger = null }) {
    this.settingsRepository = settingsRepository;
    this.requestRepository = requestRepository;
    this.acknowledgementRepository = acknowledgementRepository;
    this.mailer = mailer;
    this.appBaseUrl = String(appBaseUrl ?? "").replace(/\/+$/u, "");
    this.timezone = timezone;
    this.logger = logger;
  }

  async pendingItems() {
    const [requests, acknowledgements] = await Promise.all([
      this.requestRepository.listConsistencyHistoryAsync(),
      this.acknowledgementRepository.listAsync()
    ]);
    const acknowledged = new Set(acknowledgements.map((row) => `${lower(row.field)}:${lower(row.value)}`));
    const grouped = new Map();
    requests.forEach((row) => {
      const raw = object(row.raw_payload);
      const normalized = object(row.normalized_payload);
      (Array.isArray(raw.accepted_consistency_warnings) ? raw.accepted_consistency_warnings : []).forEach((warning) => {
        if (!REVIEW_TYPES.has(warning.type)) return;
        const fields = warning.fields ?? [];
        const storageField = warning.type === "new_pairing" ? `pair:${fields.join("+")}`
          : warning.type === "new_combination" ? "combination" : fields[0];
        const value = warning.type === "new_combination"
          ? fields.map((field) => `${field}=${warning.values?.[field] ?? ""}`).join("|")
          : fields.map((field) => warning.values?.[field] ?? "").join("|");
        const client = lower(normalized.client);
        if (!client || !value || acknowledged.has(`${client}|${lower(storageField)}:${lower(value)}`)) return;
        const key = `${client}|${storageField}|${value}`;
        const current = grouped.get(key) ?? {
          client, type: warning.type, fields, value, message: warning.message,
          count: 0, createdBy: row.source_user_name ?? "System", createdAt: row.created_at
        };
        current.count += 1;
        grouped.set(key, current);
      });
    });
    return [...grouped.values()].sort((a, b) => a.client.localeCompare(b.client) || a.type.localeCompare(b.type));
  }

  async runIfDue(now = new Date()) {
    const local = localParts(now, this.timezone);
    const settings = await this.settingsRepository.get();
    const completedToday = settings.lastRunLocalDate === local.date
      && (String(settings.lastResult).startsWith("sent:") || settings.lastResult === "no_pending_items");
    if (!settings.enabled || !settings.recipients.length || local.hour !== 6 || completedToday) {
      return { sent: false, reason: "not_due" };
    }
    try {
      const items = await this.pendingItems();
      if (!items.length) {
        await this.settingsRepository.recordRun({ localDate: local.date, result: "no_pending_items" });
        return { sent: false, reason: "no_pending_items" };
      }
      await this.mailer.send(buildMessage(settings.recipients, items, this.appBaseUrl));
      await this.settingsRepository.recordRun({ localDate: local.date, result: `sent:${items.length}` });
      return { sent: true, count: items.length };
    } catch (error) {
      this.logger?.error?.("Consistency review notification failed.", { error: error?.message ?? String(error) });
      await this.settingsRepository.recordRun({ localDate: local.date, result: "failed", error: error?.message ?? String(error) });
      return { sent: false, reason: "failed", error };
    }
  }
}

export class ConsistencyNotificationScheduler {
  constructor(service, { intervalMs = 60_000 } = {}) { this.service = service; this.intervalMs = intervalMs; this.timer = null; }
  start() {
    if (this.timer) return;
    this.service.runIfDue().catch(() => {});
    this.timer = setInterval(() => this.service.runIfDue().catch(() => {}), this.intervalMs);
    this.timer.unref?.();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

function buildMessage(recipients, items, appBaseUrl) {
  const reviewUrl = `${appBaseUrl}/utms`;
  const lines = items.map((item) => `- ${item.client}: ${item.value} — ${item.message} (${item.count})`);
  const rows = items.map((item) => `<tr><td>${escape(item.client)}</td><td>${escape(item.type.replace(/_/gu, " "))}</td><td>${escape(item.value)}</td><td>${escape(item.message)}</td><td>${item.count}</td><td>${escape(item.createdBy)}</td></tr>`).join("");
  return {
    to: recipients.join(", "),
    subject: `[JF UTM Builder] ${items.length} consistency item${items.length === 1 ? "" : "s"} to review`,
    text: `UTM consistency items require review:\n\n${lines.join("\n")}\n\nReview: ${reviewUrl}`,
    html: `<h2>UTM consistency review</h2><p>${items.length} item${items.length === 1 ? "" : "s"} require review.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Client</th><th>Type</th><th>Value</th><th>Warning</th><th>Uses</th><th>Created by</th></tr></thead><tbody>${rows}</tbody></table><p><a href="${escape(reviewUrl)}">Open the Link Library</a></p>`
  };
}

function localParts(date, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
function object(value) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; } }
function lower(value) { return String(value ?? "").trim().toLowerCase(); }
function escape(value) { return String(value ?? "").replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;"); }
