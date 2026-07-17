export class ClientCampaignStandardsRepository {
  constructor(database) {
    this.database = database;
  }

  async getSettings(clientKey) {
    return await this.database.getAsync(
      "SELECT * FROM client_guidance_settings WHERE client_key = :client_key LIMIT 1",
      { client_key: clientKey }
    ) ?? null;
  }

  async upsertSettings(payload) {
    const existing = await this.getSettings(payload.clientKey);
    if (existing) {
      await this.database.runAsync(`
        UPDATE client_guidance_settings
        SET summary = :summary, fields_json = :fields_json, managed = 1, updated_by_user_id = :user_id,
            updated_by_name = :user_name, updated_at = :updated_at
        WHERE client_key = :client_key
      `, settingsParams(payload));
      return;
    }
    await this.database.runAsync(`
      INSERT INTO client_guidance_settings (
        client_key, summary, fields_json, managed, updated_by_user_id, updated_by_name, created_at, updated_at
      ) VALUES (
        :client_key, :summary, :fields_json, 1, :user_id, :user_name, :created_at, :updated_at
      )
    `, settingsParams(payload));
  }

  async listProfiles(clientKey, { activeOnly = false } = {}) {
    return await this.database.allAsync(`
      SELECT * FROM client_campaign_profiles
      WHERE client_key = :client_key${activeOnly ? " AND is_active = 1" : ""}
      ORDER BY priority ASC, sort_order ASC, display_name ASC, campaign ASC, id ASC
    `, { client_key: clientKey });
  }

  async findProfileById(id) {
    return await this.database.getAsync(
      "SELECT * FROM client_campaign_profiles WHERE id = :id LIMIT 1",
      { id }
    ) ?? null;
  }

  async createProfile(payload) {
    const params = profileParams(payload);
    const returning = this.database.client === "postgres" ? " RETURNING id" : "";
    const result = await this.database.runAsync(`
      INSERT INTO client_campaign_profiles (
        client_key, priority, sort_order, campaign, campaign_key, display_name,
        aliases_json, guideline, source, medium,
        term_label, term_help, term_placeholder,
        content_label, content_help, content_placeholder,
        is_active, updated_by_user_id, updated_by_name, created_at, updated_at
      ) VALUES (
        :client_key, :priority, :sort_order, :campaign, :campaign_key, :display_name,
        :aliases_json, :guideline, :source, :medium,
        :term_label, :term_help, :term_placeholder,
        :content_label, :content_help, :content_placeholder,
        :is_active, :user_id, :user_name, :created_at, :updated_at
      )${returning}
    `, params);
    return Number(result.lastInsertRowid);
  }

  async updateProfile(id, payload) {
    const { client_key: _clientKey, created_at: _createdAt, ...params } = profileParams(payload);
    await this.database.runAsync(`
      UPDATE client_campaign_profiles
      SET priority = :priority, sort_order = :sort_order, campaign = :campaign,
          campaign_key = :campaign_key, display_name = :display_name,
          aliases_json = :aliases_json, guideline = :guideline,
          source = :source, medium = :medium,
          term_label = :term_label, term_help = :term_help, term_placeholder = :term_placeholder,
          content_label = :content_label, content_help = :content_help,
          content_placeholder = :content_placeholder, is_active = :is_active,
          updated_by_user_id = :user_id, updated_by_name = :user_name, updated_at = :updated_at
      WHERE id = :id
    `, { id, ...params });
  }

  async setProfileActive(id, isActive, actor, timestamp) {
    await this.database.runAsync(`
      UPDATE client_campaign_profiles
      SET is_active = :is_active, updated_by_user_id = :user_id,
          updated_by_name = :user_name, updated_at = :updated_at
      WHERE id = :id
    `, {
      id,
      is_active: isActive ? 1 : 0,
      user_id: actor?.id ?? null,
      user_name: actor?.displayName ?? null,
      updated_at: timestamp
    });
  }

  async deleteProfile(id) {
    const result = await this.database.runAsync(
      "DELETE FROM client_campaign_profiles WHERE id = :id",
      { id }
    );
    return Number(result.changes ?? 0);
  }

  async recordAudit(payload) {
    await this.database.runAsync(`
      INSERT INTO client_guidance_audit_events (
        client_key, profile_id, action, actor_user_id, actor_user_name,
        summary, payload_json, created_at
      ) VALUES (
        :client_key, :profile_id, :action, :actor_user_id, :actor_user_name,
        :summary, :payload_json, :created_at
      )
    `, {
      client_key: payload.clientKey,
      profile_id: payload.profileId ?? null,
      action: payload.action,
      actor_user_id: payload.actor?.id ?? null,
      actor_user_name: payload.actor?.displayName ?? null,
      summary: payload.summary ?? "",
      payload_json: JSON.stringify(payload.snapshot ?? {}),
      created_at: payload.createdAt
    });
  }

  async listAudit(clientKey, limit = 30) {
    return await this.database.allAsync(`
      SELECT * FROM client_guidance_audit_events
      WHERE client_key = :client_key
      ORDER BY created_at DESC, id DESC
      LIMIT :limit
    `, { client_key: clientKey, limit: Math.max(1, Math.min(100, Number(limit) || 30)) });
  }
}

function settingsParams(payload) {
  return {
    client_key: payload.clientKey,
    summary: payload.summary ?? "",
    fields_json: JSON.stringify(payload.fields ?? {}),
    user_id: payload.actor?.id ?? null,
    user_name: payload.actor?.displayName ?? null,
    created_at: payload.timestamp,
    updated_at: payload.timestamp
  };
}

function profileParams(payload) {
  return {
    client_key: payload.clientKey,
    priority: payload.priority,
    sort_order: payload.sortOrder,
    campaign: payload.campaign,
    campaign_key: payload.campaignKey,
    display_name: payload.displayName,
    aliases_json: JSON.stringify(payload.aliases ?? []),
    guideline: payload.guideline,
    source: payload.source,
    medium: payload.medium,
    term_label: payload.term?.label ?? "",
    term_help: payload.term?.help ?? "",
    term_placeholder: payload.term?.placeholder ?? "",
    content_label: payload.content?.label ?? "",
    content_help: payload.content?.help ?? "",
    content_placeholder: payload.content?.placeholder ?? "",
    is_active: payload.isActive ? 1 : 0,
    user_id: payload.actor?.id ?? null,
    user_name: payload.actor?.displayName ?? null,
    created_at: payload.timestamp,
    updated_at: payload.timestamp
  };
}
