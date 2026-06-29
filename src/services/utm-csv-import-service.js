import crypto from "node:crypto";

const REQUIRED_COLUMNS = [
  "client", "channel", "destination_url", "final_long_url",
  "utm_source", "utm_medium", "utm_campaign"
];

export class UtmCsvImportService {
  constructor({ requestRepository, generatedLinkRepository, fingerprintService, urlService, linkAuditRepository = null }) {
    this.requestRepository = requestRepository;
    this.generatedLinkRepository = generatedLinkRepository;
    this.fingerprintService = fingerprintService;
    this.urlService = urlService;
    this.linkAuditRepository = linkAuditRepository;
  }

  async import(csvText, actor = null) {
    const sourceUserId = actor?.id ? `user:${actor.id}` : "utm_csv_import";
    const sourceUserName = actor?.displayName || "CSV Import";
    const parsed = parseCsv(csvText);
    if (!parsed.headers.length || !parsed.rows.length) {
      return failure("empty_csv", "The CSV does not contain any UTM rows.");
    }

    const missingColumns = REQUIRED_COLUMNS.filter((column) => !parsed.headers.includes(column));
    if (missingColumns.length) {
      return failure("missing_columns", `Missing required columns: ${missingColumns.join(", ")}.`);
    }

    const summary = { total: parsed.rows.length, imported: 0, skipped: 0, failed: 0, errors: [] };
    for (let index = 0; index < parsed.rows.length; index += 1) {
      const row = parsed.rows[index];
      try {
        const values = normalizeRow(row);
        if (!values.client || !values.destinationUrl || !values.finalLongUrl) {
          throw new Error("Client, destination URL, and final long URL are required.");
        }

        values.normalizedDestinationUrl = this.urlService.normalizeDestination(values.destinationUrl);
        const normalized = buildNormalizedPayload(values);
        const identityShape = buildIdentityShape(values);
        const utmIdentityKey = this.fingerprintService.generateUtmIdentity(identityShape);
        const fingerprint = createFingerprint(values);
        const existing = await this.requestRepository.findExactUtmDuplicateAsync(identityShape);
        if (existing) {
          summary.skipped += 1;
          continue;
        }

        const timestamp = validIso(row.last_seen_at) ?? validIso(row.first_seen_at) ?? new Date().toISOString();
        const requestId = await this.requestRepository.createIncomingAsync({
          requestUuid: crypto.randomUUID(),
          deliveryKey: `utm-csv:${crypto.randomUUID()}`,
          status: "received",
          originalMessage: text(row.original_message) || `Imported from CSV | Client: ${values.client} | Campaign: ${values.utmCampaign}`,
          rawPayload: { source: "utm_csv_import", csv_row: index + 2, imported_by: sourceUserId },
          sourceUserId,
          sourceUserName,
          createdAt: timestamp,
          updatedAt: timestamp
        });

        try {
          await this.requestRepository.updateAsync(requestId, {
            status: values.shortUrl ? "completed" : "completed_without_short_link",
            parsed_payload: normalized,
            normalized_payload: normalized,
            fingerprint,
            utm_identity_key: utmIdentityKey,
            final_long_url: values.finalLongUrl,
            short_url: values.shortUrl || null,
            qr_url: values.qrUrl || null,
            warnings: [],
            missing_fields: [],
            reused_existing: 0,
            updated_at: timestamp
          });
        } catch (error) {
          const raceDuplicate = await this.requestRepository.findExactUtmDuplicateAsync(identityShape);
          if (!raceDuplicate || Number(raceDuplicate.id) === Number(requestId)) throw error;
          await this.requestRepository.deleteByIdAsync(requestId);
          summary.skipped += 1;
          continue;
        }

        const cachedLink = await this.generatedLinkRepository.findByFingerprintAsync(fingerprint);
        if (!cachedLink) {
          await this.generatedLinkRepository.createAsync({
            fingerprint,
            client: values.client,
            channel: values.channel,
            assetType: values.assetType,
            normalizedDestinationUrl: values.normalizedDestinationUrl,
            canonicalCampaign: values.canonicalCampaign,
            utmSource: values.utmSource,
            utmMedium: values.utmMedium,
            utmCampaign: values.utmCampaign,
            utmTerm: values.utmTerm,
            utmContent: values.utmContent,
            finalLongUrl: values.finalLongUrl,
            shortUrl: values.shortUrl,
            qrUrl: values.qrUrl || null,
            createdAt: timestamp,
            updatedAt: timestamp,
            bitlyPayload: { source: "utm_csv_import" }
          });
        }
        if (this.linkAuditRepository) {
          try {
            await this.linkAuditRepository.record({
              fingerprint,
              requestId,
              action: "imported",
              actorUserId: sourceUserId,
              actorUserName: sourceUserName,
              summary: `${values.client} · ${values.utmCampaign || "campaign"} → ${values.destinationUrl}`,
              createdAt: timestamp
            });
          } catch {
            // Audit logging is best-effort.
          }
        }
        summary.imported += 1;
      } catch (error) {
        summary.failed += 1;
        if (summary.errors.length < 20) {
          summary.errors.push({ row: index + 2, message: error.message });
        }
      }
    }

    return { ok: true, summary };
  }
}

