import crypto from "node:crypto";

const FIELDS = ["source", "medium", "campaign", "term", "content"];
const PAYLOAD_KEYS = Object.fromEntries(FIELDS.map((field) => [field, `utm_${field}`]));

export class HistoricalUtmCasingRepairService {
  constructor({ database, intelligenceService, bitlyService, urlService }) {
    this.database = database;
    this.intelligenceService = intelligenceService;
    this.bitlyService = bitlyService;
    this.urlService = urlService;
  }

  async plan() {
    await this.intelligenceService.refreshDataAsync?.({ force: true });
    const requests = await this.database.allAsync("SELECT * FROM requests WHERE normalized_payload IS NOT NULL AND status IN ('completed','completed_without_short_link','imported') ORDER BY id");
    const links = await this.database.allAsync("SELECT * FROM generated_links ORDER BY id");
    const activeFingerprints = new Set(requests.filter((row) => !row.archived_at).map((row) => String(row.fingerprint ?? "")).filter(Boolean));
    const archivedFingerprints = new Set(requests.filter((row) => row.archived_at).map((row) => String(row.fingerprint ?? "")).filter(Boolean));
    const changes = [];
    const archived = [];
    const unchanged = [];
    const directQrWarnings = [];
    const candidates = [
      ...requests.map((row) => ({ type: "request", row, archived: Boolean(row.archived_at) })),
      ...links.map((row) => ({
        type: "generated_link", row,
        archived: Boolean(row.fingerprint && archivedFingerprints.has(String(row.fingerprint)) && !activeFingerprints.has(String(row.fingerprint)))
      }))
    ];
    for (const candidate of candidates) {
      const change = this.buildChange(candidate);
      if (!change) {
        unchanged.push({ type: candidate.type, id: candidate.row.id });
        continue;
      }
      if (candidate.archived) {
        archived.push(change);
        continue;
      }
      changes.push(change);
      if (change.qrUrl && !change.shortUrl) {
        directQrWarnings.push({ type: change.type, id: change.id, fingerprint: change.fingerprint, qr_url: change.qrUrl });
      }
    }
    const conflicts = findShortUrlConflicts(candidates, changes);
    const plan = {
      version: 1,
      created_at: new Date().toISOString(),
      changes,
      unchanged_count: unchanged.length,
      unchanged_records: unchanged,
      archived_matches: archived,
      conflicts,
      direct_qr_warnings: directQrWarnings
    };
    plan.signature = signPlan(plan);
    return plan;
  }

  buildChange({ type, row }) {
    const payload = type === "request" ? parseObject(row.normalized_payload) : generatedPayload(row);
    const client = String(payload.client ?? row.client ?? "").trim().toLowerCase();
    const corrections = {};
    for (const field of FIELDS) {
      const key = PAYLOAD_KEYS[field];
      const current = String(payload[key] ?? "").trim();
      const authoritative = this.intelligenceService.authoritativeDisplayValue(field, current, client);
      if (authoritative && authoritative !== current && comparable(authoritative) === comparable(current)) {
        corrections[key] = { from: current, to: authoritative };
      }
    }
    if (!Object.keys(corrections).length) return null;
    const correctedPayload = { ...payload };
    for (const [key, correction] of Object.entries(corrections)) correctedPayload[key] = correction.to;
    if (corrections.utm_campaign) correctedPayload.canonical_campaign = corrections.utm_campaign.to;
    const currentUrl = String(row.final_long_url ?? payload.final_long_url ?? "").trim();
    const finalLongUrl = this.urlService.appendUtms(currentUrl, Object.fromEntries(
      FIELDS.map((field) => [PAYLOAD_KEYS[field], correctedPayload[PAYLOAD_KEYS[field]]])
    ));
    correctedPayload.final_long_url = finalLongUrl;
    return {
      type, id: Number(row.id), fingerprint: String(row.fingerprint ?? ""), client,
      corrections, final_long_url: finalLongUrl, normalized_payload: correctedPayload,
      shortUrl: String(row.short_url ?? "").trim(), bitlyId: row.bitly_id ?? null,
      qrUrl: String(row.qr_url ?? "").trim()
    };
  }

