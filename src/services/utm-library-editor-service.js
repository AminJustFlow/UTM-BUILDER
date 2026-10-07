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
    utmValueAcknowledgementRepository = null,
    qrCodeService = null,
    logger = null
  }) {
    this.requestRepository = requestRepository;
    this.requestNormalizer = requestNormalizer;
    this.fingerprintService = fingerprintService;
    this.linkGenerationService = linkGenerationService;
    this.generatedLinkRepository = generatedLinkRepository;
    this.linkAuditRepository = linkAuditRepository;
    this.utmIntelligenceService = utmIntelligenceService;
    this.utmValueAcknowledgementRepository = utmValueAcknowledgementRepository;
    this.qrCodeService = qrCodeService;
    this.logger = logger;
  }

  async regenerate(input = {}, actor = null) {
    const validated = await this.validateQrProjectInput(input);
    if (!validated.ok) return validated;
    return this.submit(validated.input, {
      requestSource: "utm_library_editor",
      sourceUserId: actorSourceId(actor, "utm_library"),
      sourceUserName: actorSourceName(actor, "UTM Library"),
      messageLabel: "Library editor update",
      actor
    });
  }

  async create(input = {}, actor = null) {
    const validated = await this.validateQrProjectInput(input);
    if (!validated.ok) return validated;
    return this.submit(validated.input, {
      requestSource: "utm_builder",
      sourceUserId: actorSourceId(actor, "utm_builder"),
      sourceUserName: actorSourceName(actor, "UTM Builder"),
      messageLabel: "Builder form submission",
      actor
    });
  }

  async editVersion(input = {}, actor = null) {
    if (actor?.role !== "admin") return { ok: false, statusCode: 403, code: "forbidden", message: "Administrator access is required." };
    const originalRequestId = positiveInteger(input.original_request_id, null);
    const existing = originalRequestId ? await this.requestRepository.findByIdAsync(originalRequestId) : null;
    if (!existing || existing.archived_at) return { ok: false, statusCode: 404, code: "request_not_found", message: "That active library link was not found." };
    await this.utmIntelligenceService?.refreshDataAsync?.();
    const parsed = ParsedLinkRequest.fromObject({
      client: normalizeOptional(input.client), channel: normalizeOptional(input.channel), campaign_label: normalizeOptional(input.campaign_label),
      utm_source: normalizeNullable(input.utm_source), utm_medium: normalizeNullable(input.utm_medium), utm_campaign: normalizeNullable(input.utm_campaign),
      utm_term: normalizeNullable(input.utm_term), utm_content: normalizeNullable(input.utm_content), destination_url: normalizeOptional(input.destination_url),
      needs_qr: false, external_domain: Object.prototype.hasOwnProperty.call(input, "external_domain") ? Boolean(input.external_domain) : undefined,
      confidence: 1, warnings: [], missing_fields: []
    }, "utm_library_admin_editor", { original_request_id: originalRequestId });
    const decision = this.requestNormalizer.normalize(parsed);
    if (!decision.normalizedRequest) return { ok: false, statusCode: 422, code: "validation_failed", message: decision.message, warnings: decision.warnings, missingFields: decision.missingFields };
    const normalized = decision.normalizedRequest;
    if (normalizeOptional(input.channel)) {
      normalized.channel = normalizeOptional(input.channel);
      normalized.channelDisplayName = normalizeOptional(input.channel);
    }
    if (normalizeOptional(input.asset_type)) normalized.assetType = normalizeOptional(input.asset_type);
    const fingerprint = this.fingerprintService.generate(normalized);
    const identityKey = this.fingerprintService.generateUtmIdentity(normalized);
    const oldFingerprint = normalizeOptional(existing.fingerprint);
    const duplicate = await this.requestRepository.findExactUtmDuplicateAsync(normalized);
    if (duplicate && normalizeOptional(duplicate.fingerprint) !== oldFingerprint) return duplicateFailure(duplicate);

    const oldPayload = safeJsonObject(existing.normalized_payload);
    const oldTrackedUrl = normalizeOptional(existing.final_long_url ?? oldPayload.final_long_url) ?? "";
    const oldShortUrl = normalizeOptional(existing.short_url) ?? "";
    const oldQrUrl = normalizeOptional(existing.qr_url);
    const bitlyAction = ["repoint", "manual", "generate"].includes(input.bitly_action) ? input.bitly_action : "repoint";
    const qrAction = ["keep", "upload", "remove"].includes(input.qr_action) ? input.qr_action : "keep";
    let shortUrl = oldShortUrl;
    let bitlyId = existing.bitly_id ?? null;
    let bitlyPayload = safeJsonObject(existing.bitly_payload);
    let repointed = false;
    let generatedNewBitly = false;
    let uploadedRevision = null;
    const trackedChanged = oldTrackedUrl !== normalized.finalLongUrl;

    if (qrAction === "keep" && oldQrUrl && (["manual", "generate"].includes(bitlyAction) || (!oldShortUrl && trackedChanged))) {
      return { ok: false, statusCode: 422, code: "stale_qr", message: "Upload a replacement QR PDF or remove the QR because its destination would become stale." };
    }

    if (bitlyAction === "manual") {
      shortUrl = validHttpUrl(input.manual_short_url);
      if (!shortUrl) return { ok: false, statusCode: 422, code: "invalid_short_url", message: "Enter a valid HTTP or HTTPS replacement Bitly URL." };
      const owner = await this.generatedLinkRepository.findByShortUrlAsync(shortUrl);
      if (owner && normalizeOptional(owner.fingerprint) !== oldFingerprint) return { ok: false, statusCode: 409, code: "short_url_conflict", message: "That short URL already belongs to another active link." };
      bitlyId = null; bitlyPayload = { source: "admin_manual_replacement" };
    } else if (bitlyAction === "generate") {
      try {
        const generated = await this.linkGenerationService.bitlyService.shorten(normalized.finalLongUrl);
        shortUrl = generated.link; bitlyId = generated.id; bitlyPayload = generated.payload;
        generatedNewBitly = true;
      } catch (error) { return assetFailure("bitly_generation_failed", error); }
    } else if (oldShortUrl && trackedChanged) {
      try {
        const updated = await this.linkGenerationService.bitlyService.updateDestination({ bitlyId, shortUrl: oldShortUrl, longUrl: normalized.finalLongUrl });
        shortUrl = updated.link || oldShortUrl; bitlyId = updated.id ?? bitlyId; bitlyPayload = updated.payload ?? bitlyPayload; repointed = true;
      } catch (error) { return assetFailure("bitly_repoint_failed", error); }
    }

    if (qrAction === "keep" && oldQrUrl) {
      const changedBitly = bitlyAction === "manual" || bitlyAction === "generate";
      const staleDirectQr = !oldShortUrl && trackedChanged;
      if (changedBitly || staleDirectQr) {
        if (repointed) await this.compensateBitly(existing, oldTrackedUrl);
        return { ok: false, statusCode: 422, code: "stale_qr", message: "Upload a replacement QR PDF or remove the QR because its destination would become stale." };
      }
    }

    let qrUrl = qrAction === "remove" ? null : oldQrUrl;
    if (qrAction === "upload") {
      uploadedRevision = crypto.randomUUID();
      try {
        qrUrl = (await this.qrCodeService.storeUploadedPdf({ fingerprint, revision: uploadedRevision, base64: input.qr_pdf_base64, filename: input.qr_pdf_name })).qrUrl;
      } catch (error) {
        if (repointed) await this.compensateBitly(existing, oldTrackedUrl);
        if (generatedNewBitly) await this.linkGenerationService.bitlyService.archive({ bitlyId, shortUrl }).catch(() => {});
        return assetFailure(error.code ?? "qr_upload_failed", error);
      }
    }

    const timestamp = new Date().toISOString();
    const database = this.requestRepository.database;
    const activeVersions = oldFingerprint
      ? await database.allAsync("SELECT id FROM requests WHERE fingerprint=:fingerprint AND archived_at IS NULL", { fingerprint: oldFingerprint })
      : [{ id: originalRequestId }];
    const targetGeneratedBefore = await this.generatedLinkRepository.findByFingerprintAsync(fingerprint);
    const oldGeneratedBefore = oldFingerprint !== fingerprint ? await this.generatedLinkRepository.findByFingerprintAsync(oldFingerprint) : targetGeneratedBefore;
    let createdGenerated = false;
    let requestId = null;
    try {
      for (const row of activeVersions) await database.runAsync("UPDATE requests SET archived_at=:at, archived_by_user_id=:user_id, archived_by_name=:name, updated_at=:at WHERE id=:id", { at: timestamp, user_id: actor.id ?? null, name: actor.displayName ?? null, id: row.id });
      requestId = await this.requestRepository.createIncomingAsync({
        requestUuid: crypto.randomUUID(), deliveryKey: `utm-admin-edit:${crypto.randomUUID()}`, status: "received",
        originalMessage: buildOriginalMessage(normalized, "Admin library edit", originalRequestId),
        rawPayload: { source: "utm_library_admin_editor", original_request_id: originalRequestId, bitly_action: bitlyAction, qr_action: qrAction },
        sourceUserId: actorSourceId(actor, "utm_library_admin_editor"), sourceUserName: actorSourceName(actor, "UTM Library Admin"), dictionaryApproved: true,
        createdAt: timestamp, updatedAt: timestamp
      });
      await this.requestRepository.updateAsync(requestId, {
        status: shortUrl ? "completed" : "completed_without_short_link", parsed_payload: parsed.toJSON(), normalized_payload: normalized.toJSON(),
        fingerprint, utm_identity_key: identityKey, final_long_url: normalized.finalLongUrl, short_url: shortUrl || null,
        bitly_id: bitlyId, bitly_payload: bitlyPayload, qr_url: qrUrl, warnings: normalized.warnings, missing_fields: []
      });
      const generatedFields = {
        client: normalized.client, channel: normalized.channel, asset_type: normalized.assetType,
        normalized_destination_url: normalized.normalizedDestinationUrl, canonical_campaign: normalized.canonicalCampaign,
        utm_source: normalized.utmSource, utm_medium: normalized.utmMedium, utm_campaign: normalized.utmCampaign,
        utm_term: normalized.utmTerm, utm_content: normalized.utmContent, final_long_url: normalized.finalLongUrl,
        short_url: shortUrl || "", qr_url: qrUrl, bitly_id: bitlyId, bitly_payload: bitlyPayload, updated_at: timestamp
      };
      if (targetGeneratedBefore) await this.generatedLinkRepository.updateByFingerprintAsync(fingerprint, generatedFields);
      else {
        await this.generatedLinkRepository.createAsync({ fingerprint, client: normalized.client, channel: normalized.channel, assetType: normalized.assetType,
        normalizedDestinationUrl: normalized.normalizedDestinationUrl, canonicalCampaign: normalized.canonicalCampaign,
        utmSource: normalized.utmSource, utmMedium: normalized.utmMedium, utmCampaign: normalized.utmCampaign, utmTerm: normalized.utmTerm,
        utmContent: normalized.utmContent, finalLongUrl: normalized.finalLongUrl, shortUrl: shortUrl || "", qrUrl, bitlyId, bitlyPayload, createdAt: timestamp, updatedAt: timestamp });
        createdGenerated = true;
      }
      if (oldFingerprint !== fingerprint && bitlyAction === "repoint" && oldShortUrl) await this.generatedLinkRepository.updateByFingerprintAsync(oldFingerprint, { short_url: "", bitly_id: null, bitly_payload: {} });
      await this.recordAudit({ fingerprint, requestId, action: "admin_edited", actor, sourceUserId: actorSourceId(actor, "utm_library_admin_editor"), sourceUserName: actorSourceName(actor, "UTM Library Admin"),
        summary: JSON.stringify({ from_fingerprint: oldFingerprint || null, to_fingerprint: fingerprint,
          before: marketingSnapshot(oldPayload, existing), after: marketingSnapshot(normalized.toJSON(), { short_url: shortUrl, qr_url: qrUrl }),
          bitly_action: bitlyAction, qr_action: qrAction }) });
      this.utmIntelligenceService?.invalidateData?.();
      return { ok: true, requestId, fingerprint, status: shortUrl ? "completed" : "completed_without_short_link", normalized,
        result: { shortUrl: shortUrl || null, qrUrl, reusedExisting: false } };
    } catch (error) {
      if (requestId) await this.requestRepository.deleteByIdAsync(requestId).catch(() => {});
      for (const row of activeVersions) await database.runAsync("UPDATE requests SET archived_at=NULL, archived_by_user_id=NULL, archived_by_name=NULL WHERE id=:id", { id: row.id }).catch(() => {});
      if (createdGenerated) await this.generatedLinkRepository.deleteByFingerprintAsync(fingerprint).catch(() => {});
      else if (targetGeneratedBefore) await this.generatedLinkRepository.updateByFingerprintAsync(fingerprint, generatedRestoreFields(targetGeneratedBefore)).catch(() => {});
      if (oldFingerprint !== fingerprint && oldGeneratedBefore) await this.generatedLinkRepository.updateByFingerprintAsync(oldFingerprint, generatedRestoreFields(oldGeneratedBefore)).catch(() => {});
      if (uploadedRevision) await this.qrCodeService.removeUploadedRevision(fingerprint, uploadedRevision).catch(() => {});
      if (repointed) await this.compensateBitly(existing, oldTrackedUrl);
      if (generatedNewBitly) await this.linkGenerationService.bitlyService.archive({ bitlyId, shortUrl }).catch(() => {});
      return { ok: false, statusCode: 500, code: "edit_failed", message: "The replacement version could not be saved. The prior version remains active." };
    }
  }

  async compensateBitly(existing, oldTrackedUrl) {
    try { await this.linkGenerationService.bitlyService.updateDestination({ bitlyId: existing.bitly_id, shortUrl: existing.short_url, longUrl: oldTrackedUrl }); }
    catch (error) { this.logger?.error?.("Bitly edit compensation failed.", { error_message: error.message, short_url: existing.short_url }); }
  }

  async supplementAssets(input = {}, actor = null) {
    const requestId = positiveInteger(input.request_id, null);
    const generateShort = Boolean(input.generate_short);
    const generateQr = Boolean(input.generate_qr);
    if (!requestId || (!generateShort && !generateQr)) {
      return {
        ok: false,
        statusCode: 422,
        code: "invalid_asset_request",
        message: "Select a saved link and an asset to generate."
      };
    }
    const validated = await this.validateQrProjectInput({ ...input, needs_qr: generateQr });
    if (!validated.ok) return validated;

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
    let generatedLink = fingerprint
      ? await (this.generatedLinkRepository.findByFingerprintAsync?.(fingerprint)
        ?? this.generatedLinkRepository.findByFingerprint(fingerprint))
      : null;
    if (!fingerprint) {
      return {
        ok: false,
        statusCode: 422,
        code: "generated_link_not_found",
        message: "This saved link cannot be supplemented because its fingerprint is missing."
      };
    }

    if (!generatedLink) {
      const normalized = safeJsonObject(existing.normalized_payload);
      const finalLongUrl = normalizeOptional(existing.final_long_url ?? normalized.final_long_url);
      if (!finalLongUrl) {
        return {
          ok: false,
          statusCode: 422,
          code: "generated_link_not_found",
          message: "This saved link cannot be supplemented because its tracked URL is missing."
        };
      }
      const timestamp = new Date().toISOString();
      const seed = {
        fingerprint,
        client: normalized.client ?? "unknown",
        channel: normalized.channel ?? "unknown",
        assetType: normalized.asset_type ?? "link",
        normalizedDestinationUrl: normalized.normalized_destination_url ?? normalized.destination_url ?? finalLongUrl,
        canonicalCampaign: normalized.canonical_campaign ?? normalized.utm_campaign ?? "",
        utmSource: normalized.utm_source ?? "",
        utmMedium: normalized.utm_medium ?? "",
        utmCampaign: normalized.utm_campaign ?? "",
        utmTerm: normalized.utm_term ?? "",
        utmContent: normalized.utm_content ?? "",
        finalLongUrl,
        shortUrl: normalizeOptional(existing.short_url) ?? "",
        qrUrl: normalizeOptional(existing.qr_url),
        bitlyId: normalizeOptional(existing.bitly_id),
        bitlyPayload: safeJsonObject(existing.bitly_payload),
        createdAt: existing.created_at ?? timestamp,
        updatedAt: timestamp
      };
      try {
        await (this.generatedLinkRepository.createAsync?.(seed)
          ?? this.generatedLinkRepository.create(seed));
        generatedLink = {
          fingerprint,
          final_long_url: seed.finalLongUrl,
          short_url: seed.shortUrl,
          qr_url: seed.qrUrl,
          bitly_id: seed.bitlyId,
          bitly_payload: seed.bitlyPayload
        };
      } catch {
        generatedLink = await (this.generatedLinkRepository.findByFingerprintAsync?.(fingerprint)
          ?? this.generatedLinkRepository.findByFingerprint(fingerprint));
        if (!generatedLink) {
          return {
            ok: false,
            statusCode: 500,
            code: "generated_link_recovery_failed",
            message: "Unable to prepare this saved link for asset generation."
          };
        }
      }
    }

    let supplement;
    try {
      supplement = await this.linkGenerationService.supplement(generatedLink, {
        generateShort,
        generateQr,
        qrProjectId: validated.input.qr_project_id,
        qrProjectName: validated.input.qr_project_name
      });
    } catch {
      return {
        ok: false,
        statusCode: 500,
        code: "asset_generation_failed",
        message: "Unable to generate the requested asset right now."
      };
    }

    const requestFields = {};
    if (supplement.generatedShort) {
      const warnings = removeShortLinkWarnings(existing.warnings);
      requestFields.status = "completed";
      requestFields.short_url = supplement.shortUrl;
      requestFields.bitly_id = supplement.bitlyId;
      requestFields.bitly_payload = supplement.bitlyPayload;
      requestFields.error_code = null;
      requestFields.error_message = null;
      requestFields.warnings = warnings;
    }
    if (supplement.generatedQr) {
      requestFields.qr_url = supplement.qrUrl;
    }

    if (Object.keys(requestFields).length > 0) {
      await (this.requestRepository.updateAsync?.(requestId, requestFields)
        ?? this.requestRepository.update(requestId, requestFields));
      const generatedLabels = [
        supplement.generatedShort ? "short link" : "",
        supplement.generatedQr ? "QR code" : ""
      ].filter(Boolean);
      await this.recordAudit({
        fingerprint,
        requestId,
        action: "supplemented",
        actor,
        sourceUserId: actorSourceId(actor, "utm_library"),
        sourceUserName: actorSourceName(actor, "UTM Library"),
        summary: `Generated ${generatedLabels.join(" and ")} for the saved link.`
      });
    }

    if (supplement.degraded && !supplement.generatedQr) {
      return {
        ok: false,
        statusCode: 503,
        code: supplement.degradedReason,
        message: supplement.degradedMessage
      };
    }

    return {
      ok: true,
      requestId,
      shortUrl: supplement.shortUrl,
      qrUrl: supplement.qrUrl,
      generatedShort: supplement.generatedShort,
      generatedQr: supplement.generatedQr,
      alreadyPresent: !supplement.generatedShort && !supplement.generatedQr,
      warning: supplement.degradedMessage
    };
  }

  async archiveEntry(input = {}, actor = null) {
    const requestId = positiveInteger(input.request_id ?? input.original_request_id, null);
    if (!requestId) {
      return {
        ok: false,
        statusCode: 422,
        code: "missing_request_id",
        message: "Select a valid UTM entry to archive."
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
    const archivedRequests = fingerprint
      ? await this.requestRepository.setArchivedByFingerprintAsync(fingerprint, true, actor)
      : await this.requestRepository.setArchivedByRequestUuidAsync(existing.request_uuid, true, actor);

    await this.recordAudit({
      fingerprint,
      requestId,
      action: "archived",
      actor,
      sourceUserId: actorSourceId(actor, "utm_library"),
      sourceUserName: actorSourceName(actor, "UTM Library"),
      summary: `Archived saved link (${archivedRequests} version${archivedRequests === 1 ? "" : "s"} preserved).`
    });
    this.utmIntelligenceService?.invalidateData?.();

    return {
      ok: true,
      requestId,
      archivedRequests
    };
  }

  async restoreEntry(input = {}, actor = null) {
    const requestId = positiveInteger(input.request_id, null);
    const existing = requestId ? await (this.requestRepository.findByIdAsync?.(requestId) ?? this.requestRepository.findById(requestId)) : null;
    if (!existing) return { ok: false, statusCode: 404, code: "request_not_found", message: "That archived UTM entry no longer exists." };
    const fingerprint = normalizeOptional(existing.fingerprint);
    const restoredRequests = fingerprint
      ? await this.requestRepository.setArchivedByFingerprintAsync(fingerprint, false, actor)
      : await this.requestRepository.setArchivedByRequestUuidAsync(existing.request_uuid, false, actor);
    await this.recordAudit({ fingerprint, requestId, action: "restored", actor,
      sourceUserId: actorSourceId(actor, "utm_library"), sourceUserName: actorSourceName(actor, "UTM Library"),
      summary: `Restored saved link (${restoredRequests} version${restoredRequests === 1 ? "" : "s"}).` });
    this.utmIntelligenceService?.invalidateData?.();
    return { ok: true, requestId, restoredRequests };
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
    await this.utmIntelligenceService?.refreshDataAsync?.();
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
      external_domain: Object.prototype.hasOwnProperty.call(input, "external_domain") ? Boolean(input.external_domain) : undefined,
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
    const existingDuplicate = normalized.externalDomain
      ? null
      : await this.requestRepository.findExactUtmDuplicateAsync(normalized);
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
          needs_qr: Boolean(input.needs_qr),
          external_domain: normalized.externalDomain,
          qr_project_id: input.qr_project_id ?? null,
          qr_project_name: input.qr_project_name ?? null
        }
      },
      sourceUserId: context.sourceUserId,
      sourceUserName: context.sourceUserName,
      dictionaryApproved: context.actor?.role === "admin",
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
          needs_qr: Boolean(input.needs_qr),
          external_domain: normalized.externalDomain,
          qr_project_id: input.qr_project_id ?? null,
          qr_project_name: input.qr_project_name ?? null
        }
      },
      sourceUserId: context.sourceUserId,
      sourceUserName: context.sourceUserName,
      dictionaryApproved: context.actor?.role === "admin",
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
      const generation = await this.linkGenerationService.generate(normalized, fingerprint, {
        qrProjectId: input.qr_project_id,
        qrProjectName: input.qr_project_name
      });

      if (generation.degraded) {
        const warnings = [
          ...new Set([
            ...normalized.warnings,
            generation.degradedMessage,
            generation.qrWarning
          ])
        ].filter(Boolean);
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
        this.utmIntelligenceService?.invalidateData?.();

        return {
          ok: true,
          requestId,
          fingerprint,
          status: "completed_without_short_link",
          normalized,
          result: generation.result,
          degradedReason: generation.degradedReason,
          degradedMessage: generation.degradedMessage,
          qrWarning: generation.qrWarning
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
      this.utmIntelligenceService?.invalidateData?.();

      return {
        ok: true,
        requestId,
        fingerprint,
        status: "completed",
        normalized,
        result: generation.result,
        qrWarning: generation.qrWarning
      };
    } catch (error) {
      this.logger?.error?.("UTM link generation failed.", {
        request_id: requestId,
        error_name: error?.name ?? "Error",
        error_code: error?.code ?? null,
        error_message: error?.message ?? "Unknown generation failure"
      });
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
    if (normalized.externalDomain) {
      return { warnings: [], requires_confirmation: false, fingerprint: null };
    }
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
      content: normalized.utmContent,
      external_domain: normalized.externalDomain
    }, acknowledgements);
  }

  async validateQrProjectInput(input = {}) {
    if (!Boolean(input.needs_qr)) return { ok: true, input: { ...input, qr_project_id: null, qr_project_name: null } };
    const projectId = positiveInteger(input.qr_project_id, null);
    if (!projectId) return { ok: false, statusCode: 422, code: "qr_project_required", message: "Select a QR Stuff project before creating the QR code." };
    try {
      const project = await this.qrCodeService?.validateProject(projectId);
      if (!project) return { ok: false, statusCode: 422, code: "qr_project_invalid", message: "The selected QR Stuff project is no longer available." };
      return { ok: true, input: { ...input, qr_project_id: project.id, qr_project_name: project.name } };
    } catch (error) {
      this.logger?.warning?.("QR Stuff projects could not be verified.", { error_code: error?.code ?? null, status_code: error?.statusCode ?? null });
      return { ok: false, statusCode: 502, code: "qr_projects_unavailable", message: "QR Stuff projects could not be loaded. Retry, or uncheck QR code to save only the UTM." };
    }
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

function validHttpUrl(value) {
  try {
    const parsed = new URL(String(value ?? "").trim());
    return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname ? parsed.toString() : null;
  } catch { return null; }
}

function assetFailure(code, error) {
  return { ok: false, statusCode: Number(error?.statusCode) >= 400 && Number(error.statusCode) < 500 ? 422 : 502,
    code, message: error?.message || "The requested asset change could not be completed." };
}

function generatedRestoreFields(row) {
  return {
    client: row.client, channel: row.channel, asset_type: row.asset_type,
    normalized_destination_url: row.normalized_destination_url, canonical_campaign: row.canonical_campaign,
    utm_source: row.utm_source, utm_medium: row.utm_medium, utm_campaign: row.utm_campaign,
    utm_term: row.utm_term, utm_content: row.utm_content, final_long_url: row.final_long_url,
    short_url: row.short_url, qr_url: row.qr_url, bitly_id: row.bitly_id,
    bitly_payload: safeJsonObject(row.bitly_payload), updated_at: row.updated_at
  };
}

function marketingSnapshot(payload, record = {}) {
  return {
    client: payload.client ?? "", channel: payload.channel ?? "", asset_type: payload.asset_type ?? "",
    destination_url: payload.destination_url ?? payload.normalized_destination_url ?? "",
    utm_source: payload.utm_source ?? "", utm_medium: payload.utm_medium ?? "", utm_campaign: payload.utm_campaign ?? "",
    utm_term: payload.utm_term ?? "", utm_content: payload.utm_content ?? "",
    short_url: record.short_url ?? "", qr_url: record.qr_url ?? ""
  };
}

function removeShortLinkWarnings(value) {
  const warnings = Array.isArray(value) ? value : safeJsonArray(value);
  return warnings.filter((warning) => ![
    "Bitly is not configured, so no short link was created.",
    "Bitly authentication failed, so no short link was created.",
    "Bitly quota was reached, so no short link was created.",
    "Bitly is temporarily unavailable, so no short link was created."
  ].includes(String(warning)));
}

function safeJsonArray(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
