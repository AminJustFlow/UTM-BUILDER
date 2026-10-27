import crypto from "node:crypto";

export class CicCatcRepairService {
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
      const corrected = { ...first.payload, utm_content: "CATC" };
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
        conflicts.push({ old_fingerprint: oldFingerprint, new_fingerprint: fingerprint, reason: "The corrected UTM already exists." });
        continue;
      }
      if (qrUrl && !shortUrl) {
        conflicts.push({ old_fingerprint: oldFingerprint, new_fingerprint: fingerprint, reason: "A direct QR would become stale." });
        continue;
      }
      changes.push({ old_fingerprint: oldFingerprint, fingerprint, utm_identity_key: utmIdentityKey,
        request_ids: matches.map(({ row }) => Number(row.id)), normalized_payload: corrected,
        old_long_url: String(first.row.final_long_url || ""), final_long_url: corrected.final_long_url,
        short_url: shortUrl, bitly_id: first.row.bitly_id || generated?.bitly_id || null });
    }
    const plan = { version: 1, created_at: new Date().toISOString(), changes, conflicts };
    plan.signature = sign(plan);
    return plan;
  }

  async apply(plan) {
    if (!plan || plan.signature !== sign(plan)) throw new Error("The CIC CATC repair plan is invalid or was modified.");
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
          await database.runAsync("UPDATE generated_links SET fingerprint=:fingerprint, utm_content='CATC', final_long_url=:url, updated_at=:updated_at WHERE fingerprint=:old_fingerprint", {
            fingerprint: change.fingerprint, url: change.final_long_url, updated_at: timestamp, old_fingerprint: change.old_fingerprint
          });
          await database.runAsync("INSERT INTO link_audit_events (fingerprint, request_id, action, actor_user_id, actor_user_name, summary, created_at) VALUES (:fingerprint,:request_id,'cic_catc_repaired','maintenance:cic-catc','CIC CATC repair',:summary,:created_at)", {
            fingerprint: change.fingerprint, request_id: change.request_ids[0] ?? null,
            summary: `utm_content: ChristmasAtTheCastle -> CATC; fingerprint: ${change.old_fingerprint} -> ${change.fingerprint}`,
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
  return String(payload.client ?? "").trim().toLowerCase() === "castle"
    && compact(payload.utm_campaign ?? payload.canonical_campaign) === "programsandevents"
    && compact(payload.utm_content) === "christmasatthecastle";
}
function normalizedShape(payload, generated) {
  return {
    client: "castle", channel: payload.channel ?? generated?.channel ?? "", assetType: payload.asset_type ?? generated?.asset_type ?? "",
    normalizedDestinationUrl: payload.normalized_destination_url ?? generated?.normalized_destination_url ?? "",
    utmSource: payload.utm_source ?? "", utmMedium: payload.utm_medium ?? "", utmCampaign: payload.utm_campaign ?? payload.canonical_campaign ?? "",
    canonicalCampaign: payload.canonical_campaign ?? payload.utm_campaign ?? "", utmTerm: payload.utm_term ?? "", utmContent: "CATC"
  };
}
function parseObject(value) { try { return typeof value === "string" ? JSON.parse(value) ?? {} : value ?? {}; } catch { return {}; } }
function compact(value) { return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/gu, ""); }
function sign(plan) { const copy = { ...plan }; delete copy.signature; delete copy.created_at; return crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex"); }

