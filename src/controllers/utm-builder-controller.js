import { NodeResponse } from "../http/response.js";
import { ParsedLinkRequest } from "../domain/parsed-link-request.js";
import { buildGuidedBuilderValidation } from "../services/guided-builder-validation-service.js";
import { renderUtmBuilderHtml } from "../views/utm-builder-view.js";

export class UtmBuilderController {
  constructor({
    utmLibraryEditorService,
    utmLibraryService = null,
    rulesService,
    requestNormalizer,
    utmIntelligenceService,
    utmValueAcknowledgementRepository = null,
    standalone = false
  }) {
    this.utmLibraryEditorService = utmLibraryEditorService;
    this.utmLibraryService = utmLibraryService;
    this.rulesService = rulesService;
    this.requestNormalizer = requestNormalizer;
    this.utmIntelligenceService = utmIntelligenceService;
    this.utmValueAcknowledgementRepository = utmValueAcknowledgementRepository;
    this.standalone = standalone;
  }

  async handleHtml(request = {}) {
    const duplicateRequestId = positiveInteger(request?.query?.duplicate_request_id, null);
    const duplicateItem = duplicateRequestId
      ? await this.utmLibraryService?.getByRequestIdAsync?.(duplicateRequestId)
      : null;
    if (duplicateRequestId && !duplicateItem) {
      return NodeResponse.text("The link selected for duplication was not found.", 404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
    }
    const view = {
      clients: this.rulesService.clients()
        .map((clientKey) => ({
          key: clientKey,
          displayName: this.rulesService.getClientDisplayName(clientKey),
          guidance: this.rulesService.getClientGuidance(clientKey)
        }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
      channels: this.rulesService.createChannelCatalog()
        .map((channel) => ({
          key: channel.key,
          displayName: channel.displayName,
          requiresQr: channel.requiresQr,
          utmDefaults: channel.utmDefaults ?? {},
          hint: buildChannelHint(channel)
        }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
      mode: duplicateItem ? "duplicate" : "create",
      standalone: this.standalone,
      user: request?.user ?? null,
      formDefaults: buildFormDefaults(duplicateItem, { duplicate: Boolean(duplicateItem) })
    };

    return NodeResponse.text(renderUtmBuilderHtml(view), 200, {
      "Content-Type": "text/html; charset=utf-8"
    });
  }

  async handleCreate(request) {
    const parsedBody = request.parseJson();
    if (!parsedBody.ok) {
      return this.badRequest(parsedBody.errorCode, parsedBody.errorMessage);
    }

    const result = await this.utmLibraryEditorService.create(parsedBody.value, request.user);
    if (!result.ok) {
      return NodeResponse.json({
        status: "error",
        error: {
          code: result.code,
          message: result.message,
          warnings: result.warnings ?? [],
          missing_fields: result.missingFields ?? [],
          existing: result.existing ?? null,
          consistency_warnings: result.consistencyWarnings ?? [],
          consistency_warning_fingerprint: result.consistencyWarningFingerprint ?? null
        }
      }, result.statusCode ?? 500);
    }

    const shortLinkUnavailable = result.status === "completed_without_short_link";
    return NodeResponse.json({
      status: "ok",
      request_id: result.requestId,
      library_url: `/utms?${buildQueryString({
        highlight_request_id: result.requestId,
        toast: shortLinkUnavailable
          ? `Tracked link saved. ${result.degradedMessage}`
          : result.result.reusedExisting
          ? "Tracked link saved. A matching short link already existed, so it was reused."
          : "Tracked link saved.",
        toast_level: shortLinkUnavailable ? "warning" : "success"
      })}`,
      result: serializeResult(result)
    });
  }

  async handleMetadata(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    return NodeResponse.json({
      status: "ok",
      metadata: this.utmIntelligenceService.metadata(request.query)
    });
  }

  async handleSuggestions(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    return NodeResponse.json({
      status: "ok",
      ...this.utmIntelligenceService.suggestions(request.query)
    });
  }

  async handleCounts(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    return NodeResponse.json({
      status: "ok",
      ...this.utmIntelligenceService.counts(request.query)
    });
  }

  async handleHistory(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    return NodeResponse.json({
      status: "ok",
      ...this.utmIntelligenceService.similarHistory(request.query)
    });
  }

  async handleLastYear(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    return NodeResponse.json({
      status: "ok",
      ...this.utmIntelligenceService.previousYearMatches(request.query)
    });
  }

  async handleComboStats(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    return NodeResponse.json({
      status: "ok",
      ...this.utmIntelligenceService.combinationStats(request.query)
    });
  }

  async handleContext(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    const acknowledgements = await this.loadAcknowledgements();
    const context = this.utmIntelligenceService.context(request.query);
    context.consistency = this.utmIntelligenceService.consistencyAnalysis(request.query, acknowledgements);
    return NodeResponse.json({
      status: "ok",
      ...context
    });
  }

  async handlePreview(request) {
    await this.utmIntelligenceService.refreshDataAsync?.();
    const parsedBody = request.parseJson();
    if (!parsedBody.ok) {
      return this.badRequest(parsedBody.errorCode, parsedBody.errorMessage);
    }

    const preview = this.buildPreview(parsedBody.value, await this.loadAcknowledgements());
    if (!preview.ok) {
      const guidedValidation = buildGuidedBuilderValidation(preview, parsedBody.value);
      return NodeResponse.json({
        status: "error",
        error: {
          code: preview.code,
          message: guidedValidation.message,
          warnings: guidedValidation.warnings,
          missing_fields: guidedValidation.missingFields
        }
      }, 422);
    }

    return NodeResponse.json({
      status: "ok",
      preview: preview.value
    });
  }

  buildPreview(input = {}, acknowledgements = []) {
    const parsed = ParsedLinkRequest.fromObject({
      client: normalizeOptional(input.client),
      channel: normalizeOptional(input.channel),
      campaign_label: normalizeOptional(input.campaign_label),
      utm_source: normalizeNullable(input.utm_source),
      utm_medium: normalizeNullable(input.utm_medium),
      utm_campaign: normalizeNullable(input.utm_campaign),
      utm_term: normalizeNullable(input.utm_term),
      utm_content: normalizeNullable(input.utm_content),
      destination_url: normalizeOptional(input.destination_url),
      needs_qr: Boolean(input.needs_qr),
      confidence: 1,
      warnings: [],
      missing_fields: []
    }, "utm_builder_preview");

    const decision = this.requestNormalizer.normalize(parsed);
    if (decision.status !== "ready" || !decision.normalizedRequest) {
      return {
        ok: false,
        code: "preview_not_ready",
        message: decision.message,
        warnings: decision.warnings,
        missingFields: decision.missingFields
      };
    }

    return {
      ok: true,
      value: this.utmIntelligenceService.previewFromNormalized(decision.normalizedRequest, input, acknowledgements)
    };
  }

  async loadAcknowledgements() {
    if (!this.utmValueAcknowledgementRepository) return [];
    return await (this.utmValueAcknowledgementRepository.listAsync?.()
      ?? this.utmValueAcknowledgementRepository.list?.()
      ?? []);
  }

  badRequest(code, message) {
    return NodeResponse.json({
      status: "error",
      error: { code, message }
    }, 400);
  }
}

function serializeResult(result) {
  const normalized = result.normalized;
  return {
    request_id: result.requestId,
    fingerprint: result.fingerprint ?? null,
    status: result.status,
    status_label: result.status === "completed_without_short_link" ? "Saved without short link" : "Saved",
    message: "Tracked link ready",
    client: normalized.client,
    client_display_name: normalized.clientDisplayName,
    channel: normalized.channel,
    channel_display_name: normalized.channelDisplayName,
    tracked_url: normalized.finalLongUrl,
    short_url: result.result.shortUrl,
    qr_url: result.result.qrUrl,
    destination_url: normalized.destinationUrl,
    utm_source: normalized.utmSource,
    utm_medium: normalized.utmMedium,
    utm_campaign: normalized.utmCampaign,
    utm_term: normalized.utmTerm,
    utm_content: normalized.utmContent,
    warnings: normalized.warnings,
    short_link_warning: result.degradedMessage ?? null,
    degradation_reason: result.degradedReason ?? null,
    reused_existing: result.result.reusedExisting,
    library_url: `/utms?${buildQueryString({ highlight_request_id: result.requestId })}`
  };
}

function buildFormDefaults(item, { duplicate = false } = {}) {
  if (!item) {
    return {
      original_request_id: "",
      duplicated_from_request_id: "",
      client: "",
      destination_url: "",
      needs_qr: false,
      utm_campaign: "",
      utm_source: "",
      utm_medium: "",
      utm_term: "",
      utm_content: "",
      campaign_label: ""
    };
  }

  return {
    original_request_id: duplicate ? "" : String(item.requestId),
    duplicated_from_request_id: duplicate ? String(item.requestId) : "",
    client: item.client ?? "",
    destination_url: item.destinationUrl ?? "",
    needs_qr: Boolean(item.hasQr),
    utm_campaign: item.utmCampaign ?? "",
    utm_source: item.utmSource ?? "",
    utm_medium: item.utmMedium ?? "",
    utm_term: item.utmTerm ?? "",
    utm_content: item.utmContent ?? "",
    campaign_label: item.campaignLabel ?? ""
  };
}

function buildQueryString(query) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    params.set(key, String(value));
  });
  return params.toString();
}

function buildChannelHint(channel) {
  const defaults = channel.utmDefaults ?? {};
  const parts = [];
  if (defaults.source) {
    parts.push(`Source: ${defaults.source}`);
  }
  if (defaults.medium) {
    parts.push(`Medium: ${defaults.medium}`);
  }
  parts.push(defaults.campaign ? `Campaign: ${defaults.campaign}` : "Campaign: resolved automatically");
  if (channel.requiresQr) {
    parts.push("QR: automatic");
  }
  return parts.join(" | ");
}

function normalizeOptional(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizeNullable(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value).trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
