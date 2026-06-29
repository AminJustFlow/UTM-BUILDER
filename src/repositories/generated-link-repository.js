import { syncAll, syncGet, syncRun } from "../support/database.js";

export class GeneratedLinkRepository {
  constructor(database) {
    this.database = database;
  }

  findByFingerprint(fingerprint) {
    return syncGet(this.database, "SELECT * FROM generated_links WHERE fingerprint = :fingerprint LIMIT 1", { fingerprint }) ?? null;
  }

  async findByFingerprintAsync(fingerprint) {
    if (typeof this.database.getAsync !== "function") {
      return this.findByFingerprint(fingerprint);
    }
    return await this.database.getAsync("SELECT * FROM generated_links WHERE fingerprint = :fingerprint LIMIT 1", { fingerprint }) ?? null;
  }

  findByShortUrl(shortUrl) {
    const normalized = normalizeShortUrl(shortUrl);
    if (!normalized) {
      return null;
    }
    return syncGet(this.database, `
      SELECT *
      FROM generated_links
      WHERE RTRIM(LOWER(TRIM(short_url)), '/') = :short_url
      LIMIT 1
    `, { short_url: normalized }) ?? null;
  }

  async findByShortUrlAsync(shortUrl) {
    if (typeof this.database.getAsync !== "function") {
      return this.findByShortUrl(shortUrl);
    }
    const normalized = normalizeShortUrl(shortUrl);
    if (!normalized) {
      return null;
    }
    return await this.database.getAsync(`
      SELECT *
      FROM generated_links
      WHERE RTRIM(LOWER(TRIM(short_url)), '/') = :short_url
      LIMIT 1
    `, { short_url: normalized }) ?? null;
  }

  listAll() {
    return syncAll(this.database, `
      SELECT *
      FROM generated_links
      ORDER BY created_at DESC, id DESC
    `);
  }

  async listAllAsync() {
    if (typeof this.database.allAsync !== "function") {
      return this.listAll();
    }
    return await this.database.allAsync(`
      SELECT *
      FROM generated_links
      ORDER BY created_at DESC, id DESC
    `);
  }

  countImportedLinks() {
    const row = syncGet(this.database, buildImportedLinksCountSql(this.database));

    return Number(row?.count ?? 0);
  }

  async countImportedLinksAsync() {
    if (typeof this.database.getAsync !== "function") {
      return this.countImportedLinks();
    }
    const row = await this.database.getAsync(buildImportedLinksCountSql(this.database));

    return Number(row?.count ?? 0);
  }

  create(payload) {
    const result = syncRun(this.database, `
      INSERT INTO generated_links (
        fingerprint,
        client,
        channel,
        asset_type,
        normalized_destination_url,
        canonical_campaign,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        final_long_url,
        short_url,
        qr_url,
        bitly_id,
        bitly_payload,
        created_at,
        updated_at
      ) VALUES (
        :fingerprint,
        :client,
        :channel,
        :asset_type,
        :normalized_destination_url,
        :canonical_campaign,
        :utm_source,
        :utm_medium,
        :utm_campaign,
        :utm_term,
        :utm_content,
        :final_long_url,
        :short_url,
        :qr_url,
        :bitly_id,
        :bitly_payload,
        :created_at,
        :updated_at
      )
    `, {
      fingerprint: payload.fingerprint,
      client: payload.client,
      channel: payload.channel,
      asset_type: payload.assetType,
      normalized_destination_url: payload.normalizedDestinationUrl,
      canonical_campaign: payload.canonicalCampaign,
      utm_source: payload.utmSource ?? "",
      utm_medium: payload.utmMedium ?? "",
      utm_campaign: payload.utmCampaign ?? "",
      utm_term: payload.utmTerm ?? "",
      utm_content: payload.utmContent ?? "",
      final_long_url: payload.finalLongUrl,
      short_url: payload.shortUrl,
      qr_url: payload.qrUrl ?? null,
      bitly_id: payload.bitlyId ?? null,
      bitly_payload: JSON.stringify(payload.bitlyPayload ?? {}),
      created_at: payload.createdAt,
      updated_at: payload.updatedAt
    });

    return Number(result.lastInsertRowid);
  }

