import crypto from "node:crypto";

const CANONICAL_CONTENT = "ScheduleATour";

export class VthScheduleATourRepairService {
  constructor({ database, bitlyService, urlService, fingerprintService }) {
    this.database = database;
    this.bitlyService = bitlyService;
    this.urlService = urlService;
    this.fingerprintService = fingerprintService;
  }

  async plan() {
    const rows = await this.database.allAsync("SELECT * FROM requests WHERE archived_at IS NULL AND normalized_payload IS NOT NULL ORDER BY id");
    const grouped = new Map();
    for (const row of rows) {
      const payload = parseObject(row.normalized_payload);
      if (!isTarget(payload)) continue;
      const key = String(row.fingerprint || `request:${row.id}`);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ row, payload });
    }
    const changes = [];
    const conflicts = [];
    for (const [oldFingerprint, matches] of grouped) {
      const first = matches[0];
      const generated = oldFingerprint.startsWith("request:") ? null
        : await this.database.getAsync("SELECT * FROM generated_links WHERE fingerprint=:fingerprint LIMIT 1", { fingerprint: oldFingerprint });
      const corrected = { ...first.payload, utm_content: CANONICAL_CONTENT };
      corrected.final_long_url = this.urlService.appendUtms(first.row.final_long_url || corrected.final_long_url || corrected.normalized_destination_url, {
        utm_source: corrected.utm_source, utm_medium: corrected.utm_medium, utm_campaign: corrected.utm_campaign,
        utm_term: corrected.utm_term, utm_content: corrected.utm_content
      });
      const normalized = normalizedShape(corrected, generated);
      const fingerprint = this.fingerprintService.generate(normalized);
      const utmIdentityKey = this.fingerprintService.generateUtmIdentity(normalized);
      const shortUrl = String(first.row.short_url || generated?.short_url || "").trim();
      const qrUrl = String(first.row.qr_url || generated?.qr_url || "").trim();
      const existing = await this.database.getAsync("SELECT id FROM requests WHERE fingerprint=:fingerprint AND archived_at IS NULL LIMIT 1", { fingerprint });
      if (existing && fingerprint !== oldFingerprint) {
        conflicts.push({ old_fingerprint: oldFingerprint, new_fingerprint: fingerprint, reason: "The corrected VTH UTM already exists." });
        continue;
      }
      if (qrUrl && !shortUrl) {
        conflicts.push({ old_fingerprint: oldFingerprint, new_fingerprint: fingerprint, reason: "A direct QR would become stale; upload a replacement QR before correcting this record." });
        continue;
      }
      changes.push({
        old_fingerprint: oldFingerprint, fingerprint, utm_identity_key: utmIdentityKey,
        request_ids: matches.map(({ row }) => Number(row.id)), normalized_payload: corrected,
        old_long_url: String(first.row.final_long_url || ""), final_long_url: corrected.final_long_url,
        short_url: shortUrl, bitly_id: first.row.bitly_id || generated?.bitly_id || null
      });
    }
    const plan = { version: 1, created_at: new Date().toISOString(), changes, conflicts };
    plan.signature = sign(plan);
    return plan;
  }

  async apply(plan) {
    if (!plan || plan.signature !== sign(plan)) throw new Error("The VTH ScheduleATour repair plan is invalid or was modified.");
    const current = await this.plan();
    if (current.signature !== plan.signature) throw new Error("Stored links changed after the dry run. Generate a new plan.");
    const report = { corrected: [], bitly_failures: [], conflicts: plan.conflicts };
    for (const change of plan.changes) {
      let repointed = false;
      try {
        if (change.short_url) {
          await this.bitlyService.updateDestination({ bitlyId: change.bitly_id, shortUrl: change.short_url, longUrl: change.final_long_url });
          repointed = true;
        }
      } catch (error) {
        report.bitly_failures.push({ short_url: change.short_url, message: error.message, code: error.code ?? null, status_code: error.statusCode ?? null });
        continue;
      }
      try {
        await this.database.withTransaction(async (database) => {
          const timestamp = new Date().toISOString();
          for (const id of change.request_ids) {
            await database.runAsync("UPDATE requests SET normalized_payload=:payload, fingerprint=:fingerprint, utm_identity_key=:identity, final_long_url=:url, updated_at=:updated_at WHERE id=:id AND archived_at IS NULL", {
              payload: JSON.stringify(change.normalized_payload), fingerprint: change.fingerprint, identity: change.utm_identity_key,
              url: change.final_long_url, updated_at: timestamp, id
            });
          }
          await database.runAsync("UPDATE generated_links SET fingerprint=:fingerprint, utm_content=:content, final_long_url=:url, updated_at=:updated_at WHERE fingerprint=:old_fingerprint", {
            fingerprint: change.fingerprint, content: CANONICAL_CONTENT, url: change.final_long_url,
            updated_at: timestamp, old_fingerprint: change.old_fingerprint
          });
          await database.runAsync("INSERT INTO link_audit_events (fingerprint, request_id, action, actor_user_id, actor_user_name, summary, created_at) VALUES (:fingerprint,:request_id,'vth_schedule_a_tour_repaired','maintenance:vth-schedule-a-tour','VTH ScheduleATour repair',:summary,:created_at)", {
            fingerprint: change.fingerprint, request_id: change.request_ids[0] ?? null,
            summary: `utm_content: ScheduleAtour -> ${CANONICAL_CONTENT}; fingerprint: ${change.old_fingerprint} -> ${change.fingerprint}`,
            created_at: timestamp
          });
        });
        report.corrected.push({ old_fingerprint: change.old_fingerprint, fingerprint: change.fingerprint, request_ids: change.request_ids, final_long_url: change.final_long_url });
      } catch (error) {
        if (repointed) await this.bitlyService.updateDestination({ bitlyId: change.bitly_id, shortUrl: change.short_url, longUrl: change.old_long_url }).catch(() => {});
        throw error;
      }
    }
    return report;
  }
}

