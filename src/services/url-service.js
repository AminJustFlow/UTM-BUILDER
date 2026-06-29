export class UrlService {
  normalizeDestination(url) {
    const parsed = new URL(url);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    for (const key of UTM_KEYS) {
      parsed.searchParams.delete(key);
    }
    for (const key of INTERNAL_TRACKING_KEYS) {
      parsed.searchParams.delete(key);
    }

    parsed.search = buildSortedSearch(parsed.searchParams);
    return parsed.toString();
  }

  appendUtms(destinationUrl, utmParams) {
    const parsed = new URL(destinationUrl);

    for (const key of UTM_KEYS) {
      parsed.searchParams.delete(key);
    }

    const existingEntries = [...parsed.searchParams.entries()];
    const utmEntries = UTM_KEYS
      .filter((key) => utmParams[key] !== undefined && utmParams[key] !== null)
      .map((key) => [key, String(utmParams[key])]);

    parsed.search = buildSearch([...existingEntries, ...utmEntries]);
    return parsed.toString();
  }

  appendInternalTrackingParams(url, trackingParams) {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(trackingParams ?? {})) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        parsed.searchParams.set(key, String(value));
      }
    }
    return parsed.toString();
  }
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const INTERNAL_TRACKING_KEYS = ["jf_fp"];

function buildSortedSearch(searchParams) {
  const entries = [...searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyCompare = leftKey.localeCompare(rightKey);
    return keyCompare !== 0 ? keyCompare : leftValue.localeCompare(rightValue);
  });

  return buildSearch(entries);
}

function buildSearch(entries) {
  return entries.length > 0 ? `?${new URLSearchParams(entries).toString()}` : "";
}
