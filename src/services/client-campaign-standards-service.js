export class ClientCampaignStandardsService {
  constructor({ repository, rulesService }) {
    this.repository = repository;
    this.rulesService = rulesService;
  }

  async bootstrap() {
    for (const clientKey of this.rulesService.clients()) {
      if (await this.repository.getSettings(clientKey)) {
        continue;
      }
      const guidance = this.rulesService.getClientGuidance(clientKey);
      const timestamp = new Date().toISOString();
      await this.repository.upsertSettings({
        clientKey,
        summary: guidance.summary,
        fields: guidance.fields,
        actor: null,
        timestamp
      });
      for (let index = 0; index < guidance.campaignProfiles.length; index += 1) {
        const profile = guidance.campaignProfiles[index];
        await this.repository.createProfile(normalizeProfile({
          ...profile,
          client_key: clientKey,
          sort_order: index,
          is_active: true
        }, null, timestamp));
      }
    }
  }

  async getEffectiveGuidance(clientKey) {
    const settings = await this.repository.getSettings(clientKey);
    if (!settings) {
      return this.rulesService.getClientGuidance(clientKey);
    }
    const profiles = await this.repository.listProfiles(clientKey, { activeOnly: true });
    return {
      summary: text(settings.summary),
      fields: jsonObject(settings.fields_json),
      campaignProfiles: profiles.map(mapProfile)
    };
  }

  async getAdminView(clientKey) {
    const validClient = this.resolveClient(clientKey);
    const [settings, profiles, audit] = await Promise.all([
      this.repository.getSettings(validClient),
      this.repository.listProfiles(validClient),
      this.repository.listAudit(validClient)
    ]);
    return {
      clientKey: validClient,
      clientDisplayName: this.rulesService.getClientDisplayName(validClient),
      summary: text(settings?.summary),
      fields: jsonObject(settings?.fields_json),
      profiles: profiles.map(mapProfile),
      audit: audit.map((row) => ({
        id: Number(row.id),
        action: row.action,
        actorName: text(row.actor_user_name) || "System",
        summary: text(row.summary),
        createdAt: row.created_at
      }))
    };
  }

  async updateSettings(input, actor) {
    const clientKey = this.resolveClient(input.client_key);
    const existing = await this.repository.getSettings(clientKey);
    const timestamp = new Date().toISOString();
    await this.repository.upsertSettings({
      clientKey,
      summary: text(input.summary),
      fields: jsonObject(existing?.fields_json),
      actor,
      timestamp
    });
    await this.recordAudit(clientKey, null, "settings_updated", actor, "Updated client guidance summary.", {
      summary: text(input.summary)
    }, timestamp);
    return success(clientKey, "Client guidance summary updated.");
  }

  async createProfile(input, actor) {
    const timestamp = new Date().toISOString();
    const payload = normalizeProfile(input, actor, timestamp);
    const validation = await this.validateProfile(payload);
    if (!validation.ok) return validation;
    const profileId = await this.repository.createProfile(payload);
    await this.recordAudit(payload.clientKey, profileId, "created", actor, `Created ${payload.campaign}.`, payload, timestamp);
    return { ...success(payload.clientKey, `Campaign standard "${payload.campaign}" created.`), profileId };
  }

  async updateProfile(input, actor) {
    const id = positiveInteger(input.id);
    const existing = id ? await this.repository.findProfileById(id) : null;
    if (!existing) return failure("profile_not_found", "That campaign standard no longer exists.");
    const timestamp = new Date().toISOString();
    const payload = normalizeProfile({ ...input, client_key: existing.client_key }, actor, timestamp);
    const validation = await this.validateProfile(payload, id);
    if (!validation.ok) return validation;
    await this.repository.updateProfile(id, payload);
    await this.recordAudit(payload.clientKey, id, "updated", actor, `Updated ${payload.campaign}.`, {
      before: mapProfile(existing),
      after: payload
    }, timestamp);
    return success(payload.clientKey, `Campaign standard "${payload.campaign}" updated.`);
  }

  async duplicateProfile(input, actor) {
    const id = positiveInteger(input.id);
    const existing = id ? await this.repository.findProfileById(id) : null;
    if (!existing) return failure("profile_not_found", "That campaign standard no longer exists.");
    const all = await this.repository.listProfiles(existing.client_key);
    const used = new Set(all.map((row) => row.campaign_key));
    let suffix = 2;
    let campaign = `${existing.campaign}Copy`;
    while (used.has(campaignKey(campaign))) {
      campaign = `${existing.campaign}Copy${suffix}`;
      suffix += 1;
    }
    return this.createProfile({
      ...mapProfile(existing),
      client_key: existing.client_key,
      campaign,
      display_name: `${existing.display_name || existing.campaign} Copy`,
      sort_order: Number(existing.sort_order) + 1
    }, actor);
  }

  async toggleProfile(input, actor) {
    const id = positiveInteger(input.id);
    const existing = id ? await this.repository.findProfileById(id) : null;
    if (!existing) return failure("profile_not_found", "That campaign standard no longer exists.");
    const isActive = text(input.action) === "activate";
    const timestamp = new Date().toISOString();
    await this.repository.setProfileActive(id, isActive, actor, timestamp);
    await this.recordAudit(existing.client_key, id, isActive ? "activated" : "deactivated", actor, `${isActive ? "Activated" : "Deactivated"} ${existing.campaign}.`, mapProfile(existing), timestamp);
    return success(existing.client_key, `Campaign standard ${isActive ? "activated" : "deactivated"}.`);
  }

  async deleteProfile(input, actor) {
    const id = positiveInteger(input.id);
    const existing = id ? await this.repository.findProfileById(id) : null;
    if (!existing) return failure("profile_not_found", "That campaign standard no longer exists.");
    const timestamp = new Date().toISOString();
    await this.repository.deleteProfile(id);
    await this.recordAudit(existing.client_key, id, "deleted", actor, `Deleted ${existing.campaign}.`, mapProfile(existing), timestamp);
    return success(existing.client_key, `Campaign standard "${existing.campaign}" deleted.`);
  }

  taxonomyWarnings(clientKey, profile) {
    const taxonomy = this.rulesService.getClientTaxonomy(clientKey);
    const warnings = [];
    if (profile.source && !includesComparable(taxonomy.sources, profile.source)) {
      warnings.push(`Source "${profile.source}" is not currently in this client's taxonomy.`);
    }
    if (profile.medium && !includesComparable(taxonomy.mediums, profile.medium)) {
      warnings.push(`Medium "${profile.medium}" is not currently in this client's taxonomy.`);
    }
    return warnings;
  }

  resolveClient(value) {
    const requested = text(value);
    return this.rulesService.clients().includes(requested) ? requested : this.rulesService.clients()[0];
  }

  async validateProfile(payload, excludingId = null) {
    if (!this.rulesService.clients().includes(payload.clientKey)) {
      return failure("invalid_client", "Select a valid client.");
    }
    if (!payload.campaign) return failure("missing_campaign", "Campaign is required.", payload.clientKey);
    if (!payload.guideline) return failure("missing_guideline", "Campaign guideline is required.", payload.clientKey);
    const profiles = await this.repository.listProfiles(payload.clientKey);
    const duplicate = profiles.find((row) => row.campaign_key === payload.campaignKey && Number(row.id) !== Number(excludingId));
    if (duplicate) return failure("duplicate_campaign", "That client already has a standard for this campaign.", payload.clientKey);
    return { ok: true };
  }

  async recordAudit(clientKey, profileId, action, actor, summary, snapshot, createdAt) {
    await this.repository.recordAudit({ clientKey, profileId, action, actor, summary, snapshot, createdAt });
  }
}

