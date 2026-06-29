import crypto from "node:crypto";
import { syncAll, syncGet, syncRun } from "../support/database.js";

function serializeValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value !== null && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}

export class RequestRepository {
  constructor(database) {
    this.database = database;
  }

  findById(id) {
    return syncGet(this.database, "SELECT * FROM requests WHERE id = :id LIMIT 1", { id }) ?? null;
  }

  async findByIdAsync(id) {
    if (typeof this.database.getAsync !== "function") {
      return this.findById(id);
    }
    return await this.database.getAsync("SELECT * FROM requests WHERE id = :id LIMIT 1", { id }) ?? null;
  }

  findByDeliveryKey(deliveryKey) {
    return syncGet(this.database, "SELECT * FROM requests WHERE delivery_key = :delivery_key LIMIT 1", { delivery_key: deliveryKey }) ?? null;
  }

  async findByDeliveryKeyAsync(deliveryKey) {
    if (typeof this.database.getAsync !== "function") {
      return this.findByDeliveryKey(deliveryKey);
    }
    return await this.database.getAsync("SELECT * FROM requests WHERE delivery_key = :delivery_key LIMIT 1", { delivery_key: deliveryKey }) ?? null;
  }

  findLatestByFingerprint(fingerprint) {
    return syncGet(this.database, `
      SELECT * FROM requests
      WHERE fingerprint = :fingerprint
      ORDER BY id DESC
      LIMIT 1
    `, { fingerprint }) ?? null;
  }

  async findLatestByFingerprintAsync(fingerprint) {
    if (typeof this.database.getAsync !== "function") {
      return this.findLatestByFingerprint(fingerprint);
    }
    return await this.database.getAsync(`
      SELECT * FROM requests
      WHERE fingerprint = :fingerprint
      ORDER BY id DESC
      LIMIT 1
    `, { fingerprint }) ?? null;
  }

  findLatestByShortUrl(shortUrl) {
    const normalized = normalizeShortUrl(shortUrl);
    if (!normalized) {
      return null;
    }
    return syncGet(this.database, `
      SELECT *
      FROM requests
      WHERE short_url IS NOT NULL
        AND RTRIM(LOWER(TRIM(short_url)), '/') = :short_url
      ORDER BY id DESC
      LIMIT 1
    `, { short_url: normalized }) ?? null;
  }

  async findLatestByShortUrlAsync(shortUrl) {
    if (typeof this.database.getAsync !== "function") {
      return this.findLatestByShortUrl(shortUrl);
    }
    const normalized = normalizeShortUrl(shortUrl);
    if (!normalized) {
      return null;
    }
    return await this.database.getAsync(`
      SELECT *
      FROM requests
      WHERE short_url IS NOT NULL
        AND RTRIM(LOWER(TRIM(short_url)), '/') = :short_url
      ORDER BY id DESC
      LIMIT 1
    `, { short_url: normalized }) ?? null;
  }

  countImportedRequests() {
    const row = syncGet(this.database, `
      SELECT COUNT(*) AS count
      FROM requests
      WHERE source_user_id = 'xlsx_import'
    `);

    return Number(row?.count ?? 0);
  }

  async countImportedRequestsAsync() {
    if (typeof this.database.getAsync !== "function") {
      return this.countImportedRequests();
    }
    const row = await this.database.getAsync(`
      SELECT COUNT(*) AS count
      FROM requests
      WHERE source_user_id = 'xlsx_import'
    `);
    return Number(row?.count ?? 0);
  }

  listImportedFingerprints() {
    return syncAll(this.database, `
      SELECT DISTINCT fingerprint
      FROM requests
      WHERE source_user_id = 'xlsx_import'
        AND fingerprint IS NOT NULL
        AND TRIM(fingerprint) <> ''
    `).map((row) => row.fingerprint);
  }

