import crypto from "node:crypto";
import { ParsedLinkRequest } from "../domain/parsed-link-request.js";
import { buildGuidedBuilderValidation } from "./guided-builder-validation-service.js";

export class UtmLibraryEditorService {
  constructor({
    requestRepository,
    requestNormalizer,
    fingerprintService,
    linkGenerationService,
    generatedLinkRepository,
    linkAuditRepository = null,
    utmIntelligenceService = null,
    utmValueAcknowledgementRepository = null
  }) {
    this.requestRepository = requestRepository;
    this.requestNormalizer = requestNormalizer;
    this.fingerprintService = fingerprintService;
    this.linkGenerationService = linkGenerationService;
    this.generatedLinkRepository = generatedLinkRepository;
    this.linkAuditRepository = linkAuditRepository;
    this.utmIntelligenceService = utmIntelligenceService;
    this.utmValueAcknowledgementRepository = utmValueAcknowledgementRepository;
  }

  async regenerate(input = {}, actor = null) {
    return this.submit(input, {
      requestSource: "utm_library_editor",
      sourceUserId: actorSourceId(actor, "utm_library"),
      sourceUserName: actorSourceName(actor, "UTM Library"),
      messageLabel: "Library editor update",
      actor
    });
  }

  async create(input = {}, actor = null) {
    return this.submit(input, {
      requestSource: "utm_builder",
      sourceUserId: actorSourceId(actor, "utm_builder"),
      sourceUserName: actorSourceName(actor, "UTM Builder"),
      messageLabel: "Builder form submission",
      actor
    });
  }