function normalizeProfile(input, actor, timestamp) {
  const campaign = text(input.campaign);
  return {
    clientKey: text(input.client_key ?? input.clientKey),
    priority: positiveInteger(input.priority) ?? 99,
    sortOrder: nonNegativeInteger(input.sort_order ?? input.sortOrder),
    campaign,
    campaignKey: campaignKey(campaign),
    displayName: text(input.display_name ?? input.displayName) || campaign,
    aliases: normalizeAliases(input.aliases ?? input.aliases_json),
    guideline: text(input.guideline),
    source: text(input.source),
    medium: text(input.medium),
    term: {
      label: text(input.term_label ?? input.term?.label ?? input.fields?.term?.label),
      help: text(input.term_help ?? input.term?.help ?? input.fields?.term?.help),
      placeholder: text(input.term_placeholder ?? input.term?.placeholder ?? input.fields?.term?.placeholder)
    },
    content: {
      label: text(input.content_label ?? input.content?.label ?? input.fields?.content?.label),
      help: text(input.content_help ?? input.content?.help ?? input.fields?.content?.help),
      placeholder: text(input.content_placeholder ?? input.content?.placeholder ?? input.fields?.content?.placeholder)
    },
    isActive: input.is_active === undefined ? input.isActive !== false : ["1", "true", "on"].includes(String(input.is_active).toLowerCase()),
    actor,
    timestamp
  };
}

function mapProfile(row) {
  const fields = {};
  const term = {
    label: text(row.term_label),
    help: text(row.term_help),
    placeholder: text(row.term_placeholder)
  };
  const content = {
    label: text(row.content_label),
    help: text(row.content_help),
    placeholder: text(row.content_placeholder)
  };
  if (Object.values(term).some(Boolean)) fields.term = term;
  if (Object.values(content).some(Boolean)) fields.content = content;
  return {
    id: Number(row.id),
    clientKey: row.client_key,
    priority: Number(row.priority),
    sortOrder: Number(row.sort_order),
    campaign: row.campaign,
    displayName: row.display_name || row.campaign,
    aliases: normalizeAliases(row.aliases_json),
    guideline: row.guideline,
    source: row.source,
    medium: row.medium,
    fields,
    isActive: Number(row.is_active) === 1,
    updatedByName: text(row.updated_by_name),
    updatedAt: row.updated_at
  };
}

function normalizeAliases(value) {
  if (Array.isArray(value)) return [...new Set(value.map(text).filter(Boolean))];
  try {
    const parsed = JSON.parse(String(value ?? ""));
    if (Array.isArray(parsed)) return normalizeAliases(parsed);
  } catch {
    // Comma-separated admin input.
  }
  return [...new Set(String(value ?? "").split(/[,;\n]+/u).map(text).filter(Boolean))];
}

function campaignKey(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

function includesComparable(values, value) {
  const expected = campaignKey(value);
  return (values ?? []).some((item) => campaignKey(item) === expected);
}

function jsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function positiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function text(value) {
  return String(value ?? "").trim();
}

function success(clientKey, message) {
  return { ok: true, clientKey, message };
}

function failure(code, message, clientKey = null) {
  return { ok: false, code, message, clientKey };
}