  async listImportedFingerprintsAsync() {
    if (typeof this.database.allAsync !== "function") {
      return this.listImportedFingerprints();
    }
    return (await this.database.allAsync(`
      SELECT DISTINCT fingerprint
      FROM requests
      WHERE source_user_id = 'xlsx_import'
        AND fingerprint IS NOT NULL
        AND TRIM(fingerprint) <> ''
    `)).map((row) => row.fingerprint);
  }

  deleteImportedRequests() {
    const result = syncRun(this.database, `
      DELETE FROM requests
      WHERE source_user_id = 'xlsx_import'
    `);

    return Number(result.changes ?? 0);
  }

  async deleteImportedRequestsAsync() {
    if (typeof this.database.runAsync !== "function") {
      return this.deleteImportedRequests();
    }
    const result = await this.database.runAsync(`
      DELETE FROM requests
      WHERE source_user_id = 'xlsx_import'
    `);
    return Number(result.changes ?? 0);
  }

  countByFingerprint(fingerprint) {
    const row = syncGet(this.database, `
      SELECT COUNT(*) AS count
      FROM requests
      WHERE fingerprint = :fingerprint
    `, { fingerprint });

    return Number(row?.count ?? 0);
  }

  async countByFingerprintAsync(fingerprint) {
    if (typeof this.database.getAsync !== "function") {
      return this.countByFingerprint(fingerprint);
    }
    const row = await this.database.getAsync(`
      SELECT COUNT(*) AS count
      FROM requests
      WHERE fingerprint = :fingerprint
    `, { fingerprint });
    return Number(row?.count ?? 0);
  }

  deleteByFingerprint(fingerprint) {
    const result = syncRun(this.database, `
      DELETE FROM requests
      WHERE fingerprint = :fingerprint
    `, { fingerprint });

    return Number(result.changes ?? 0);
  }

  async deleteByFingerprintAsync(fingerprint) {
    if (typeof this.database.runAsync !== "function") {
      return this.deleteByFingerprint(fingerprint);
    }
    const result = await this.database.runAsync(`
      DELETE FROM requests
      WHERE fingerprint = :fingerprint
    `, { fingerprint });
    return Number(result.changes ?? 0);
  }

  deleteByRequestUuid(requestUuid) {
    const result = syncRun(this.database, `
      DELETE FROM requests
      WHERE request_uuid = :request_uuid
    `, { request_uuid: requestUuid });

    return Number(result.changes ?? 0);
  }

  async deleteByRequestUuidAsync(requestUuid) {
    if (typeof this.database.runAsync !== "function") {
      return this.deleteByRequestUuid(requestUuid);
    }
    const result = await this.database.runAsync(`
      DELETE FROM requests
      WHERE request_uuid = :request_uuid
    `, { request_uuid: requestUuid });
    return Number(result.changes ?? 0);
  }

  listReceivedBefore(beforeIso, limit = 25) {
    return syncAll(this.database, `
      SELECT * FROM requests
      WHERE status = 'received'
        AND created_at <= :before
      ORDER BY created_at ASC, id ASC
      LIMIT :limit
    `, {
      before: beforeIso,
      limit
    });
  }

  async listReceivedBeforeAsync(beforeIso, limit = 25) {
    if (typeof this.database.allAsync !== "function") {
      return this.listReceivedBefore(beforeIso, limit);
    }
    return await this.database.allAsync(`
      SELECT * FROM requests
      WHERE status = 'received'
        AND created_at <= :before
      ORDER BY created_at ASC, id ASC
      LIMIT :limit
    `, {
      before: beforeIso,
      limit
    });
  }

  claimRecovery(id, nextStatus = "recovering") {
    const result = syncRun(this.database, `
      UPDATE requests
      SET status = :next_status,
          updated_at = :updated_at
      WHERE id = :id
        AND status = 'received'
    `, {
      id,
      next_status: nextStatus,
      updated_at: new Date().toISOString()
    });

    return Number(result.changes ?? 0) > 0;
  }

