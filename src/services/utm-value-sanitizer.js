const URL_LIKE_PATTERN = /^(?:https?:\/\/|www\.)\S+$/iu;
const BITLY_PATTERN = /(?:^|\/\/|\b)bit\.ly\//iu;

export function isUrlLikeUtmValue(value) {
  const text = String(value ?? "").trim();
  return Boolean(text && (URL_LIKE_PATTERN.test(text) || BITLY_PATTERN.test(text)));
}

export function isBitlyUrlValue(value) {
  const text = String(value ?? "").trim();
  return Boolean(text && BITLY_PATTERN.test(text));
}

export function sanitizeOptionalUtmValue(value) {
  const text = String(value ?? "").trim();
  return isUrlLikeUtmValue(text) ? "" : text;
}

export function sanitizeTermContentAndShortUrl({ utmTerm = "", utmContent = "", shortUrl = "" } = {}) {
  const term = String(utmTerm ?? "").trim();
  const content = String(utmContent ?? "").trim();
  let resolvedShortUrl = String(shortUrl ?? "").trim();

  for (const candidate of [term, content]) {
    if (!resolvedShortUrl && isBitlyUrlValue(candidate)) {
      resolvedShortUrl = candidate;
    }
  }

  return {
    utmTerm: sanitizeOptionalUtmValue(term),
    utmContent: sanitizeOptionalUtmValue(content),
    shortUrl: resolvedShortUrl
  };
}
