import fs from "node:fs";
import { startUtmBuilderServer } from "../src/utm-builder-server.js";
import { BitlyError } from "../src/services/bitly-service.js";
import { LinkGenerationService } from "../src/services/link-generation-service.js";
import { ConsistencyNotificationService } from "../src/services/consistency-notification-service.js";

const databasePath = "storage/database/utm-builder-smoke.sqlite";
process.env.DATABASE_CLIENT = "sqlite";
process.env.DATABASE_PATH = databasePath;
process.env.PORT = "3199";
process.env.SETUP_ADMIN_USERNAME = "setupadmin";
process.env.SETUP_ADMIN_PASSWORD = "setup-pass-123";
process.env.TRACKING_SECRET_ENCRYPTION_KEY = "smoke-test-cookie-secret";
process.env.BITLY_ACCESS_TOKEN = "";
process.env.UTM_BUILDER_SKIP_ENV_FILE = "1";
process.env.SMTP_HOST = "";
process.env.SMTP_FROM = "";
for (const suffix of ["", "-shm", "-wal"]) {
  fs.rmSync(`${databasePath}${suffix}`, { force: true });
}

const base = "http://127.0.0.1:3199";

function cookieValue(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`${name}=([^;]*)`, "u"));
  return match ? `${name}=${match[1]}` : "";
}