  async apply(plan) {
    if (!plan || plan.signature !== signPlan(plan)) throw new Error("The repair plan signature is invalid or the file was modified.");
    const current = await this.plan();
    if (current.signature !== plan.signature) throw new Error("Stored links changed after the dry run. Generate a new dry-run plan.");
    const conflictKeys = new Set(plan.conflicts.flatMap((item) => item.change_keys));
    const report = { corrected: [], unchanged_count: plan.unchanged_count, unchanged_records: plan.unchanged_records, archived_matches: plan.archived_matches, conflicts: plan.conflicts, bitly_failures: [], direct_qr_warnings: plan.direct_qr_warnings };
    const bitlyTargets = uniqueBitlyTargets(plan.changes.filter((change) => !conflictKeys.has(changeKey(change))));
    const failedShortUrls = new Set();
    for (const target of bitlyTargets) {
      try {
        await this.bitlyService.updateDestination(target);
      } catch (error) {
        failedShortUrls.add(normalizeShort(target.shortUrl));
        report.bitly_failures.push({ short_url: target.shortUrl, message: error.message, code: error.code ?? null });
      }
    }
    for (const change of plan.changes) {
      if (conflictKeys.has(changeKey(change)) || (change.shortUrl && failedShortUrls.has(normalizeShort(change.shortUrl)))) continue;
      await this.database.withTransaction(async (database) => {
        const timestamp = new Date().toISOString();
        if (change.type === "request") {
          await database.runAsync(`UPDATE requests SET normalized_payload=:payload, final_long_url=:url, updated_at=:updated_at WHERE id=:id AND archived_at IS NULL`, {
            payload: JSON.stringify(change.normalized_payload), url: change.final_long_url, updated_at: timestamp, id: change.id
          });
        } else {
          const values = Object.fromEntries(FIELDS.map((field) => [`utm_${field}`, change.normalized_payload[`utm_${field}`] ?? ""]));
          await database.runAsync(`UPDATE generated_links SET utm_source=:utm_source, utm_medium=:utm_medium, utm_campaign=:utm_campaign, canonical_campaign=:utm_campaign, utm_term=:utm_term, utm_content=:utm_content, final_long_url=:url, updated_at=:updated_at WHERE id=:id`, {
            ...values, url: change.final_long_url, updated_at: timestamp, id: change.id
          });
        }
        await database.runAsync(`INSERT INTO link_audit_events (fingerprint, request_id, action, actor_user_id, actor_user_name, summary, created_at) VALUES (:fingerprint, :request_id, 'utm_casing_repaired', 'maintenance:utm-casing', 'UTM casing repair', :summary, :created_at)`, {
          fingerprint: change.fingerprint || null, request_id: change.type === "request" ? change.id : null,
          summary: Object.entries(change.corrections).map(([field, value]) => `${field}: ${value.from} -> ${value.to}`).join("; "), created_at: timestamp
        });
      });
      report.corrected.push({ type: change.type, id: change.id, fingerprint: change.fingerprint, corrections: change.corrections, final_long_url: change.final_long_url });
    }
    return report;
  }
}

function generatedPayload(row) {
  return { client: row.client, normalized_destination_url: row.normalized_destination_url, canonical_campaign: row.canonical_campaign,
    utm_source: row.utm_source, utm_medium: row.utm_medium, utm_campaign: row.utm_campaign,
    utm_term: row.utm_term, utm_content: row.utm_content, final_long_url: row.final_long_url };
}
function parseObject(value) { if (value && typeof value === "object") return value; try { return JSON.parse(value) ?? {}; } catch { return {}; } }
function comparable(value) { return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/gu, ""); }
function normalizeShort(value) { return String(value ?? "").trim().toLowerCase().replace(/\/+$/gu, ""); }
function changeKey(change) { return `${change.type}:${change.id}`; }
function signPlan(plan) { const copy = { ...plan }; delete copy.signature; delete copy.created_at; return crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex"); }
function uniqueBitlyTargets(changes) {
  const targets = new Map();
  for (const change of changes) if (change.shortUrl) targets.set(normalizeShort(change.shortUrl), { shortUrl: change.shortUrl, bitlyId: change.bitlyId, longUrl: change.final_long_url });
  return [...targets.values()];
}
function findShortUrlConflicts(candidates, changes) {
  const changed = new Map(changes.map((change) => [changeKey(change), change]));
  const groups = new Map();
  for (const candidate of candidates) {
    const keyForChange = `${candidate.type}:${candidate.row.id}`;
    const change = changed.get(keyForChange);
    const shortUrl = String(candidate.row.short_url ?? "").trim();
    if (!shortUrl) continue;
    const key = normalizeShort(shortUrl);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      key: keyForChange,
      destination: change?.final_long_url ?? String(candidate.row.final_long_url ?? ""),
      changed: Boolean(change)
    });
  }
  return [...groups.entries()].filter(([, items]) => items.some((item) => item.changed) && new Set(items.map((item) => item.destination)).size > 1)
    .map(([shortUrl, items]) => ({ short_url: shortUrl, destinations: [...new Set(items.map((item) => item.destination))], change_keys: items.filter((item) => item.changed).map((item) => item.key) }));
}

export { signPlan };