  async createAsync(payload) {
    if (typeof this.database.runAsync !== "function") {
      return this.create(payload);
    }
    const result = await this.database.runAsync(`
      INSERT INTO generated_links (
        fingerprint,
        client,
        channel,
        asset_type,
        normalized_destination_url,
        canonical_campaign,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        final_long_url,
        short_url,
        qr_url,
        bitly_id,
        bitly_payload,
        created_at,
        updated_at
      ) VALUES (
        :fingerprint,
        :client,
        :channel,
        :asset_type,
        :normalized_destination_url,
        :canonical_campaign,
        :utm_source,
        :utm_medium,
        :utm_campaign,
        :utm_term,
        :utm_content,
        :final_long_url,
        :short_url,
        :qr_url,
        :bitly_id,
        :bitly_payload,
        :created_at,
        :updated_at
      )${this.database.client === "postgres" ? "\n      RETURNING id" : ""}
    `, {
      fingerprint: payload.fingerprint,
      client: payload.client,
      channel: payload.channel,
      asset_type: payload.assetType,
      normalized_destination_url: payload.normalizedDestinationUrl,
      canonical_campaign: payload.canonicalCampaign,
      utm_source: payload.utmSource ?? "",
      utm_medium: payload.utmMedium ?? "",
      utm_campaign: payload.utmCampaign ?? "",
      utm_term: payload.utmTerm ?? "",
      utm_content: payload.utmContent ?? "",
      final_long_url: payload.finalLongUrl,
      short_url: payload.shortUrl,
      qr_url: payload.qrUrl ?? null,
      bitly_id: payload.bitlyId ?? null,
      bitly_payload: JSON.stringify(payload.bitlyPayload ?? {}),
      created_at: payload.createdAt,
      updated_at: payload.updatedAt
    });

    return Number(result.lastInsertRowid);
  }

  updateByFingerprint(fingerprint, fields) {
    const payload = {
      ...fields,
      updated_at: fields.updated_at ?? new Date().toISOString()
    };
    const assignments = Object.keys(payload).map((field) => `${field} = :${field}`).join(", ");
    const values = { fingerprint };

    Object.entries(payload).forEach(([key, value]) => {
      values[key] = key === "bitly_payload"
        ? JSON.stringify(value ?? {})
        : value;
    });

    syncRun(this.database, `UPDATE generated_links SET ${assignments} WHERE fingerprint = :fingerprint`, values);
  }

  async updateByFingerprintAsync(fingerprint, fields) {
    if (typeof this.database.runAsync !== "function") {
      this.updateByFingerprint(fingerprint, fields);
      return;
    }
    const payload = {
      ...fields,
      updated_at: fields.updated_at ?? new Date().toISOString()
    };
    const assignments = Object.keys(payload).map((field) => `${field} = :${field}`).join(", ");
    const values = { fingerprint };

    Object.entries(payload).forEach(([key, value]) => {
      values[key] = key === "bitly_payload"
        ? JSON.stringify(value ?? {})
        : value;
    });

    await this.database.runAsync(`UPDATE generated_links SET ${assignments} WHERE fingerprint = :fingerprint`, values);
  }

  deleteByFingerprint(fingerprint) {
    const result = syncRun(this.database, `
      DELETE FROM generated_links
      WHERE fingerprint = :fingerprint
    `, { fingerprint });

    return Number(result.changes ?? 0);
  }

  async deleteByFingerprintAsync(fingerprint) {
    if (typeof this.database.runAsync !== "function") {
      return this.deleteByFingerprint(fingerprint);
    }
    const result = await this.database.runAsync(`
      DELETE FROM generated_links
      WHERE fingerprint = :fingerprint
    `, { fingerprint });

    return Number(result.changes ?? 0);
  }
}

function normalizeShortUrl(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/u, "");
}

function buildImportedLinksCountSql(database) {
  if (database?.client === "postgres") {
    return `
      SELECT COUNT(*) AS count
      FROM generated_links
      WHERE COALESCE(bitly_payload::text, '') ~ '"imported"\\s*:\\s*true'
    `;
  }

  return `
    SELECT COUNT(*) AS count
    FROM generated_links
    WHERE bitly_payload LIKE '%"imported":true%'
  `;
}
