import { LinkGenerationResult } from "../domain/link-generation-result.js";
import { BitlyError } from "./bitly-service.js";
import { UrlService } from "./url-service.js";

export class LinkGenerationService {
  constructor({
    generatedLinkRepository,
    bitlyService,
    qrCodeService,
    urlService = new UrlService(),
    logger = null
  }) {
    this.generatedLinkRepository = generatedLinkRepository;
    this.bitlyService = bitlyService;
    this.qrCodeService = qrCodeService;
    this.urlService = urlService;
    this.logger = logger;
  }

  async generate(normalized, fingerprint) {
    const trackedLongUrl = this.withFingerprint(normalized.finalLongUrl, fingerprint);
    const existing = await (this.generatedLinkRepository.findByFingerprintAsync?.(fingerprint)
      ?? this.generatedLinkRepository.findByFingerprint(fingerprint));
    if (existing) {
      const refreshed = await this.ensureTrackedUrl(await this.ensureQr(existing, normalized), normalized, fingerprint);
      return {
        fingerprint,
        result: new LinkGenerationResult({
          fingerprint,
          longUrl: refreshed.final_long_url || trackedLongUrl,
          shortUrl: refreshed.short_url,
          qrUrl: refreshed.qr_url ?? null,
          qrPreviewUrl: refreshed.qr_preview_url ?? null,
          reusedExisting: true,
          bitlyMetadata: safeJsonParse(refreshed.bitly_payload)
        }),
        bitlyId: refreshed.bitly_id ?? null,
        bitlyPayload: safeJsonParse(refreshed.bitly_payload),
        degraded: false
      };
    }

    try {
      const bitly = await this.bitlyService.shorten(trackedLongUrl);
      const timestamp = new Date().toISOString();
      const qr = normalized.needsQr ? await this.generateQr(bitly.link || trackedLongUrl, normalized, fingerprint, timestamp) : {};
      const qrUrl = qr.qrUrl ?? null;

      try {
        await (this.generatedLinkRepository.createAsync?.({
          fingerprint,
          client: normalized.client,
          channel: normalized.channel,
          assetType: normalized.assetType,
          normalizedDestinationUrl: normalized.normalizedDestinationUrl,
          canonicalCampaign: normalized.canonicalCampaign,
          utmSource: normalized.utmSource,
          utmMedium: normalized.utmMedium,
          utmCampaign: normalized.utmCampaign,
          utmTerm: normalized.utmTerm,
          utmContent: normalized.utmContent,
          finalLongUrl: trackedLongUrl,
          shortUrl: bitly.link,
          qrUrl,
          qrPreviewUrl: null,
          bitlyId: bitly.id,
          bitlyPayload: bitly.payload,
          createdAt: timestamp,
          updatedAt: timestamp
        }) ?? this.generatedLinkRepository.create({
          fingerprint,
          client: normalized.client,
          channel: normalized.channel,
          assetType: normalized.assetType,
          normalizedDestinationUrl: normalized.normalizedDestinationUrl,
          canonicalCampaign: normalized.canonicalCampaign,
          utmSource: normalized.utmSource,
          utmMedium: normalized.utmMedium,
          utmCampaign: normalized.utmCampaign,
          utmTerm: normalized.utmTerm,
          utmContent: normalized.utmContent,
          finalLongUrl: trackedLongUrl,
          shortUrl: bitly.link,
          qrUrl,
          qrPreviewUrl: null,
          bitlyId: bitly.id,
          bitlyPayload: bitly.payload,
          createdAt: timestamp,
          updatedAt: timestamp
        }));
      } catch (error) {
        const raceExisting = await (this.generatedLinkRepository.findByFingerprintAsync?.(fingerprint)
          ?? this.generatedLinkRepository.findByFingerprint(fingerprint));
        if (!raceExisting) {
          throw error;
        }

        const refreshed = await this.ensureTrackedUrl(await this.ensureQr(raceExisting, normalized), normalized, fingerprint);
        return {
          fingerprint,
          result: new LinkGenerationResult({
            fingerprint,
            longUrl: refreshed.final_long_url || trackedLongUrl,
            shortUrl: refreshed.short_url,
            qrUrl: refreshed.qr_url ?? null,
            qrPreviewUrl: refreshed.qr_preview_url ?? null,
            reusedExisting: true,
            bitlyMetadata: safeJsonParse(refreshed.bitly_payload)
          }),
          bitlyId: refreshed.bitly_id ?? null,
          bitlyPayload: safeJsonParse(refreshed.bitly_payload),
          degraded: false
        };
      }

      return {
        fingerprint,
        result: new LinkGenerationResult({
          fingerprint,
          longUrl: trackedLongUrl,
          shortUrl: bitly.link,
          qrUrl,
          qrPreviewUrl: null,
          reusedExisting: false,
          bitlyMetadata: bitly.payload
        }),
        bitlyId: bitly.id ?? null,
        bitlyPayload: bitly.payload,
        degraded: false,
        qrWarning: qr.error ? "The link was saved, but QR Stuff could not generate the QR files. Retry from the Link Library." : null
      };
    } catch (error) {
      const degradation = this.classifyBitlyFailure(error);
      if (!degradation) {
        throw error;
      }

      this.logger?.warning?.("Bitly short-link creation degraded to the tracked URL.", {
        reason: degradation.reason,
        error_name: error?.name ?? "Error",
        error_code: error?.code ?? null,
        status_code: error?.statusCode ?? null,
        error_message: error?.message ?? "Unknown Bitly failure",
        cause_name: error?.cause?.name ?? null,
        cause_message: error?.cause?.message ?? null
      });

      const qr = normalized.needsQr ? await this.generateQr(trackedLongUrl, normalized, fingerprint) : {};
      const qrUrl = qr.qrUrl ?? null;
      return {
        fingerprint,
        result: new LinkGenerationResult({
          fingerprint,
          longUrl: trackedLongUrl,
          shortUrl: null,
          qrUrl,
          qrPreviewUrl: qr.qrPreviewUrl,
          reusedExisting: false,
          bitlyMetadata: error.responseBody ?? {},
          shortLinkAvailable: false
        }),
        bitlyId: null,
        bitlyPayload: error.responseBody ?? {},
        degraded: true,
        degradedReason: degradation.reason,
        degradedMessage: degradation.message,
        qrWarning: qr.error ? "The link was saved, but QR Stuff could not generate the QR files. Retry from the Link Library." : null
      };
    }
  }

