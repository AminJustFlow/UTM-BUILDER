import { formatUtmValue } from "./utm-value-format.js";

export function resolveConsistencyDisplayValues(warning = {}, fallbackValues = {}) {
  return Object.fromEntries((warning.fields ?? []).map((field) => {
    const value = warning.display_values?.[field]
      ?? fallbackValues?.[field]
      ?? warning.values?.[field]
      ?? "";
    return [field, formatUtmValue(value)];
  }));
}

export function formatConsistencyWarningValue(warning = {}, fallbackValues = {}) {
  const fields = warning.fields ?? [];
  const displayValues = resolveConsistencyDisplayValues(warning, fallbackValues);
  if (warning.type === "new_combination") {
    return fields.map((field) => `${field}=${displayValues[field] ?? ""}`).join("|");
  }
  return fields.map((field) => displayValues[field] ?? "").join("|");
}

export function formatConsistencyWarningMessage(warning = {}, fallbackValues = {}) {
  const fields = warning.fields ?? [];
  const displayValues = resolveConsistencyDisplayValues(warning, fallbackValues);
  if (warning.type === "new_value" && fields[0]) {
    return `${title(fields[0])} "${displayValues[fields[0]]}" has never been used for this client.`;
  }
  if (warning.type === "new_pairing") {
    return `${fields.map((field) => `${title(field)} "${displayValues[field] ?? ""}"`).join(" with ")} has not been used for this client.`;
  }
  if (warning.type === "new_combination") {
    return "This complete UTM combination has never been used for this client.";
  }
  return String(warning.message ?? "");
}

function title(value) {
  const text = String(value ?? "").replace(/_/gu, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