const instance = await startUtmBuilderServer(process.cwd());
let sessionCookie = "";
const af = (path, options = {}) => fetch(`${base}${path}`, {
  ...options,
  headers: { ...(options.headers ?? {}), Cookie: sessionCookie }
});
async function createWithConsistencyConfirmation(payload) {
  const firstResponse = await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  const firstBody = await firstResponse.json();
  if (firstResponse.status !== 409 || firstBody.error?.code !== "consistency_confirmation_required") {
    return { firstResponse, firstBody, response: firstResponse, body: firstBody };
  }
  const response = await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, consistency_warning_fingerprint: firstBody.error.consistency_warning_fingerprint })
  });
  return { firstResponse, firstBody, response, body: await response.json() };
}
try {
  const setupLogin = await fetch(`${base}/setup/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "setupadmin", password: "setup-pass-123" }).toString()
  });
  const setupCookie = cookieValue(setupLogin, "jf_setup_session");
  const setupCookieHeader = setupLogin.headers.get("set-cookie") ?? "";
  const createAdmin = await fetch(`${base}/setup/admins`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: setupCookie },
    body: new URLSearchParams({ display_name: "Smoke Admin", username: "smokeadmin", password: "smoke-pass-123" }).toString()
  });
  const adminLogin = await fetch(`${base}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "smokeadmin", password: "smoke-pass-123" }).toString()
  });
  sessionCookie = cookieValue(adminLogin, "jf_app_session");
  const appCookieHeader = adminLogin.headers.get("set-cookie") ?? "";
  const unauthenticated = await fetch(`${base}/utms.json`, { redirect: "manual" });
  const unauthenticatedStandards = await fetch(`${base}/standards`, { redirect: "manual" });
  const crossSitePost = await fetch(`${base}/login`, {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/x-www-form-urlencoded" },
    body: "username=x&password=x"
  });

  const health = await (await fetch(`${base}/health`)).json();
  const logoAsset = await fetch(`${base}/assets/just-flow-logo.png`);
  const faviconAsset = await fetch(`${base}/assets/jf-drop.png`);
  const builderResponse = await af("/new");
  const builderHtml = await builderResponse.text();
  const usersPage = await af("/users");
  const usersHtml = await usersPage.text();
  const createRegularUser = await af("/users", {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ display_name: "Smoke User", username: "smokeuser", password: "smoke-user-pass-123" }).toString()
  });
  const notificationSettingsResponse = await af("/users/notification-settings", {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ enabled: "0", recipients: "alerts@example.com, second@example.com" }).toString()
  });
  const usersAfterSettings = await (await af("/users")).text();
  const gasStandardsBefore = await (await af("/standards?client=gas")).text();
  const createStandardResponse = await af("/standards", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: "gas",
      priority: "2",
      sort_order: "99",
      campaign: "SmokeCampaign",
      display_name: "Smoke Standard",
      aliases: "SmokeAlias",
      guideline: "Smoke guidance",
      source: "SmokeSource",
      medium: "SmokeMedium",
      term_label: "Smoke Term",
      term_help: "Use the smoke term.",
      term_placeholder: "SmokeTerm",
      content_label: "Smoke Content",
      content_help: "Use the smoke content.",
      content_placeholder: "SmokeContent",
      is_active: "1"
    }).toString()
  });
  const standardsAfterCreate = await (await af("/standards?client=gas")).text();
  const standardId = Number(standardsAfterCreate.match(/Smoke Standard[\s\S]*?name="id" value="(\d+)"/u)?.[1] ?? 0);
  const duplicateCampaignResponse = await af("/standards", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: "gas", priority: "2", campaign: "SmokeCampaign", guideline: "Duplicate smoke guidance", is_active: "1"
    }).toString()
  });
  const updateStandardResponse = await af("/standards/update", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id: String(standardId),
      client_key: "gas",
      priority: "2",
      sort_order: "99",
      campaign: "SmokeCampaign",
      display_name: "Smoke Standard",
      aliases: "SmokeAlias",
      guideline: "Updated smoke guidance",
      source: "SmokeSource",
      medium: "SmokeMedium",
      term_label: "Smoke Term",
      term_help: "Use the smoke term.",
      term_placeholder: "SmokeTerm",
      content_label: "Smoke Content",
      content_help: "Use the smoke content.",
      content_placeholder: "SmokeContent",
      is_active: "1"
    }).toString()
  });
  const deactivateStandardResponse = await af("/standards/toggle", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(standardId), client_key: "gas", action: "deactivate" }).toString()
  });
  const builderWithInactiveStandard = await (await af("/new")).text();
  const activateStandardResponse = await af("/standards/toggle", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(standardId), client_key: "gas", action: "activate" }).toString()
  });
  const builderWithActiveStandard = await (await af("/new")).text();
  const duplicateStandardResponse = await af("/standards/duplicate", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(standardId), client_key: "gas" }).toString()
  });
  const deleteStandardResponse = await af("/standards/delete", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(standardId), client_key: "gas" }).toString()
  });
  const standardsAfterMutations = await (await af("/standards?client=gas")).text();
  const suggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas")).json();
  const approvedCampaignSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=about")).json();
  const constantContactSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=source&client=gas&query=ConstantContact")).json();
  const unapprovedSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=studleys")).json();
  const history = await (await af("/new/utm-intelligence/history.json?client=gas")).json();
  const existingQueryPreviewResponse = await af("/new/preview.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "gas",
      destination_url: "https://example.com/existing-query-smoke?existing=1",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "",
      utm_content: ""
    })
  });
  const existingQueryPreview = await existingQueryPreviewResponse.json();
  const createAttempt = await createWithConsistencyConfirmation({
      client: "gas",
      destination_url: "https://example.com/bitly-degradation-smoke",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "jfclientspecificterm",
      utm_content: "jfclientspecificcontent",
      needs_qr: true
  });
  const createResponse = createAttempt.response;
  const created = createAttempt.body;
  const familiarResponse = await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "gas", destination_url: "https://example.com/familiar-combination",
      utm_source: "facebook", utm_medium: "social", utm_campaign: "website",
      utm_term: "jfclientspecificterm", utm_content: "jfclientspecificcontent"
    })
  });
  const clientNewResponse = await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "studleys", destination_url: "https://example.com/client-new-combination",
      utm_source: "facebook", utm_medium: "social", utm_campaign: "website",
      utm_term: "jfclientspecificterm", utm_content: "jfclientspecificcontent"
    })
  });
  const clientNew = await clientNewResponse.json();
  const unapprovedPreviewResponse = await af("/new/preview.json", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client: "studleys", destination_url: "https://studleys.com/", utm_source: "facebook", utm_medium: "social", utm_campaign: "website" })
  });
  const unapprovedPreview = await unapprovedPreviewResponse.json();
  const typoContext = await (await af("/new/utm-intelligence/context.json?client=gas&campaign=websit&source=facebook&medium=social")).json();
  const compactEquivalentContext = await (await af("/new/utm-intelligence/context.json?client=gas&campaign=About&source=ConstantContact&medium=Email&term=LandingPage&content=Explore")).json();
  const duplicateResponseExact = await af("/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "gas",
      destination_url: "https://example.com/bitly-degradation-smoke",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "jfclientspecificterm",
      utm_content: "jfclientspecificcontent",
      needs_qr: false
    })
  });
  const exactDuplicate = await duplicateResponseExact.json();
  const duplicatePage = await af(`/new?duplicate_request_id=${created.result?.request_id}`);
  const duplicateHtml = await duplicatePage.text();
  const missingDuplicatePage = await af("/new?duplicate_request_id=99999999");
  const staleConsistencyResponse = await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "gas", destination_url: "https://example.com/stale-consistency",
      utm_source: "facebook", utm_medium: "social", utm_campaign: "website",
      utm_term: "jfclientspecificterm", utm_content: "changed_copy",
      consistency_warning_fingerprint: createAttempt.firstBody.error?.consistency_warning_fingerprint
    })
  });
  const staleConsistency = await staleConsistencyResponse.json();
  const changedCopyAttempt = await createWithConsistencyConfirmation({
      client: "gas",
      destination_url: "https://example.com/bitly-degradation-smoke",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "jfclientspecificterm",
      utm_content: "changed_copy"
  });
  const changedCopyResponse = changedCopyAttempt.response;
  const supplementedRequestId = changedCopyAttempt.body.result?.request_id;
  const qrSupplementResponse = await af("/utms/supplement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: supplementedRequestId, generate_qr: true })
  });
  const qrSupplement = await qrSupplementResponse.json();
  const repeatedQrSupplementResponse = await af("/utms/supplement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: supplementedRequestId, generate_qr: true })
  });
  const repeatedQrSupplement = await repeatedQrSupplementResponse.json();
  const shortSupplementResponse = await af("/utms/supplement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: supplementedRequestId, generate_short: true })
  });
  const shortSupplement = await shortSupplementResponse.json();
  const supplementedHistoryResponse = await af(`/utms/history.json?fingerprint=${encodeURIComponent(changedCopyAttempt.body.result?.fingerprint ?? "")}`);
  const supplementedHistory = await supplementedHistoryResponse.json();
  const supplementedLibraryHtml = await (await af("/utms")).text();
  const concurrentPayload = (destination_url) => ({
    client: "gas",
    destination_url,
    utm_source: "linkedin",
    utm_medium: "social",
    utm_campaign: "concurrency",
    utm_term: "",
    utm_content: ""
  });
  const concurrentFirst = await createWithConsistencyConfirmation(concurrentPayload("https://example.com/concurrent?b=2&a=1"));
  const concurrentFingerprint = concurrentFirst.firstBody.error?.consistency_warning_fingerprint;
  const concurrentResponses = [concurrentFirst.response, await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...concurrentPayload("https://example.com/concurrent?a=1&b=2"), consistency_warning_fingerprint: concurrentFingerprint })
  })];
  const concurrentStatuses = concurrentResponses.map((response) => response.status).sort((left, right) => left - right);
  const csv = [
    "request_id,status,client,channel,asset_type,campaign_label,canonical_campaign,utm_source,utm_medium,utm_campaign,utm_term,utm_content,destination_url,final_long_url,short_url,qr_url,request_count,first_seen_at,last_seen_at,original_message",
    '"1","completed","GAS","Facebook","social","website","website","facebook","social","website","","","https://example.com","https://example.com/?utm_source=facebook&utm_medium=social&utm_campaign=website","https://bit.ly/example","","1","2026-01-01T00:00:00.000Z","2026-01-01T00:00:00.000Z","Smoke import"'
  ].join("\n");
  const importResponse = await af("/imports", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csv
  });
  const imported = await importResponse.json();
  const duplicateResponse = await af("/imports", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csv
  });
  const duplicate = await duplicateResponse.json();
  const historyResponse = await af(`/utms/history.json?fingerprint=${encodeURIComponent(created.result?.fingerprint ?? "")}`);
  const historyBody = await historyResponse.json();

  const govCreateAttempt = await createWithConsistencyConfirmation({
      client: "gas",
      destination_url: `https://example.com/governance-smoke-${Date.now()}`,
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "smokegovcampaign",
      utm_term: "",
      utm_content: ""
  });
  const govCreateResponse = govCreateAttempt.response;
  const govCreated = govCreateAttempt.body;
  const govValue = govCreated.result?.utm_campaign ?? "";
  const govMarker = `data-governance-value="${String(govValue).toLowerCase()}"`;
  const libraryBeforeAck = await (await af("/utms")).text();
  const ackResponse = await fetch(`${base}/utms/governance/acknowledge`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({ field: "campaign", value: govValue, client: "gas", warning_type: "new_value" }).toString()
  });
  const libraryAfterAck = await (await af("/utms")).text();
  const overlayAttempt = await createWithConsistencyConfirmation({
    client: "gas", destination_url: "https://example.com/admin-overlay",
    utm_source: "facebook", utm_medium: "social", utm_campaign: "adminoverlaycampaign",
    utm_term: "", utm_content: ""
  });
  const overlayRequestId = overlayAttempt.body.result?.request_id;
  const secondOverlayAttempt = await createWithConsistencyConfirmation({
    client: "gas", destination_url: "https://example.com/admin-overlay-second",
    utm_source: "facebook", utm_medium: "social", utm_campaign: "adminoverlaycampaign",
    utm_term: "", utm_content: ""
  });
  const secondOverlayRequestId = secondOverlayAttempt.body.result?.request_id;
  const overlayKnownBeforeDelete = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=adminoverlaycampaign")).json();
  const overlayDeleteResponse = await af("/utms/delete", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: overlayRequestId })
  });
  const overlayKnownAfterFirstDelete = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=adminoverlaycampaign")).json();
  const secondOverlayDeleteResponse = await af("/utms/delete", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: secondOverlayRequestId })
  });
  const overlayKnownAfterDelete = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=adminoverlaycampaign")).json();

  const adminSessionCookie = sessionCookie;
  const regularLogin = await fetch(`${base}/login`, {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "smokeuser", password: "smoke-user-pass-123" }).toString()
  });
  sessionCookie = cookieValue(regularLogin, "jf_app_session");
  const regularAttempt = await createWithConsistencyConfirmation({
    client: "gas", destination_url: "https://example.com/regular-overlay",
    utm_source: "facebook", utm_medium: "social", utm_campaign: "regularhistorycampaign",
    utm_term: "", utm_content: ""
  });
  const regularSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=regularhistorycampaign")).json();
  const regularHistory = await (await af("/new/utm-intelligence/history.json?client=gas&campaign=regularhistorycampaign")).json();
  sessionCookie = adminSessionCookie;
  const passwordChange = await af("/account/password", {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      current_password: "smoke-pass-123",
      new_password: "smoke-pass-456",
      confirm_password: "smoke-pass-456"
    }).toString()
  });
  const oldSessionAfterPasswordChange = await af("/new", { redirect: "manual" });

  const standardsChecks = {
    unauthenticatedRedirect: unauthenticatedStandards.status === 302 && unauthenticatedStandards.headers.get("location")?.startsWith("/login") === true,
    seededGas: gasStandardsBefore.includes("Limited Campaign") && gasStandardsBefore.includes("Meta Ad campaign name"),
    created: createStandardResponse.status === 302 && standardId > 0 && standardsAfterCreate.includes("Smoke Standard"),
    taxonomyWarnings: standardsAfterCreate.includes("not currently in this client"),
    duplicateRejected: duplicateCampaignResponse.status === 302 && (duplicateCampaignResponse.headers.get("location") ?? "").includes("already+has+a+standard"),
    updated: updateStandardResponse.status === 302,
    deactivated: deactivateStandardResponse.status === 302 && !builderWithInactiveStandard.includes("Updated smoke guidance"),
    activated: activateStandardResponse.status === 302 && builderWithActiveStandard.includes("Updated smoke guidance"),
    duplicated: duplicateStandardResponse.status === 302 && standardsAfterMutations.includes("SmokeCampaignCopy"),
    deleted: deleteStandardResponse.status === 302 && !standardsAfterMutations.includes('name="campaign" value="SmokeCampaign"'),
    audited: standardsAfterMutations.includes("Created") && standardsAfterMutations.includes("Updated") && standardsAfterMutations.includes("Deleted")
  };
  const failedStandardsChecks = Object.entries(standardsChecks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failedStandardsChecks.length) {
    throw new Error(`Campaign standards smoke checks failed: ${failedStandardsChecks.join(", ")} ${JSON.stringify({
      standardId,
      duplicateCampaign: [duplicateCampaignResponse.status, duplicateCampaignResponse.headers.get("location")],
      update: [updateStandardResponse.status, updateStandardResponse.headers.get("location")],
      deactivate: [deactivateStandardResponse.status, deactivateStandardResponse.headers.get("location")],
      activate: [activateStandardResponse.status, activateStandardResponse.headers.get("location")],
      duplicate: [duplicateStandardResponse.status, duplicateStandardResponse.headers.get("location")],
      delete: [deleteStandardResponse.status, deleteStandardResponse.headers.get("location")]
    })}`);
  }

  if (
    qrSupplementResponse.status !== 200
    || !qrSupplement.qr_url
    || repeatedQrSupplementResponse.status !== 200
    || repeatedQrSupplement.qr_url !== qrSupplement.qr_url
    || shortSupplementResponse.status !== 503
    || shortSupplement.error?.code !== "bitly_not_configured"
    || !supplementedHistory.events?.some((event) => event.action === "supplemented")
    || !supplementedLibraryHtml.includes('data-generate-asset="short"')
    || !supplementedLibraryHtml.includes('data-generate-asset="qr"')
  ) {
    throw new Error(`Missing-asset supplementation smoke test failed: ${JSON.stringify({
      qrStatus: qrSupplementResponse.status,
      qrUrl: qrSupplement.qr_url ?? null,
      repeatedQrStatus: repeatedQrSupplementResponse.status,
      repeatedQrUrl: repeatedQrSupplement.qr_url ?? null,
      shortStatus: shortSupplementResponse.status,
      shortCode: shortSupplement.error?.code ?? null,
      supplementedHistory: supplementedHistory.events?.map((event) => event.action) ?? [],
      hasShortButton: supplementedLibraryHtml.includes('data-generate-asset="short"'),
      hasQrButton: supplementedLibraryHtml.includes('data-generate-asset="qr"')
    })}`);
  }

  if (
    health.status !== "ok"
    || logoAsset.status !== 200
    || logoAsset.headers.get("content-type") !== "image/png"
    || faviconAsset.status !== 200
    || faviconAsset.headers.get("content-type") !== "image/png"
    || setupLogin.status !== 302
    || !setupCookie
    || !setupCookieHeader.includes("SameSite=Lax")
    || setupCookieHeader.includes("; Secure")
    || createAdmin.status !== 302
    || createRegularUser.status !== 302
    || adminLogin.status !== 302
    || !sessionCookie
    || !appCookieHeader.includes("SameSite=Lax")
    || appCookieHeader.includes("; Secure")
    || unauthenticated.status !== 401
    || unauthenticatedStandards.status !== 302
    || unauthenticatedStandards.headers.get("location")?.startsWith("/login") !== true
    || crossSitePost.status !== 403
    || builderResponse.status !== 200
    || !builderHtml.includes('id="builder-form"')
    || !builderHtml.includes('href="/assets/jf-drop.png"')
    || !builderHtml.includes('src="/assets/just-flow-logo.png"')
    || !builderHtml.includes('id="destination-query-notice"')
    || !builderHtml.includes('id="campaign-standards"')
    || !builderHtml.includes('<option value="gas"')
    || builderHtml.includes('<option value="studleys"')
    || !builderHtml.includes("Meta Ad campaign name")
    || !builderHtml.includes("activeCampaignProfile")
    || !builderHtml.includes("This URL already has query parameters, so UTM values will be added with &amp; instead of another ?.")
    || builderHtml.indexOf("Consistency warnings") > builderHtml.indexOf("Resolved preview")
    || usersPage.status !== 200
    || !usersHtml.includes("Smoke Admin")
    || !usersHtml.includes("Administrator")
    || !usersHtml.includes("Consistency review emails")
    || notificationSettingsResponse.status !== 302
    || !usersAfterSettings.includes("alerts@example.com, second@example.com")
    || !gasStandardsBefore.includes("Campaign Standards")
    || !gasStandardsBefore.includes("Limited Campaign")
    || !gasStandardsBefore.includes("Meta Ad campaign name")
    || !gasStandardsBefore.includes("Campaign Standards")
    || createStandardResponse.status !== 302
    || standardId <= 0
    || !standardsAfterCreate.includes("Smoke Standard")
    || !standardsAfterCreate.includes("not currently in this client")
    || duplicateCampaignResponse.status !== 302
    || !(duplicateCampaignResponse.headers.get("location") ?? "").includes("already+has+a+standard")
    || updateStandardResponse.status !== 302
    || deactivateStandardResponse.status !== 302
    || builderWithInactiveStandard.includes("Updated smoke guidance")
    || activateStandardResponse.status !== 302
    || !builderWithActiveStandard.includes("Updated smoke guidance")
    || duplicateStandardResponse.status !== 302
    || deleteStandardResponse.status !== 302
    || !standardsAfterMutations.includes("SmokeCampaignCopy")
    || standardsAfterMutations.includes('name="campaign" value="SmokeCampaign"')
    || !standardsAfterMutations.includes("Created")
    || !standardsAfterMutations.includes("Updated")
    || !standardsAfterMutations.includes("Deleted")
    || !suggestions.items?.length
    || !suggestions.items?.some((item) => item.value === "About" && item.normalized_value === "about")
    || suggestions.items?.some((item) => String(item.value ?? "").includes("_"))
    || !approvedCampaignSuggestions.items?.some((item) => item.value === "About" && item.normalized_value === "about")
    || !constantContactSuggestions.items?.some((item) => item.value === "Constantcontact" && item.normalized_value === "constantcontact" && item.known)
    || !history.items?.length
    || existingQueryPreviewResponse.status !== 200
    || existingQueryPreview.preview?.resolved?.utm_source !== "Facebook"
    || existingQueryPreview.preview?.resolved?.utm_medium !== "Social"
    || existingQueryPreview.preview?.resolved?.utm_campaign !== "Website"
    || !existingQueryPreview.preview?.resolved?.final_long_url?.includes("?existing=1&utm_source=Facebook")
    || existingQueryPreview.preview?.resolved?.final_long_url?.includes("?existing=1?utm_source=")
    || createResponse.status !== 200
    || createAttempt.firstResponse.status !== 409
    || createAttempt.firstBody.error?.code !== "consistency_confirmation_required"
    || !createAttempt.firstBody.error?.consistency_warning_fingerprint
    || !createAttempt.firstBody.error?.consistency_warnings?.every((warning) => warning.type && warning.severity && Array.isArray(warning.fields) && Array.isArray(warning.recommendations))
    || created.result?.request_id !== 1
    || familiarResponse.status !== 200
    || clientNewResponse.status !== 422
    || clientNew.error?.code !== "unapproved_client"
    || unapprovedPreviewResponse.status !== 422
    || unapprovedPreview.error?.code !== "unapproved_client"
    || unapprovedSuggestions.items?.length
    || !typoContext.consistency?.warnings?.some((warning) => warning.type === "possible_typo" && warning.recommendations?.some((item) => item.value === "Website"))
    || compactEquivalentContext.consistency?.warnings?.some((warning) => warning.type === "possible_typo")
    || compactEquivalentContext.duplicate_warnings?.length
    || created.result?.utm_source !== "Facebook"
    || created.result?.utm_medium !== "Social"
    || created.result?.utm_campaign !== "Website"
    || created.result?.utm_term !== "Jfclientspecificterm"
    || created.result?.utm_content !== "Jfclientspecificcontent"
    || !created.result?.tracked_url?.includes("utm_campaign=Website")
    || created.result?.tracked_url?.includes("jfclientspecificterm")
    || created.result?.status !== "completed_without_short_link"
    || created.result?.degradation_reason !== "bitly_not_configured"
    || !created.result?.tracked_url
    || created.result?.short_url
    || !created.result?.qr_url
    || duplicateResponseExact.status !== 409
    || exactDuplicate.error?.code !== "duplicate_utm"
    || !exactDuplicate.error?.existing?.library_url
    || duplicatePage.status !== 200
    || !duplicateHtml.includes("Create Duplicate")
    || !duplicateHtml.includes('name="duplicated_from_request_id"')
    || missingDuplicatePage.status !== 404
    || staleConsistencyResponse.status !== 409
    || staleConsistency.error?.code !== "consistency_confirmation_required"
    || changedCopyResponse.status !== 200
    || concurrentStatuses.join(",") !== "200,409"
    || imported.summary?.imported !== 1
    || duplicate.summary?.skipped !== 1
    || historyResponse.status !== 200
    || !historyBody.events?.some((event) => event.actor === "Smoke Admin")
    || !historyBody.events?.some((event) => event.action === "consistency_override")
    || govCreateResponse.status !== 200
    || !govValue
    || !libraryBeforeAck.includes(govMarker)
    || libraryBeforeAck.indexOf("Consistency warnings") > libraryBeforeAck.indexOf("<h1>Link Library</h1>")
    || !libraryBeforeAck.includes("Created by <strong>Smoke Admin</strong>")
    || libraryBeforeAck.includes("Last edited by")
    || ackResponse.status !== 302
    || libraryAfterAck.includes(govMarker)
    || overlayAttempt.response.status !== 200
    || secondOverlayAttempt.response.status !== 200
    || !overlayKnownBeforeDelete.items?.some((item) => item.normalized_value === "adminoverlaycampaign" && item.known)
    || overlayDeleteResponse.status !== 200
    || !overlayKnownAfterFirstDelete.items?.some((item) => item.normalized_value === "adminoverlaycampaign" && item.known)
    || secondOverlayDeleteResponse.status !== 200
    || overlayKnownAfterDelete.items?.length
    || regularLogin.status !== 302
    || regularAttempt.response.status !== 200
    || regularSuggestions.items?.length
    || !regularHistory.items?.some((item) => item.campaign === "regularhistorycampaign")
    || passwordChange.status !== 302
    || oldSessionAfterPasswordChange.status !== 302
    || oldSessionAfterPasswordChange.headers.get("location")?.startsWith("/login") !== true
  ) {
    throw new Error("Standalone UTM Builder smoke test failed.");
  }
  process.stdout.write("Standalone UTM Builder smoke test passed.\n");
} finally {
  await instance.close();
}

