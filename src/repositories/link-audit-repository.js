export class LinkAuditRepository {
  constructor(database) {
    this.database = database;
  }

  async record({
    fingerprint = null,
    requestId = null,
    action,
    actorUserId = null,
    actorUserName = null,
    summary = null,
    createdAt = new Date().toISOString()
  }) {
    await this.database.runAsync(`
      INSERT INTO link_audit_events (
        fingerprint,
        request_id,
        action,
        actor_user_id,
        actor_user_name,
        summary,
        created_at
      ) VALUES (
        :fingerprint,
        :request_id,
        :action,
        :actor_user_id,
        :actor_user_name,
        :summary,
        :created_at
      )
    `, {
      fingerprint: fingerprint || null,
      request_id: requestId ?? null,
      action,
      actor_user_id: actorUserId || null,
      actor_user_name: actorUserName || null,
      summary: summary || null,
      created_at: createdAt
    });
  }

  async listByFingerprint(fingerprint, limit = 50) {
    if (!fingerprint) {
      return [];
    }
    return await this.database.allAsync(`
      SELECT * FROM link_audit_events
      WHERE fingerprint = :fingerprint
      ORDER BY created_at DESC, id DESC
      LIMIT :limit
    `, { fingerprint, limit: Number(limit) });
  }
}