  async deleteEntry(input = {}, actor = null) {
    const requestId = positiveInteger(input.request_id ?? input.original_request_id, null);
    if (!requestId) {
      return {
        ok: false,
        statusCode: 422,
        code: "missing_request_id",
        message: "Select a valid UTM entry to remove."
      };
    }

    const existing = await (this.requestRepository.findByIdAsync?.(requestId)
      ?? this.requestRepository.findById(requestId));
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: "request_not_found",
        message: "That UTM entry no longer exists."
      };
    }

    const fingerprint = normalizeOptional(existing.fingerprint);
    const deletedRequests = fingerprint
      ? await (this.requestRepository.deleteByFingerprintAsync?.(fingerprint)
        ?? this.requestRepository.deleteByFingerprint(fingerprint))
      : await (this.requestRepository.deleteByRequestUuidAsync?.(existing.request_uuid)
        ?? this.requestRepository.deleteByRequestUuid(existing.request_uuid));

    if (fingerprint && (await (this.requestRepository.countByFingerprintAsync?.(fingerprint)
      ?? this.requestRepository.countByFingerprint(fingerprint))) === 0) {
      await (this.generatedLinkRepository.deleteByFingerprintAsync?.(fingerprint)
        ?? this.generatedLinkRepository.deleteByFingerprint(fingerprint));
    }

    await this.recordAudit({
      fingerprint,
      requestId,
      action: "deleted",
      actor,
      sourceUserId: actorSourceId(actor, "utm_library"),
      sourceUserName: actorSourceName(actor, "UTM Library"),
      summary: `Deleted saved link (${deletedRequests} version${deletedRequests === 1 ? "" : "s"} removed).`
    });

    return {
      ok: true,
      requestId,
      deletedRequests
    };
  }

  async recordSubmitAudit(context, input, normalized, fingerprint, requestId, acceptedConsistencyWarnings = []) {
    const action = input.duplicated_from_request_id
      ? "duplicated"
      : input.original_request_id
        ? "regenerated"
        : "created";
    await this.recordAudit({
      fingerprint,
      requestId,
      action,
      actor: context.actor,
      sourceUserId: context.sourceUserId,
      sourceUserName: context.sourceUserName,
      summary: `${normalized.clientDisplayName} · ${normalized.utmCampaign || normalized.canonicalCampaign || "campaign"} → ${normalized.destinationUrl}`
    });
    if (acceptedConsistencyWarnings.length) {
      await this.recordAudit({
        fingerprint,
        requestId,
        action: "consistency_override",
        actor: context.actor,
        sourceUserId: context.sourceUserId,
        sourceUserName: context.sourceUserName,
        summary: acceptedConsistencyWarnings.map((warning) => warning.message).join(" | ")
      });
    }
  }

  async recordAudit({ fingerprint = null, requestId = null, action, actor = null, sourceUserId = null, sourceUserName = null, summary = null }) {
    if (!this.linkAuditRepository) {
      return;
    }
    try {
      await this.linkAuditRepository.record({
        fingerprint,
        requestId,
        action,
        actorUserId: sourceUserId,
        actorUserName: actor?.displayName ?? sourceUserName,
        summary
      });
    } catch {
      // Audit logging is best-effort and must never block the main workflow.
    }
  }

  async submit(input = {}, context) {
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
    }, context.requestSource, {
      original_request_id: input.original_request_id ?? null
    });

    const decision = this.requestNormalizer.normalize(parsed);
    if (decision.status === "clarify" || !decision.normalizedRequest) {
      const guidedValidation = context.requestSource === "utm_builder"
        ? buildGuidedBuilderValidation(decision, input)
        : null;
      return {
        ok: false,
        statusCode: 422,
        code: "validation_failed",
        message: guidedValidation?.message ?? decision.message,
        warnings: guidedValidation?.warnings ?? decision.warnings,
        missingFields: guidedValidation?.missingFields ?? decision.missingFields
      };
    }

    const normalized = decision.normalizedRequest;
    const fingerprint = this.fingerprintService.generate(normalized);
    const utmIdentityKey = this.fingerprintService.generateUtmIdentity(normalized);
    const existingDuplicate = await this.requestRepository.findExactUtmDuplicateAsync(normalized);
    if (existingDuplicate) {
      return duplicateFailure(existingDuplicate);
    }
    const consistency = await this.analyzeConsistency(normalized);
    if (consistency.requires_confirmation && input.consistency_warning_fingerprint !== consistency.fingerprint) {
      return {
        ok: false,
        statusCode: 409,
        code: "consistency_confirmation_required",
        message: "Review these unfamiliar UTM values and combinations before creating the link.",
        consistencyWarnings: consistency.warnings,
        consistencyWarningFingerprint: consistency.fingerprint
      };
    }
    const acceptedConsistencyWarnings = consistency.warnings.filter((warning) => warning.requires_confirmation);
    if (acceptedConsistencyWarnings.length) {
      normalized.warnings = [...new Set([...normalized.warnings, ...acceptedConsistencyWarnings.map((warning) => warning.message)])];
    }
    const timestamp = new Date().toISOString();
    const requestId = await (this.requestRepository.createIncomingAsync?.({
      requestUuid: crypto.randomUUID(),
      deliveryKey: `utm-library:${crypto.randomUUID()}`,
      status: "received",
      originalMessage: buildOriginalMessage(normalized, context.messageLabel, input.original_request_id),
      rawPayload: {
        source: context.requestSource,
        original_request_id: input.original_request_id ?? null,
        duplicated_from_request_id: input.duplicated_from_request_id ?? null,
        consistency_warning_fingerprint: input.consistency_warning_fingerprint ?? null,
        accepted_consistency_warnings: acceptedConsistencyWarnings,
        submitted_values: {
          client: input.client ?? null,
          channel: input.channel ?? null,
          campaign_label: input.campaign_label ?? null,
          utm_source: input.utm_source ?? null,
          utm_medium: input.utm_medium ?? null,
          utm_campaign: input.utm_campaign ?? null,
          utm_term: input.utm_term ?? null,
          utm_content: input.utm_content ?? null,
          destination_url: input.destination_url ?? null,
          needs_qr: Boolean(input.needs_qr)
        }
      },
      sourceUserId: context.sourceUserId,
      sourceUserName: context.sourceUserName,
      createdAt: timestamp,
      updatedAt: timestamp
    }) ?? this.requestRepository.createIncoming({
      requestUuid: crypto.randomUUID(),
      deliveryKey: `utm-library:${crypto.randomUUID()}`,
      status: "received",
      originalMessage: buildOriginalMessage(normalized, context.messageLabel, input.original_request_id),
      rawPayload: {
        source: context.requestSource,
        original_request_id: input.original_request_id ?? null,
        duplicated_from_request_id: input.duplicated_from_request_id ?? null,
        consistency_warning_fingerprint: input.consistency_warning_fingerprint ?? null,
        accepted_consistency_warnings: acceptedConsistencyWarnings,
        submitted_values: {
          client: input.client ?? null,
          channel: input.channel ?? null,
          campaign_label: input.campaign_label ?? null,
          utm_source: input.utm_source ?? null,
          utm_medium: input.utm_medium ?? null,
          utm_campaign: input.utm_campaign ?? null,
          utm_term: input.utm_term ?? null,
          utm_content: input.utm_content ?? null,
          destination_url: input.destination_url ?? null,
          needs_qr: Boolean(input.needs_qr)
        }
      },
      sourceUserId: context.sourceUserId,
      sourceUserName: context.sourceUserName,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    await (this.requestRepository.updateAsync?.(requestId, {
      status: "parsed",
      parsed_payload: parsed.toJSON(),
      warnings: parsed.warnings,
      missing_fields: parsed.missingFields
    }) ?? this.requestRepository.update(requestId, {
      status: "parsed",
      parsed_payload: parsed.toJSON(),
      warnings: parsed.warnings,
      missing_fields: parsed.missingFields
    }));

    try {
      await (this.requestRepository.updateAsync?.(requestId, {
        status: "normalized",
        normalized_payload: normalized.toJSON(),
        fingerprint,
        utm_identity_key: utmIdentityKey,
        final_long_url: normalized.finalLongUrl
      }) ?? this.requestRepository.update(requestId, {
        status: "normalized",
        normalized_payload: normalized.toJSON(),
        fingerprint,
        utm_identity_key: utmIdentityKey,
        final_long_url: normalized.finalLongUrl
      }));
    } catch (error) {
      const raceDuplicate = await this.requestRepository.findExactUtmDuplicateAsync(normalized);
      if (!raceDuplicate || Number(raceDuplicate.id) === Number(requestId)) {
        throw error;
      }
      await this.requestRepository.deleteByIdAsync(requestId);
      return duplicateFailure(raceDuplicate);
    }

    try {
      const generation = await this.linkGenerationService.generate(normalized, fingerprint);

      if (generation.degraded) {
        const warnings = [
          ...new Set([
            ...normalized.warnings,
            generation.degradedMessage
          ])
        ];
        normalized.warnings = warnings;

        await (this.requestRepository.updateAsync?.(requestId, {
          status: "completed_without_short_link",
          normalized_payload: normalized.toJSON(),
          qr_url: generation.result.qrUrl,
          warnings,
          reused_existing: generation.result.reusedExisting ? 1 : 0,
          error_code: generation.degradedReason,
          error_message: generation.degradedMessage
        }) ?? this.requestRepository.update(requestId, {
          status: "completed_without_short_link",
          normalized_payload: normalized.toJSON(),
          qr_url: generation.result.qrUrl,
          warnings,
          reused_existing: generation.result.reusedExisting ? 1 : 0,
          error_code: generation.degradedReason,
          error_message: generation.degradedMessage
        }));

        await this.recordSubmitAudit(context, input, normalized, fingerprint, requestId, acceptedConsistencyWarnings);

        return {
          ok: true,
          requestId,
          fingerprint,
          status: "completed_without_short_link",
          normalized,
          result: generation.result,
          degradedReason: generation.degradedReason,
          degradedMessage: generation.degradedMessage
        };
      }

      await (this.requestRepository.updateAsync?.(requestId, {
        status: "completed",
        normalized_payload: normalized.toJSON(),
        short_url: generation.result.shortUrl,
        bitly_id: generation.bitlyId,
        bitly_payload: generation.bitlyPayload,
        qr_url: generation.result.qrUrl,
        reused_existing: generation.result.reusedExisting ? 1 : 0
      }) ?? this.requestRepository.update(requestId, {
        status: "completed",
        normalized_payload: normalized.toJSON(),
        short_url: generation.result.shortUrl,
        bitly_id: generation.bitlyId,
        bitly_payload: generation.bitlyPayload,
        qr_url: generation.result.qrUrl,
        reused_existing: generation.result.reusedExisting ? 1 : 0
      }));

      await this.recordSubmitAudit(context, input, normalized, fingerprint, requestId, acceptedConsistencyWarnings);

      return {
        ok: true,
        requestId,
        fingerprint,
        status: "completed",
        normalized,
        result: generation.result
      };
    } catch (error) {
      await (this.requestRepository.updateAsync?.(requestId, {
        status: "failed",
        error_code: "utm_library_regeneration_failed",
        error_message: error.message
      }) ?? this.requestRepository.update(requestId, {
        status: "failed",
        error_code: "utm_library_regeneration_failed",
        error_message: error.message
      }));

      return {
        ok: false,
        statusCode: 500,
        code: "utm_library_regeneration_failed",
        message: "Unable to regenerate this link right now."
      };
    }
  }

  async analyzeConsistency(normalized) {
    if (!this.utmIntelligenceService) {
      return { warnings: [], requires_confirmation: false, fingerprint: null };
    }
    await this.utmIntelligenceService.refreshDataAsync?.();
    const acknowledgements = this.utmValueAcknowledgementRepository
      ? await (this.utmValueAcknowledgementRepository.listAsync?.() ?? this.utmValueAcknowledgementRepository.list?.() ?? [])
      : [];
    return this.utmIntelligenceService.consistencyAnalysis({
      client: normalized.client,
      campaign: normalized.utmCampaign,
      source: normalized.utmSource,
      medium: normalized.utmMedium,
      term: normalized.utmTerm,
      content: normalized.utmContent
    }, acknowledgements);
  }
}

function actorSourceId(actor, fallback) {
  return actor?.id ? `user:${actor.id}` : fallback;
}

function actorSourceName(actor, fallback) {
  return actor?.displayName || fallback;
}

function buildOriginalMessage(normalized, messageLabel, originalRequestId) {
  const parts = [
    `${messageLabel}${originalRequestId ? ` from request #${originalRequestId}` : ""}`,
    `Client: ${normalized.clientDisplayName}`,
    `Channel: ${normalized.channelDisplayName}`,
    `Campaign: ${normalized.utmCampaign}`,
    `Destination: ${normalized.destinationUrl}`
  ];

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

function duplicateFailure(existing) {
  const normalized = safeJsonObject(existing.normalized_payload);
  return {
    ok: false,
    statusCode: 409,
    code: "duplicate_utm",
    message: "This destination URL already has a link with the same five UTM values.",
    existing: {
      request_id: Number(existing.id),
      tracked_url: existing.final_long_url ?? normalized.final_long_url ?? "",
      short_url: existing.short_url ?? "",
      library_url: `/utms?highlight_request_id=${encodeURIComponent(String(existing.id))}`
    }
  };
}

function safeJsonObject(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