  async supplement(existing, { generateShort = false, generateQr = false } = {}) {
    const fingerprint = String(existing?.fingerprint ?? "").trim();
    const finalLongUrl = String(existing?.final_long_url ?? "").trim();
    if (!fingerprint || !finalLongUrl) {
      throw new Error("A saved fingerprint and tracked URL are required to generate missing assets.");
    }

    const fields = {};
    let shortUrl = String(existing.short_url ?? "").trim();
    let qrUrl = String(existing.qr_url ?? "").trim();
    let bitlyId = existing.bitly_id ?? null;
    let bitlyPayload = safeJsonParse(existing.bitly_payload);
    let degradation = null;

    if (generateShort && !shortUrl) {
      try {
        const bitly = await this.bitlyService.shorten(finalLongUrl);
        shortUrl = bitly.link;
        bitlyId = bitly.id ?? null;
        bitlyPayload = bitly.payload ?? {};
        fields.short_url = shortUrl;
        fields.bitly_id = bitlyId;
        fields.bitly_payload = bitlyPayload;
      } catch (error) {
        degradation = this.classifyBitlyFailure(error);
        if (!degradation) {
          throw error;
        }
        this.logger?.warning?.("Bitly short-link supplementation failed.", {
          reason: degradation.reason,
          error_name: error?.name ?? "Error",
          error_code: error?.code ?? null,
          status_code: error?.statusCode ?? null
        });
      }
    }

    let qrPreviewUrl = String(existing.qr_preview_url ?? "").trim();
    const legacyQr = qrUrl && !(this.qrCodeService.isManagedUrl?.(qrUrl) ?? false);
    let qrFailure = false;
    if (generateQr && (!qrUrl || legacyQr)) {
      const qr = await this.generateQr(shortUrl || finalLongUrl, {
        client: existing.client,
        utmCampaign: existing.utm_campaign || existing.canonical_campaign
      }, fingerprint, existing.created_at);
      qrUrl = qr.qrUrl ?? "";
      qrPreviewUrl = "";
      qrFailure = Boolean(qr.error);
      if (qrUrl) {
        fields.qr_url = qrUrl;
        fields.qr_preview_url = null;
      }
    }

    if (Object.keys(fields).length > 0) {
      await (this.generatedLinkRepository.updateByFingerprintAsync?.(fingerprint, fields)
        ?? this.generatedLinkRepository.updateByFingerprint(fingerprint, fields));
    }

    return {
      shortUrl: shortUrl || null,
      qrUrl: qrUrl || null,
      qrPreviewUrl: qrPreviewUrl || null,
      bitlyId,
      bitlyPayload,
      finalLongUrl,
      generatedShort: Boolean(fields.short_url),
      generatedQr: Boolean(fields.qr_url),
      degraded: Boolean(degradation || qrFailure),
      degradedReason: degradation?.reason ?? (qrFailure ? "qr_stuff_unavailable" : null),
      degradedMessage: degradation?.message ?? (qrFailure ? "QR Stuff could not generate the QR files. Please retry." : null)
    };
  }

