export class ClientManagementRepository {
  constructor(database) { this.database = database; }

  async list() {
    return await this.database.allAsync("SELECT * FROM client_management ORDER BY client_key");
  }

  async upsert({ clientKey, displayName, purged = false, actor, timestamp }) {
    const existing = await this.database.getAsync(
      "SELECT client_key FROM client_management WHERE client_key = :client_key", { client_key: clientKey }
    );
    const params = {
      client_key: clientKey, display_name: displayName, purged: this.database.client === "postgres" ? Boolean(purged) : (purged ? 1 : 0),
      user_id: actor?.id ?? null, user_name: actor?.displayName ?? null,
      created_at: timestamp, updated_at: timestamp
    };
    if (existing) {
      await this.database.runAsync(`UPDATE client_management SET display_name=:display_name,
        purged=:purged, updated_by_user_id=:user_id, updated_by_name=:user_name,
        updated_at=:updated_at WHERE client_key=:client_key`, {
          client_key: params.client_key, display_name: params.display_name, purged: params.purged,
          user_id: params.user_id, user_name: params.user_name, updated_at: params.updated_at
        });
    } else {
      await this.database.runAsync(`INSERT INTO client_management
        (client_key,display_name,purged,updated_by_user_id,updated_by_name,created_at,updated_at)
        VALUES (:client_key,:display_name,:purged,:user_id,:user_name,:created_at,:updated_at)`, params);
    }
  }

  async purgeClient(clientKey, actor, displayName) {
    const clientExpression = this.database.client === "postgres"
      ? "LOWER(COALESCE(normalized_payload::jsonb ->> 'client',''))"
      : "LOWER(COALESCE(json_extract(normalized_payload, '$.client'),''))";
    const links = await this.database.allAsync(
      "SELECT fingerprint, qr_url, bitly_id FROM generated_links WHERE LOWER(client)=:client", { client: clientKey }
    );
    const requests = await this.database.allAsync(
      `SELECT id, fingerprint, qr_url, bitly_id FROM requests WHERE ${clientExpression}=:client`, { client: clientKey }
    );
    const requestIds = requests.map((row) => Number(row.id)).filter(Boolean);
    const fingerprints = [...new Set([...links, ...requests].map((row) => row.fingerprint).filter(Boolean))];
    await this.database.withTransaction(async (tx) => {
      for (const id of requestIds) await tx.runAsync("DELETE FROM link_audit_events WHERE request_id=:id", { id });
      for (const fingerprint of fingerprints) await tx.runAsync("DELETE FROM link_audit_events WHERE fingerprint=:fingerprint", { fingerprint });
      await tx.runAsync(`DELETE FROM requests WHERE ${clientExpression}=:client`, { client: clientKey });
      await tx.runAsync("DELETE FROM generated_links WHERE LOWER(client)=:client", { client: clientKey });
      await tx.runAsync("DELETE FROM client_guidance_audit_events WHERE client_key=:client", { client: clientKey });
      await tx.runAsync("DELETE FROM client_campaign_profiles WHERE client_key=:client", { client: clientKey });
      await tx.runAsync("DELETE FROM client_guidance_settings WHERE client_key=:client", { client: clientKey });
      await tx.runAsync("DELETE FROM utm_value_acknowledgements WHERE LOWER(field) LIKE :prefix", { prefix: `${clientKey}|%` });
      const timestamp = new Date().toISOString();
      const existing = await tx.getAsync("SELECT client_key FROM client_management WHERE client_key=:client", { client: clientKey });
      const params = { client: clientKey, display_name: displayName, purged: tx.client === "postgres" ? true : 1, user_id: actor?.id ?? null,
        user_name: actor?.displayName ?? null, created_at: timestamp, updated_at: timestamp };
      if (existing) await tx.runAsync("UPDATE client_management SET purged=:purged,updated_by_user_id=:user_id,updated_by_name=:user_name,updated_at=:updated_at WHERE client_key=:client", {
        client: params.client, purged: params.purged, user_id: params.user_id,
        user_name: params.user_name, updated_at: params.updated_at
      });
      else await tx.runAsync("INSERT INTO client_management (client_key,display_name,purged,updated_by_user_id,updated_by_name,created_at,updated_at) VALUES (:client,:display_name,:purged,:user_id,:user_name,:created_at,:updated_at)", params);
    });
    return { links, requests, fingerprints, requestCount: requests.length, linkCount: links.length };
  }
}
