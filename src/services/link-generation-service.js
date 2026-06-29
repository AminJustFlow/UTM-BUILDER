import { LinkGenerationResult } from "../domain/link-generation-result.js";
import { BitlyError } from "./bitly-service.js";
import { UrlService } from "./url-service.js";

export class LinkGenerationService {
  constructor({
    generatedLinkRepository,
    bitlyService,
    qrCodeService,
    urlService = new UrlService()
  }) {
    this.generatedLinkRepository = generatedLinkRepository;
    this.bitlyService = bitlyService;
    this.qrCodeService = qrCodeService;
    this.urlService = urlService;
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
      const qrUrl = normalized.needsQr ? this.qrCodeService.generateUrl(bitly.link || trackedLongUrl) : null;
      const timestamp = new Date().toISOString();

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
          reusedExisting: false,
          bitlyMetadata: bitly.payload
        }),
        bitlyId: bitly.id ?? null,
        bitlyPayload: bitly.payload,
        degraded: false
      };
    } catch (error) {
      if (!this.shouldDegradeBitlyFailure(error)) {
        throw error;
      }

      const qrUrl = normalized.needsQr ? this.qrCodeService.generateUrl(trackedLongUrl) : null;
      return {
        fingerprint,
        result: new LinkGenerationResult({
          fingerprint,
          longUrl: trackedLongUrl,
          shortUrl: null,
          qrUrl,
          reusedExisting: false,
          bitlyMetadata: error.responseBody ?? {},
          shortLinkAvailable: false
        }),
        bitlyId: null,
        bitlyPayload: error.responseBody ?? {},
        degraded: true,
        degradedReason: "bitly_quota_reached",
        degradedMessage: error.message
      };
    }
  }

  shouldDegradeBitlyFailure(error) {
    return error instanceof BitlyError
      && error.statusCode === 429
      && error.code === "MONTHLY_ENCODE_LIMIT_REACHED";
  }

  async ensureQr(existing, normalized) {
    if (!normalized.needsQr || existing.qr_url) {
      return existing;
    }

    const qrUrl = this.qrCodeService.generateUrl(existing.short_url || existing.final_long_url || normalized.finalLongUrl);
    await (this.generatedLinkRepository.updateByFingerprintAsync?.(existing.fingerprint, {
      qr_url: qrUrl
    }) ?? this.generatedLinkRepository.updateByFingerprint(existing.fingerprint, {
      qr_url: qrUrl
    }));

    return {
      ...existing,
      qr_url: qrUrl
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
}

function safeJsonParse(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