  async claimRecoveryAsync(id, nextStatus = "recovering") {
    if (typeof this.database.runAsync !== "function") {
      return this.claimRecovery(id, nextStatus);
    }
    const result = await this.database.runAsync(`
      UPDATE requests
      SET status = :next_status,
          updated_at = :updated_at
      WHERE id = :id
        AND status = 'received'
    `, {
      id,
      next_status: nextStatus,
      updated_at: new Date().toISOString()
    });

    return Number(result.changes ?? 0) > 0;
  }

  createIncoming(payload) {
    const result = syncRun(this.database, `
      INSERT INTO requests (
        request_uuid,
        delivery_key,
        status,
        original_message,
        raw_payload,
        clickup_workspace_id,
        clickup_channel_id,
        clickup_message_id,
        clickup_thread_message_id,
        source_user_id,
        source_user_name,
        created_at,
        updated_at
      ) VALUES (
        :request_uuid,
        :delivery_key,
        :status,
        :original_message,
        :raw_payload,
        :clickup_workspace_id,
        :clickup_channel_id,
        :clickup_message_id,
        :clickup_thread_message_id,
        :source_user_id,
        :source_user_name,
        :created_at,
        :updated_at
      )
    `, {
      request_uuid: payload.requestUuid ?? crypto.randomUUID(),
      delivery_key: payload.deliveryKey,
      status: payload.status ?? "received",
      original_message: payload.originalMessage,
      raw_payload: serializeValue(payload.rawPayload ?? {}),
      clickup_workspace_id: payload.clickupWorkspaceId ?? null,
      clickup_channel_id: payload.clickupChannelId ?? null,
      clickup_message_id: payload.clickupMessageId ?? null,
      clickup_thread_message_id: payload.clickupThreadMessageId ?? null,
      source_user_id: payload.sourceUserId ?? "anonymous",
      source_user_name: payload.sourceUserName ?? null,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt
    });

    return Number(result.lastInsertRowid);
  }

  async createIncomingAsync(payload) {
    if (typeof this.database.runAsync !== "function") {
      return this.createIncoming(payload);
    }
    const result = await this.database.runAsync(`
      INSERT INTO requests (
        request_uuid,
        delivery_key,
        status,
        original_message,
        raw_payload,
        clickup_workspace_id,
        clickup_channel_id,
        clickup_message_id,
        clickup_thread_message_id,
        source_user_id,
        source_user_name,
        created_at,
        updated_at
      ) VALUES (
        :request_uuid,
        :delivery_key,
        :status,
        :original_message,
        :raw_payload,
        :clickup_workspace_id,
        :clickup_channel_id,
        :clickup_message_id,
        :clickup_thread_message_id,
        :source_user_id,
        :source_user_name,
        :created_at,
        :updated_at
      )${this.database.client === "postgres" ? "\n      RETURNING id" : ""}
    `, {
      request_uuid: payload.requestUuid ?? crypto.randomUUID(),
      delivery_key: payload.deliveryKey,
      status: payload.status ?? "received",
      original_message: payload.originalMessage,
      raw_payload: serializeValue(payload.rawPayload ?? {}),
      clickup_workspace_id: payload.clickupWorkspaceId ?? null,
      clickup_channel_id: payload.clickupChannelId ?? null,
      clickup_message_id: payload.clickupMessageId ?? null,
      clickup_thread_message_id: payload.clickupThreadMessageId ?? null,
      source_user_id: payload.sourceUserId ?? "anonymous",
      source_user_name: payload.sourceUserName ?? null,
      created_at: payload.createdAt,
      updated_at: payload.updatedAt
    });

    return Number(result.lastInsertRowid);
  }

  update(id, fields) {
    const payload = {
      ...fields,
      updated_at: fields.updated_at ?? new Date().toISOString()
    };

    const assignments = Object.keys(payload).map((field) => `${field} = :${field}`).join(", ");
    const values = { id };

    for (const [key, value] of Object.entries(payload)) {
      values[key] = serializeValue(value);
    }

    syncRun(this.database, `UPDATE requests SET ${assignments} WHERE id = :id`, values);
  }