  classifyBitlyFailure(error) {
    if (!(error instanceof BitlyError)) {
      return null;
    }
    if (error.code === "BITLY_NOT_CONFIGURED") {
      return {
        reason: "bitly_not_configured",
        message: "Bitly is not configured, so no short link was created."
      };
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return {
        reason: "bitly_authentication_failed",
        message: "Bitly authentication failed, so no short link was created."
      };
    }
    if (error.statusCode === 429) {
      return {
        reason: "bitly_quota_reached",
        message: "Bitly quota was reached, so no short link was created."
      };
    }
    if (
      error.code === "BITLY_TIMEOUT"
      || error.code === "BITLY_NETWORK_ERROR"
      || error.code === "BITLY_INVALID_RESPONSE"
      || Number(error.statusCode) >= 500
    ) {
      return {
        reason: "bitly_unavailable",
        message: "Bitly is temporarily unavailable, so no short link was created."
      };
    }
    return null;
  }

  async ensureQr(existing, normalized) {
    if (!normalized.needsQr || (existing.qr_url && (this.qrCodeService.isManagedUrl?.(existing.qr_url) ?? false))) {
      return existing;
    }

    const qr = await this.generateQr(existing.short_url || existing.final_long_url || normalized.finalLongUrl, normalized, existing.fingerprint, existing.created_at);
    if (!qr.qrUrl) return existing;
    await (this.generatedLinkRepository.updateByFingerprintAsync?.(existing.fingerprint, {
      qr_url: qr.qrUrl, qr_preview_url: null
    }) ?? this.generatedLinkRepository.updateByFingerprint(existing.fingerprint, {
      qr_url: qr.qrUrl, qr_preview_url: null
    }));

    return {
      ...existing,
      qr_url: qr.qrUrl,
      qr_preview_url: null
    };
  }

  async ensureTrackedUrl(existing, normalized, fingerprint) {
    const trackedLongUrl = this.withFingerprint(existing.final_long_url || normalized.finalLongUrl, fingerprint);
    if (existing.final_long_url === trackedLongUrl) {
      return existing;
    }

    await (this.generatedLinkRepository.updateByFingerprintAsync?.(existing.fingerprint, {
      final_long_url: trackedLongUrl
    }) ?? this.generatedLinkRepository.updateByFingerprint(existing.fingerprint, {
      final_long_url: trackedLongUrl
    }));

    return {
      ...existing,
      final_long_url: trackedLongUrl
    };
  }

  withFingerprint(longUrl, fingerprint) {
    return this.urlService.appendInternalTrackingParams(longUrl, { jf_fp: fingerprint });
  }

  async generateQr(targetUrl, normalized, fingerprint, createdAt = new Date()) {
    try {
      if (typeof this.qrCodeService.generate !== "function" && typeof this.qrCodeService.generateUrl === "function") {
        const qrUrl = this.qrCodeService.generateUrl(targetUrl);
        return { qrUrl, qrPreviewUrl: qrUrl };
      }
      return await this.qrCodeService.generate(targetUrl, {
        fingerprint,
        client: normalized.client,
        campaign: normalized.utmCampaign || normalized.canonicalCampaign,
        createdAt
      });
    } catch (error) {
      this.logger?.warning?.("QR Stuff asset generation failed.", {
        error_name: error?.name ?? "Error", error_code: error?.code ?? null,
        status_code: error?.statusCode ?? null, error_message: error?.message ?? "Unknown QR failure"
      });
      return { error: true };
    }
  }
}

function safeJsonParse(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
