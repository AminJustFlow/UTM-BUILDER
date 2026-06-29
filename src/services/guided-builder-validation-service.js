export function buildGuidedBuilderValidation(decision, input = {}) {
  const missingFields = Array.isArray(decision?.missingFields) ? decision.missingFields : [];
  const warnings = Array.isArray(decision?.warnings) ? decision.warnings : [];
  const hasSource = Boolean(String(input.utm_source ?? input.source ?? "").trim());
  const hasMedium = Boolean(String(input.utm_medium ?? input.medium ?? "").trim());
  const hasCampaign = Boolean(String(input.utm_campaign ?? input.campaign ?? "").trim());
  const hasDestination = Boolean(String(input.destination_url ?? input.destinationUrl ?? "").trim());
  const hasClient = Boolean(String(input.client ?? "").trim());

  if (missingFields.includes("destination_url") || !hasDestination) {
    return {
      message: "Enter a valid destination URL to preview and create the tracked link.",
      warnings,
      missingFields
    };
  }

  if (missingFields.includes("client") || !hasClient) {
    return {
      message: "Choose a client to load the right UTM suggestions and resolve the final values.",
      warnings,
      missingFields
    };
  }

  if (missingFields.includes("channel")) {
    if (hasSource || hasMedium) {
      return {
        message: "This source or medium is not mapped to a historical standard yet. Review it before saving if it is a new intentional value.",
        warnings,
        missingFields
      };
    }

    return {
      message: "Add a source or medium to complete the final UTM values for this link.",
      warnings,
      missingFields
    };
  }

  if (missingFields.includes("asset_type")) {
    return {
      message: "This UTM combination is not mapped to a historical standard yet. Review it before saving if the new combination is intentional.",
      warnings,
      missingFields
    };
  }

  if (!hasCampaign) {
    return {
      message: "Choose a campaign bucket to keep reporting consistent before creating the link.",
      warnings,
      missingFields
    };
  }

  return {
    message: "Review the selected UTM values and fix any warnings before creating the link.",
    warnings,
    missingFields
  };
}