  async updateAsync(id, fields) {
    if (typeof this.database.runAsync !== "function") {
      this.update(id, fields);
      return;
    }
    const payload = {
      ...fields,
      updated_at: fields.updated_at ?? new Date().toISOString()
    };

    const assignments = Object.keys(payload).map((field) => `${field} = :${field}`).join(", ");
    const values = { id };

    for (const [key, value] of Object.entries(payload)) {
      values[key] = serializeValue(value);
    }

    await this.database.runAsync(`UPDATE requests SET ${assignments} WHERE id = :id`, values);
  }

  countRecentByActorChannel(userId, channelId, since) {
    const row = syncGet(this.database, `
      SELECT COUNT(*) AS count FROM requests
      WHERE clickup_channel_id = :channel_id
      AND source_user_id = :source_user_id
      AND created_at >= :since
    `, {
      channel_id: channelId,
      source_user_id: userId,
      since
    });

    return Number(row?.count ?? 0);
  }

  async countRecentByActorChannelAsync(userId, channelId, since) {
    if (typeof this.database.getAsync !== "function") {
      return this.countRecentByActorChannel(userId, channelId, since);
    }
    const row = await this.database.getAsync(`
      SELECT COUNT(*) AS count FROM requests
      WHERE clickup_channel_id = :channel_id
      AND source_user_id = :source_user_id
      AND created_at >= :since
    `, {
      channel_id: channelId,
      source_user_id: userId,
      since
    });

    return Number(row?.count ?? 0);
  }

  listUniqueTrackedRequests({ statuses = ["completed", "completed_without_short_link"] } = {}) {
    const normalizedStatuses = Array.isArray(statuses)
      ? statuses.map((status) => String(status ?? "").trim()).filter(Boolean)
      : [];
    const params = {};
    const statusClause = normalizedStatuses.length > 0
      ? `AND status IN (${normalizedStatuses.map((_, index) => `:status_${index}`).join(", ")})`
      : "";

    normalizedStatuses.forEach((status, index) => {
      params[`status_${index}`] = status;
    });

    return syncAll(this.database, `
      SELECT
        r.*,
        grouped.request_count,
        grouped.first_created_at,
        grouped.last_created_at
      FROM requests r
      INNER JOIN (
        SELECT
          COALESCE(NULLIF(fingerprint, ''), request_uuid) AS dedupe_key,
          MAX(id) AS latest_id,
          COUNT(*) AS request_count,
          MIN(created_at) AS first_created_at,
          MAX(created_at) AS last_created_at
        FROM requests
        WHERE final_long_url IS NOT NULL
          ${statusClause}
        GROUP BY COALESCE(NULLIF(fingerprint, ''), request_uuid)
      ) grouped ON grouped.latest_id = r.id
      ORDER BY grouped.last_created_at DESC, r.id DESC
    `, params);
  }

