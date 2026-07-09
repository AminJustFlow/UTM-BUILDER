import crypto from "node:crypto";
import { normalizeUtmComparable } from "./utm-value-format.js";

export class FingerprintService {
  generate(normalizedRequest) {
    return crypto.createHash("sha256").update(JSON.stringify({
      client: normalizedRequest.client,
      channel: normalizedRequest.channel,
      asset_type: normalizedRequest.assetType,
      normalized_destination_url: normalizedRequest.normalizedDestinationUrl,
      utm_source: normalizeUtmComparable(normalizedRequest.utmSource),
      utm_medium: normalizeUtmComparable(normalizedRequest.utmMedium),
      utm_campaign: normalizeUtmComparable(normalizedRequest.utmCampaign ?? normalizedRequest.canonicalCampaign),
      utm_term: normalizeUtmComparable(normalizedRequest.utmTerm),
      utm_content: normalizeUtmComparable(normalizedRequest.utmContent)
    })).digest("hex");
  }

  generateUtmIdentity(normalizedRequest) {
    return crypto.createHash("sha256").update(JSON.stringify({
      normalized_destination_url: normalizedRequest.normalizedDestinationUrl,
      utm_source: normalizeUtmComparable(normalizedRequest.utmSource),
      utm_medium: normalizeUtmComparable(normalizedRequest.utmMedium),
      utm_campaign: normalizeUtmComparable(normalizedRequest.utmCampaign ?? normalizedRequest.canonicalCampaign),
      utm_term: normalizeUtmComparable(normalizedRequest.utmTerm),
      utm_content: normalizeUtmComparable(normalizedRequest.utmContent)
    })).digest("hex");
  }
}