function normalizeRow(row) {
  return {
    client: text(row.client),
    channel: text(row.channel) || "Imported",
    assetType: text(row.asset_type) || "link",
    campaignLabel: text(row.campaign_label) || text(row.utm_campaign),
    canonicalCampaign: text(row.canonical_campaign) || text(row.utm_campaign),
    utmSource: text(row.utm_source),
    utmMedium: text(row.utm_medium),
    utmCampaign: text(row.utm_campaign),
    utmTerm: text(row.utm_term),
    utmContent: text(row.utm_content),
    destinationUrl: text(row.destination_url),
    finalLongUrl: text(row.final_long_url),
    shortUrl: text(row.short_url),
    qrUrl: text(row.qr_url)
  };
}

function buildNormalizedPayload(values) {
  return {
    client: values.client,
    client_display_name: values.client,
    channel: values.channel,
    channel_display_name: values.channel,
    asset_type: values.assetType,
    campaign_label: values.campaignLabel,
    canonical_campaign: values.canonicalCampaign,
    destination_url: values.destinationUrl,
    normalized_destination_url: values.normalizedDestinationUrl,
    utm_source: values.utmSource,
    utm_medium: values.utmMedium,
    utm_campaign: values.utmCampaign,
    utm_term: values.utmTerm,
    utm_content: values.utmContent,
    final_long_url: values.finalLongUrl,
    needs_qr: Boolean(values.qrUrl),
    confidence: 1,
    warnings: []
  };
}

function buildIdentityShape(values) {
  return {
    normalizedDestinationUrl: values.normalizedDestinationUrl,
    utmSource: values.utmSource,
    utmMedium: values.utmMedium,
    utmCampaign: values.utmCampaign,
    canonicalCampaign: values.canonicalCampaign,
    utmTerm: values.utmTerm,
    utmContent: values.utmContent
  };
}

function createFingerprint(values) {
  return crypto.createHash("sha256").update(JSON.stringify({
    client: values.client.toLowerCase(),
    channel: values.channel.toLowerCase(),
    destination: values.destinationUrl,
    source: values.utmSource,
    medium: values.utmMedium,
    campaign: values.utmCampaign,
    term: values.utmTerm,
    content: values.utmContent
  })).digest("hex");
}

function parseCsv(value) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  const input = String(value ?? "").replace(/^\uFEFF/u, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/u, ""));
      if (record.some((entry) => entry !== "")) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  record.push(field.replace(/\r$/u, ""));
  if (record.some((entry) => entry !== "")) records.push(record);
  const headers = (records.shift() ?? []).map((header) => text(header).toLowerCase());
  return {
    headers,
    rows: records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
  };
}

function text(value) {
  return String(value ?? "").trim();
}

function validIso(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function failure(code, message) {
  return { ok: false, code, message };
}