  listTrackedRequestLibrary({
    statuses = ["completed", "completed_without_short_link"],
    client = "",
    channel = "",
    source = "",
    medium = "",
    term = "",
    content = "",
    campaign = "",
    status = "all",
    search = "",
    qr = "all",
    shortLink = "all",
    sort = "recent",
    limit = 50,
    offset = 0
  } = {}) {
    const context = this.buildTrackedRequestLibraryContext({
      statuses,
      client,
      channel,
      source,
      medium,
      term,
      content,
      campaign,
      status,
      search,
      qr,
      shortLink
    });
    const orderBy = resolveTrackedRequestLibraryOrderBy(sort, this.database.client);
    const rows = syncAll(this.database, `
      ${context.baseCte}
      SELECT *
      FROM filtered_requests
      ORDER BY ${orderBy}
      LIMIT :limit OFFSET :offset
    `, {
      ...context.params,
      limit: Number(limit),
      offset: Number(offset)
    });
    const summary = syncGet(this.database, `
      ${context.baseCte}
      SELECT
        (SELECT COUNT(*) FROM deduped_requests) AS total_unique_links,
        COUNT(*) AS filtered_links,
        COALESCE(SUM(request_count), 0) AS requests_represented,
        COALESCE(SUM(CASE WHEN has_qr = 1 THEN 1 ELSE 0 END), 0) AS with_qr,
        COALESCE(SUM(CASE WHEN has_short_url = 0 THEN 1 ELSE 0 END), 0) AS without_short_link
      FROM filtered_requests
    `, context.params);
    const available = syncAll(this.database, `
      ${context.baseCte}
      SELECT
        group_name,
        group_value
      FROM (
        SELECT 'clients' AS group_name, client AS group_value FROM filtered_requests WHERE client <> ''
        UNION ALL
        SELECT 'channels' AS group_name, channel AS group_value FROM filtered_requests WHERE channel <> ''
        UNION ALL
        SELECT 'sources' AS group_name, utm_source AS group_value FROM filtered_requests WHERE utm_source <> ''
        UNION ALL
        SELECT 'mediums' AS group_name, utm_medium AS group_value FROM filtered_requests WHERE utm_medium <> ''
      )
      GROUP BY group_name, group_value
      ORDER BY group_name ASC, LOWER(group_value) ASC
    `, context.params);

    return {
      rows,
      summary: {
        total_unique_links: Number(summary?.total_unique_links ?? 0),
        filtered_links: Number(summary?.filtered_links ?? 0),
        requests_represented: Number(summary?.requests_represented ?? 0),
        with_qr: Number(summary?.with_qr ?? 0),
        without_short_link: Number(summary?.without_short_link ?? 0)
      },
      available: {
        clients: available.filter((row) => row.group_name === "clients").map((row) => row.group_value),
        channels: available.filter((row) => row.group_name === "channels").map((row) => row.group_value),
        sources: available.filter((row) => row.group_name === "sources").map((row) => row.group_value),
        mediums: available.filter((row) => row.group_name === "mediums").map((row) => row.group_value)
      }
    };
  }

  async listTrackedRequestLibraryAsync({
    statuses = ["completed", "completed_without_short_link"],
    client = "",
    channel = "",
    source = "",
    medium = "",
    term = "",
    content = "",
    campaign = "",
    status = "all",
    search = "",
    qr = "all",
    shortLink = "all",
    sort = "recent",
    limit = 50,
    offset = 0
  } = {}) {
    if (typeof this.database.allAsync !== "function" || typeof this.database.getAsync !== "function") {
      return this.listTrackedRequestLibrary({
        statuses,
        client,
        channel,
        source,
        medium,
        campaign,
        status,
        search,
        qr,
        shortLink,
        sort,
        limit,
        offset
      });
    }
    const context = this.buildTrackedRequestLibraryContext({
      statuses,
      client,
      channel,
      source,
      medium,
      term,
      content,
      campaign,
      status,
      search,
      qr,
      shortLink
    });
    const orderBy = resolveTrackedRequestLibraryOrderBy(sort, this.database.client);
    const rows = await this.database.allAsync(`
      ${context.baseCte}
      SELECT *
      FROM filtered_requests
      ORDER BY ${orderBy}
      LIMIT :limit OFFSET :offset
    `, {
      ...context.params,
      limit: Number(limit),
      offset: Number(offset)
    });
    const summary = await this.database.getAsync(`
      ${context.baseCte}
      SELECT
        (SELECT COUNT(*) FROM deduped_requests) AS total_unique_links,
        COUNT(*) AS filtered_links,
        COALESCE(SUM(request_count), 0) AS requests_represented,
        COALESCE(SUM(CASE WHEN has_qr = 1 THEN 1 ELSE 0 END), 0) AS with_qr,
        COALESCE(SUM(CASE WHEN has_short_url = 0 THEN 1 ELSE 0 END), 0) AS without_short_link
      FROM filtered_requests
    `, context.params);
    const available = await this.database.allAsync(`
      ${context.baseCte}
      SELECT
        group_name,
        group_value
      FROM (
        SELECT 'clients' AS group_name, client AS group_value FROM filtered_requests WHERE client <> ''
        UNION ALL
        SELECT 'channels' AS group_name, channel AS group_value FROM filtered_requests WHERE channel <> ''
        UNION ALL
        SELECT 'sources' AS group_name, utm_source AS group_value FROM filtered_requests WHERE utm_source <> ''
        UNION ALL
        SELECT 'mediums' AS group_name, utm_medium AS group_value FROM filtered_requests WHERE utm_medium <> ''
      )
      GROUP BY group_name, group_value
      ORDER BY group_name ASC, group_value ASC
    `, context.params);

    return {
      rows,
      summary: {
        total_unique_links: Number(summary?.total_unique_links ?? 0),
        filtered_links: Number(summary?.filtered_links ?? 0),
        requests_represented: Number(summary?.requests_represented ?? 0),
        with_qr: Number(summary?.with_qr ?? 0),
        without_short_link: Number(summary?.without_short_link ?? 0)
      },
      available: {
        clients: available.filter((row) => row.group_name === "clients").map((row) => row.group_value),
        channels: available.filter((row) => row.group_name === "channels").map((row) => row.group_value),
        sources: available.filter((row) => row.group_name === "sources").map((row) => row.group_value),
        mediums: available.filter((row) => row.group_name === "mediums").map((row) => row.group_value)
      }
    };
  }