function isTarget(payload) {
  const destination = safeUrl(payload.normalized_destination_url || payload.destination_url || payload.final_long_url);
  return String(payload.client ?? "").trim().toLowerCase() === "vth"
    && destination?.hostname.toLowerCase().replace(/^www\./u, "") === "technologyhillnh.com"
    && destination.pathname === "/"
    && compact(payload.utm_source) === "spectrummonthlyholidayshopper"
    && compact(payload.utm_medium) === "qrcode"
    && compact(payload.utm_campaign ?? payload.canonical_campaign) === "ads"
    && compact(payload.utm_term) === "landingpage"
    && compact(payload.utm_content) === "scheduleatour"
    && String(payload.utm_content ?? "").trim() !== CANONICAL_CONTENT;
}

function normalizedShape(payload, generated) {
  return {
    client: "vth", channel: payload.channel ?? generated?.channel ?? "", assetType: payload.asset_type ?? generated?.asset_type ?? "",
    normalizedDestinationUrl: payload.normalized_destination_url ?? generated?.normalized_destination_url ?? "",
    utmSource: payload.utm_source ?? "", utmMedium: payload.utm_medium ?? "", utmCampaign: payload.utm_campaign ?? payload.canonical_campaign ?? "",
    canonicalCampaign: payload.canonical_campaign ?? payload.utm_campaign ?? "", utmTerm: payload.utm_term ?? "", utmContent: CANONICAL_CONTENT
  };
}

function parseObject(value) { try { return typeof value === "string" ? JSON.parse(value) ?? {} : value ?? {}; } catch { return {}; } }
function safeUrl(value) { try { return new URL(String(value ?? "").trim()); } catch { return null; } }
function compact(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/gu, ""); }
function sign(plan) { const copy = { ...plan }; delete copy.signature; delete copy.created_at; return crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex"); }

