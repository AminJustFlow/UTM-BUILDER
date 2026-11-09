import crypto from "node:crypto";

const TARGET_SHORT_URL = "https://bit.ly/4Akgw2f";

export class RadLinkMigrationService {
  constructor({ database, fingerprintService }) {
    this.database = database;
    this.fingerprintService = fingerprintService;
  }

  async plan() {
    const rows = await this.database.allAsync("SELECT * FROM requests WHERE archived_at IS NULL AND normalized_payload IS NOT NULL ORDER BY id");
    const matches = rows.map((row) => ({ row, payload: parseObject(row.normalized_payload) })).filter(({ payload }) => isTargetIdentity(payload));
    const changes = [];
    const conflicts = [];
    const groups = new Map();
    for (const match of matches) {
      const key = String(match.row.fingerprint || `request:${match.row.id}`);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(match);
    }
    for (const [oldFingerprint, activeMatches] of groups) {
      if (oldFingerprint.startsWith("request:")) {
        conflicts.push({ old_fingerprint: oldFingerprint, reason: "The target request has no fingerprint." });
        continue;
      }
      const generated = await this.database.getAsync("SELECT * FROM generated_links WHERE fingerprint=:fingerprint LIMIT 1", { fingerprint: oldFingerprint });
      if (!generated) {
        conflicts.push({ old_fingerprint: oldFingerprint, reason: "The generated link record is missing." });
        continue;
      }
      const shortUrl = String(generated.short_url || activeMatches[0].row.short_url || "").trim().replace(/\/$/u, "");
      if (shortUrl.toLowerCase() !== TARGET_SHORT_URL.toLowerCase()) continue;
      const corrected = { ...activeMatches[0].payload, client: "rad", client_display_name: "RAD" };
      const fingerprint = this.fingerprintService.generate(normalizedShape(corrected, generated));
      const requestConflict = await this.database.getAsync("SELECT id FROM requests WHERE fingerprint=:fingerprint AND archived_at IS NULL LIMIT 1", { fingerprint });
      const generatedConflict = await this.database.getAsync("SELECT id FROM generated_links WHERE fingerprint=:fingerprint LIMIT 1", { fingerprint });
      if ((requestConflict || generatedConflict) && fingerprint !== oldFingerprint) {
        conflicts.push({ old_fingerprint: oldFingerprint, new_fingerprint: fingerprint, reason: "The RAD identity already exists." });
        continue;
      }
      const related = await this.database.allAsync("SELECT id, normalized_payload, parsed_payload FROM requests WHERE fingerprint=:fingerprint ORDER BY id", { fingerprint: oldFingerprint });
      changes.push({
        old_fingerprint: oldFingerprint,
        fingerprint,
        request_ids: related.map((item) => Number(item.id)),
        active_request_ids: activeMatches.map(({ row }) => Number(row.id)),
        short_url: shortUrl,
        request_payloads: related.map((item) => ({
          id: Number(item.id),
          normalized_payload: withRadIdentity(item.normalized_payload),
          parsed_payload: withRadIdentity(item.parsed_payload)
        }))
      });
    }
    const plan = { version: 1, target_short_url: TARGET_SHORT_URL, created_at: new Date().toISOString(), changes, conflicts };
    plan.signature = sign(plan);
    return plan;
  }

  async apply(plan) {
    if (!plan || plan.signature !== sign(plan)) throw new Error("The RAD migration plan is invalid or was modified.");
    const current = await this.plan();
    if (current.signature !== plan.signature) throw new Error("Stored links changed after the dry run. Generate a new plan.");
    const report = { moved: [], conflicts: plan.conflicts };
    for (const change of plan.changes) {
      await this.database.withTransaction(async (database) => {
        const timestamp = new Date().toISOString();
        for (const request of change.request_payloads) {
          await database.runAsync("UPDATE requests SET normalized_payload=:normalized, parsed_payload=:parsed, fingerprint=:fingerprint, updated_at=:updated_at WHERE id=:id AND fingerprint=:old_fingerprint", {
            normalized: request.normalized_payload, parsed: request.parsed_payload, fingerprint: change.fingerprint,
            updated_at: timestamp, id: request.id, old_fingerprint: change.old_fingerprint
          });
        }
        await database.runAsync("UPDATE generated_links SET fingerprint=:fingerprint, client='rad', updated_at=:updated_at WHERE fingerprint=:old_fingerprint", {
          fingerprint: change.fingerprint, updated_at: timestamp, old_fingerprint: change.old_fingerprint
        });
        await database.runAsync("UPDATE link_audit_events SET fingerprint=:fingerprint WHERE fingerprint=:old_fingerprint", {
          fingerprint: change.fingerprint, old_fingerprint: change.old_fingerprint
        });
        await database.runAsync("INSERT INTO link_audit_events (fingerprint,request_id,action,actor_user_id,actor_user_name,summary,created_at) VALUES (:fingerprint,:request_id,'client_reassigned','maintenance:rad-link','RAD link migration',:summary,:created_at)", {
          fingerprint: change.fingerprint, request_id: change.active_request_ids[0] ?? change.request_ids[0] ?? null,
          summary: `client: jf -> rad; display name: JF -> RAD; Bitly preserved: ${change.short_url || "Not set"}`,
          created_at: timestamp
        });
      });
      report.moved.push({ old_fingerprint: change.old_fingerprint, fingerprint: change.fingerprint, request_ids: change.request_ids, short_url: change.short_url });
    }
    return report;
  }
}

function isTargetIdentity(payload) {
  let host = "";
  try { host = new URL(payload.normalized_destination_url || row.final_long_url || "").hostname.toLowerCase().replace(/^www\./u, ""); } catch {}
  return compact(payload.client) === "jf"
    && host === "redarrowdiner.com"
    && compact(payload.utm_source) === "constantcontact"
    && compact(payload.utm_medium) === "email"
    && compact(payload.utm_campaign || payload.canonical_campaign) === "newsandpromos"
    && compact(payload.utm_term) === "promos"
    && compact(payload.utm_content) === "learn";
}

function normalizedShape(payload, generated) {
  return {
    client: "rad", channel: payload.channel ?? generated.channel ?? "", assetType: payload.asset_type ?? generated.asset_type ?? "",
    normalizedDestinationUrl: payload.normalized_destination_url ?? generated.normalized_destination_url ?? "",
    utmSource: payload.utm_source ?? generated.utm_source ?? "", utmMedium: payload.utm_medium ?? generated.utm_medium ?? "",
    utmCampaign: payload.utm_campaign ?? payload.canonical_campaign ?? generated.utm_campaign ?? "",
    canonicalCampaign: payload.canonical_campaign ?? payload.utm_campaign ?? generated.canonical_campaign ?? "",
    utmTerm: payload.utm_term ?? generated.utm_term ?? "", utmContent: payload.utm_content ?? generated.utm_content ?? ""
  };
}

function withRadIdentity(value) {
  if (value == null || value === "") return value;
  const payload = parseObject(value);
  return JSON.stringify({ ...payload, client: "rad", client_display_name: "RAD" });
}
function parseObject(value) { try { return typeof value === "string" ? JSON.parse(value) ?? {} : value ?? {}; } catch { return {}; } }
function compact(value) { return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/gu, ""); }
function sign(plan) { const copy = { ...plan }; delete copy.signature; delete copy.created_at; return crypto.createHash("sha256").update(JSON.stringify(copy)).digest("hex"); }