  buildTrackedRequestLibraryContext({
    statuses = ["completed", "completed_without_short_link"],
    client = "",
    channel = "",
    source = "",
    medium = "",
    term = "",
    content = "",
    campaign = "",
    status = "all",
    search = "",
    qr = "all",
    shortLink = "all"
  } = {}) {
    const normalizedStatuses = Array.isArray(statuses)
      ? statuses.map((value) => String(value ?? "").trim()).filter(Boolean)
      : [];
    const params = {};
    normalizedStatuses.forEach((value, index) => {
      params[`status_${index}`] = value;
    });
    const statusScopeClause = normalizedStatuses.length > 0
      ? `AND status IN (${normalizedStatuses.map((_, index) => `:status_${index}`).join(", ")})`
      : "";
    const filters = [];

    const normalizedClient = String(client ?? "").trim().toLowerCase();
    if (normalizedClient) {
      params.client = normalizedClient;
      filters.push("client = :client");
    }

    const normalizedChannel = String(channel ?? "").trim().toLowerCase();
    if (normalizedChannel) {
      params.channel = normalizedChannel;
      filters.push("channel = :channel");
    }

    const normalizedSource = String(source ?? "").trim();
    if (normalizedSource) {
      params.source = normalizedSource;
      filters.push("utm_source = :source");
    }

    const normalizedMedium = String(medium ?? "").trim();
    if (normalizedMedium) {
      params.medium = normalizedMedium;
      filters.push("utm_medium = :medium");
    }

    const normalizedTerm = String(term ?? "").trim();
    if (normalizedTerm) {
      params.term = normalizedTerm;
      filters.push("utm_term = :term");
    }

    const normalizedContent = String(content ?? "").trim();
    if (normalizedContent) {
      params.content = normalizedContent;
      filters.push("utm_content = :content");
    }

    const normalizedStatus = String(status ?? "").trim().toLowerCase();
    if (normalizedStatus && normalizedStatus !== "all") {
      params.status_filter = normalizedStatus;
      filters.push("status = :status_filter");
    }

    const normalizedQr = String(qr ?? "").trim().toLowerCase();
    if (normalizedQr === "with_qr") {
      filters.push("has_qr = 1");
    } else if (normalizedQr === "without_qr") {
      filters.push("has_qr = 0");
    }

    const normalizedShortLink = String(shortLink ?? "").trim().toLowerCase();
    if (normalizedShortLink === "with_short_link") {
      filters.push("has_short_url = 1");
    } else if (normalizedShortLink === "without_short_link") {
      filters.push("has_short_url = 0");
    }

    const normalizedCampaign = String(campaign ?? "").trim().toLowerCase();
    if (normalizedCampaign) {
      params.campaign = `%${escapeLikePattern(normalizedCampaign)}%`;
      filters.push("(LOWER(campaign_label) LIKE :campaign ESCAPE '\\' OR LOWER(canonical_campaign) LIKE :campaign ESCAPE '\\' OR LOWER(utm_campaign) LIKE :campaign ESCAPE '\\')");
    }

    const normalizedSearch = String(search ?? "").trim().toLowerCase();
    if (normalizedSearch) {
      params.search = `%${escapeLikePattern(normalizedSearch)}%`;
      filters.push(`(
        LOWER(client) LIKE :search ESCAPE '\\'
        OR LOWER(client_display_name) LIKE :search ESCAPE '\\'
        OR LOWER(channel) LIKE :search ESCAPE '\\'
        OR LOWER(channel_display_name) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(asset_type, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(campaign_label, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(canonical_campaign, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(utm_source, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(utm_medium, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(utm_campaign, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(utm_term, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(utm_content, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(destination_url, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(final_long_url, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(short_url, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(qr_url, '')) LIKE :search ESCAPE '\\'
        OR LOWER(COALESCE(original_message, '')) LIKE :search ESCAPE '\\'
      )`);
    }

    const filterClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const clientExpr = jsonFieldExpression("r.normalized_payload", "client", this.database.client);
    const clientDisplayExpr = jsonFieldExpression("r.normalized_payload", "client_display_name", this.database.client);
    const channelExpr = jsonFieldExpression("r.normalized_payload", "channel", this.database.client);
    const channelDisplayExpr = jsonFieldExpression("r.normalized_payload", "channel_display_name", this.database.client);
    const assetTypeExpr = jsonFieldExpression("r.normalized_payload", "asset_type", this.database.client);
    const campaignLabelExpr = jsonFieldExpression("r.normalized_payload", "campaign_label", this.database.client);
    const canonicalCampaignExpr = jsonFieldExpression("r.normalized_payload", "canonical_campaign", this.database.client);
    const utmSourceExpr = jsonFieldExpression("r.normalized_payload", "utm_source", this.database.client);
    const utmMediumExpr = jsonFieldExpression("r.normalized_payload", "utm_medium", this.database.client);
    const utmCampaignExpr = jsonFieldExpression("r.normalized_payload", "utm_campaign", this.database.client);
    const utmTermExpr = jsonFieldExpression("r.normalized_payload", "utm_term", this.database.client);
    const utmContentExpr = jsonFieldExpression("r.normalized_payload", "utm_content", this.database.client);
    const destinationExpr = `COALESCE(${jsonFieldExpression("r.normalized_payload", "destination_url", this.database.client)}, ${jsonFieldExpression("r.normalized_payload", "normalized_destination_url", this.database.client)}, '')`;

    return {
      params,
      baseCte: `
        WITH deduped_requests AS (
          SELECT
            r.*,
            g.client AS generated_client,
            g.channel AS generated_channel,
            g.asset_type AS generated_asset_type,
            g.normalized_destination_url AS generated_destination_url,
            g.canonical_campaign AS generated_canonical_campaign,
            g.utm_source AS generated_utm_source,
            g.utm_medium AS generated_utm_medium,
            g.utm_campaign AS generated_utm_campaign,
            g.utm_term AS generated_utm_term,
            g.utm_content AS generated_utm_content,
            g.final_long_url AS generated_final_long_url,
            g.short_url AS generated_short_url,
            g.qr_url AS generated_qr_url,
            grouped.request_count,
            grouped.first_created_at,
            grouped.last_created_at,
            LOWER(TRIM(COALESCE(g.client, ${clientExpr}, 'unknown'))) AS client,
            TRIM(COALESCE(${clientDisplayExpr}, '')) AS client_display_name,
            LOWER(TRIM(COALESCE(g.channel, ${channelExpr}, 'unknown'))) AS channel,
            TRIM(COALESCE(${channelDisplayExpr}, '')) AS channel_display_name,
            TRIM(COALESCE(g.asset_type, ${assetTypeExpr}, '')) AS asset_type,
            TRIM(COALESCE(${campaignLabelExpr}, '')) AS campaign_label,
            TRIM(COALESCE(g.canonical_campaign, ${canonicalCampaignExpr}, g.utm_campaign, '')) AS canonical_campaign,
            TRIM(COALESCE(g.utm_source, ${utmSourceExpr}, '')) AS utm_source,
            TRIM(COALESCE(g.utm_medium, ${utmMediumExpr}, '')) AS utm_medium,
            TRIM(COALESCE(g.utm_campaign, ${utmCampaignExpr}, '')) AS utm_campaign,
            TRIM(COALESCE(g.utm_term, ${utmTermExpr}, '')) AS utm_term,
            TRIM(COALESCE(g.utm_content, ${utmContentExpr}, '')) AS utm_content,
            TRIM(COALESCE(${destinationExpr}, g.normalized_destination_url, '')) AS destination_url,
            CASE WHEN TRIM(COALESCE(g.short_url, r.short_url, '')) <> '' THEN 1 ELSE 0 END AS has_short_url,
            CASE WHEN TRIM(COALESCE(g.qr_url, r.qr_url, '')) <> '' THEN 1 ELSE 0 END AS has_qr
          FROM requests r
          LEFT JOIN generated_links g ON g.fingerprint = r.fingerprint
          INNER JOIN (
            SELECT
              COALESCE(NULLIF(fingerprint, ''), request_uuid) AS dedupe_key,
              MAX(id) AS latest_id,
              COUNT(*) AS request_count,
              MIN(created_at) AS first_created_at,
              MAX(created_at) AS last_created_at
            FROM requests
            WHERE final_long_url IS NOT NULL
              ${statusScopeClause}
            GROUP BY COALESCE(NULLIF(fingerprint, ''), request_uuid)
          ) grouped ON grouped.latest_id = r.id
        ),
        filtered_requests AS (
          SELECT *
          FROM deduped_requests
          ${filterClause}
        )
      `
    };
  }
}

