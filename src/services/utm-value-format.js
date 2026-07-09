const PRESERVED_WORDS = new Map([
  ["cpc", "CPC"],
  ["gmb", "GMB"],
  ["jf", "JF"],
  ["nh", "NH"],
  ["pr", "PR"],
  ["qr", "QR"],
  ["seo", "SEO"],
  ["utm", "UTM"]
]);

const PRESERVED_PHRASES = new Map([
  ["linkedin", "LinkedIn"]
]);

export function formatUtmValue(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const phrase = PRESERVED_PHRASES.get(normalizeToken(text));
  if (phrase) {
    return phrase;
  }

  return text
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .split(/[^a-zA-Z0-9]+/u)
    .filter(Boolean)
    .map(formatUtmToken)
    .join("");
}

export function normalizeUtmComparable(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

function formatUtmToken(token) {
  const normalized = normalizeToken(token);
  const preserved = PRESERVED_WORDS.get(normalized) ?? PRESERVED_PHRASES.get(normalized);
  if (preserved) {
    return preserved;
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}
