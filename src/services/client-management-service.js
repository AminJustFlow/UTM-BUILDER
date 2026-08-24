import fs from "node:fs/promises";
import path from "node:path";

export class ClientManagementService {
  constructor({ repository, rulesService, utmIntelligenceService, qrStoragePath }) {
    Object.assign(this, { repository, rulesService, utmIntelligenceService, qrStoragePath });
  }
  async initialize() {
    const rows = await this.repository.list();
    this.rulesService.setClientDisplayNames(Object.fromEntries(rows.filter((r) => !asBoolean(r.purged) && r.display_name).map((r) => [r.client_key, r.display_name])));
    this.utmIntelligenceService.setPurgedClients(rows.filter((r) => asBoolean(r.purged)).map((r) => r.client_key));
  }
  async list() {
    const settings = new Map((await this.repository.list()).map((r) => [r.client_key, r]));
    return this.utmIntelligenceService.approvedClients().map((key) => ({ key, displayName: this.rulesService.getClientDisplayName(key), purged: asBoolean(settings.get(key)?.purged) })).filter((c) => !c.purged);
  }
  async rename(clientKey, displayName, actor) {
    const key = String(clientKey ?? "").trim().toLowerCase();
    const name = String(displayName ?? "").trim();
    if (!this.rulesService.clients().includes(key)) return { ok: false, message: "Select a valid client." };
    if (!name || name.length > 100) return { ok: false, message: "Visible client name must be between 1 and 100 characters." };
    await this.repository.upsert({ clientKey: key, displayName: name, actor, timestamp: new Date().toISOString() });
    this.rulesService.setClientDisplayName(key, name);
    return { ok: true, message: `Client display name updated to “${name}”.` };
  }
  async purge(clientKey, confirmation, actor) {
    const key = String(clientKey ?? "").trim().toLowerCase();
    if (!this.rulesService.clients().includes(key)) return { ok: false, message: "Select a valid client." };
    if (String(confirmation ?? "").trim() !== `PURGE ${key}`) return { ok: false, message: `Type PURGE ${key} exactly to confirm.` };
    const name = this.rulesService.getClientDisplayName(key);
    const result = await this.repository.purgeClient(key, actor, name);
    let failures = 0;
    for (const fingerprint of result.fingerprints) {
      const safe = String(fingerprint).replace(/[^a-zA-Z0-9_-]/gu, "");
      if (!safe) continue;
      try { await fs.rm(path.join(this.qrStoragePath, safe), { recursive: true, force: true }); } catch { failures += 1; }
    }
    this.utmIntelligenceService.addPurgedClient(key);
    return { ok: failures === 0, purged: true, message: failures
      ? `${name} data was purged, but ${failures} stored QR folder(s) could not be removed.`
      : `${name} was permanently purged, including ${result.requestCount} requests, ${result.linkCount} links, standards, history, dictionary values, and stored QR assets.` };
  }
}
function asBoolean(value) { return value === true || value === 1 || value === "1"; }