function normalizeShortUrl(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/u, "");
}

function resolveTrackedRequestLibraryOrderBy(sort, client = "sqlite") {
  switch (String(sort ?? "").trim().toLowerCase()) {
    case "oldest":
      return "last_created_at ASC, id ASC";
    case "client":
      return client === "postgres"
        ? "LOWER(client_display_name) ASC, last_created_at DESC, id DESC"
        : "LOWER(client_display_name) ASC, last_created_at DESC, id DESC";
    case "campaign":
      return client === "postgres"
        ? "LOWER(COALESCE(NULLIF(utm_campaign, ''), canonical_campaign, campaign_label, '')) ASC, last_created_at DESC, id DESC"
        : "LOWER(COALESCE(NULLIF(utm_campaign, ''), canonical_campaign, campaign_label, '')) ASC, last_created_at DESC, id DESC";
    case "requests":
      return "request_count DESC, last_created_at DESC, id DESC";
    case "recent":
    default:
      return "last_created_at DESC, id DESC";
  }
}

function jsonFieldExpression(column, field, client = "sqlite") {
  return client === "postgres"
    ? `jsonb_field(${column}, '${field}')`
    : `json_extract(${column}, '$.${field}')`;
}

function escapeLikePattern(value) {
  return String(value ?? "")
    .replace(/\\/gu, "\\\\")
    .replace(/%/gu, "\\%")
    .replace(/_/gu, "\\_");
}