await verifyBitlyFailureClassification();
await verifyConsistencyNotificationSchedule();

async function verifyBitlyFailureClassification() {
  const cases = [
    [new BitlyError("Unauthorized", { statusCode: 401 }), "bitly_authentication_failed"],
    [new BitlyError("Forbidden", { statusCode: 403 }), "bitly_authentication_failed"],
    [new BitlyError("Limited", { statusCode: 429 }), "bitly_quota_reached"],
    [new BitlyError("Timeout", { code: "BITLY_TIMEOUT" }), "bitly_unavailable"],
    [new BitlyError("Network", { code: "BITLY_NETWORK_ERROR" }), "bitly_unavailable"],
    [new BitlyError("Server", { statusCode: 503 }), "bitly_unavailable"]
  ];
  for (const [error, expectedReason] of cases) {
    const service = createMockLinkGenerationService(async () => { throw error; });
    const result = await service.generate(mockNormalized(), `smoke-${expectedReason}-${error.statusCode ?? error.code}`);
    if (!result.degraded || result.degradedReason !== expectedReason || !result.result.longUrl) {
      throw new Error(`Bitly degradation classification failed for ${expectedReason}.`);
    }
  }

  const success = await createMockLinkGenerationService(async () => ({
    link: "https://bit.ly/smoke",
    id: "bitly/smoke",
    payload: { link: "https://bit.ly/smoke" }
  })).generate(mockNormalized(), "smoke-success");
  if (success.degraded || success.result.shortUrl !== "https://bit.ly/smoke") {
    throw new Error("Successful Bitly response did not retain its short link.");
  }

  let supplementedLongUrl = null;
  let supplementedFields = null;
  const supplementService = new LinkGenerationService({
    generatedLinkRepository: {
      async updateByFingerprintAsync(_fingerprint, fields) {
        supplementedFields = fields;
      }
    },
    bitlyService: {
      async shorten(longUrl) {
        supplementedLongUrl = longUrl;
        return {
          link: "https://bit.ly/supplement",
          id: "bitly/supplement",
          payload: { link: "https://bit.ly/supplement" }
        };
      }
    },
    qrCodeService: { generateUrl(url) { return `https://qr.example/?data=${encodeURIComponent(url)}`; } }
  });
  const cleanLongUrl = "https://example.com/?utm_source=Facebook&utm_medium=Social&utm_campaign=Website";
  const supplement = await supplementService.supplement({
    fingerprint: "supplement-fingerprint",
    final_long_url: cleanLongUrl,
    short_url: "",
    qr_url: null
  }, { generateShort: true });
  if (
    supplement.shortUrl !== "https://bit.ly/supplement"
    || supplementedLongUrl !== cleanLongUrl
    || supplementedLongUrl.includes("jf_fp")
    || Object.hasOwn(supplementedFields ?? {}, "final_long_url")
  ) {
    throw new Error("Missing short-link generation must not add jf_fp to the tracked URL.");
  }

  const unexpected = new Error("database-style unexpected failure");
  try {
    await createMockLinkGenerationService(async () => { throw unexpected; }).generate(mockNormalized(), "smoke-unexpected");
    throw new Error("Unexpected failures must not degrade.");
  } catch (error) {
    if (error !== unexpected) throw error;
  }
}

function createMockLinkGenerationService(shorten) {
  return new LinkGenerationService({
    generatedLinkRepository: {
      async findByFingerprintAsync() { return null; },
      async createAsync() { return 1; }
    },
    bitlyService: { shorten },
    qrCodeService: { generateUrl(url) { return `https://qr.example/?data=${encodeURIComponent(url)}`; } }
  });
}

function mockNormalized() {
  return {
    client: "jf",
    channel: "facebook",
    assetType: "social",
    normalizedDestinationUrl: "https://example.com/",
    canonicalCampaign: "website",
    utmSource: "facebook",
    utmMedium: "social",
    utmCampaign: "website",
    utmTerm: "",
    utmContent: "",
    finalLongUrl: "https://example.com/?utm_source=facebook&utm_medium=social&utm_campaign=website",
    needsQr: true
  };
}

async function verifyConsistencyNotificationSchedule() {
  const settings = { enabled: true, recipients: ["alerts@example.com"], lastRunLocalDate: null };
  const sent = [];
  const service = new ConsistencyNotificationService({
    settingsRepository: {
      async get() { return settings; },
      async recordRun({ localDate, result, error }) {
        settings.lastRunLocalDate = localDate;
        settings.lastResult = result;
        settings.lastError = error;
      }
    },
    requestRepository: {
      async listConsistencyHistoryAsync() {
        return [{
          raw_payload: JSON.stringify({ accepted_consistency_warnings: [{
            type: "new_value", fields: ["campaign"], values: { campaign: "new_campaign" }, message: "New campaign"
          }] }),
          normalized_payload: JSON.stringify({ client: "jf" }),
          source_user_name: "Smoke Admin", created_at: "2026-07-01T09:00:00.000Z"
        }];
      }
    },
    acknowledgementRepository: { async listAsync() { return []; } },
    mailer: { async send(message) { sent.push(message); } },
    appBaseUrl: "https://utm.example.com",
    timezone: "America/New_York"
  });
  const first = await service.runIfDue(new Date("2026-07-01T10:00:00.000Z"));
  const second = await service.runIfDue(new Date("2026-07-01T10:30:00.000Z"));
  if (!first.sent || second.sent || sent.length !== 1 || !sent[0].html.includes("new_campaign")) {
    throw new Error("Consistency notification schedule verification failed.");
  }
}
