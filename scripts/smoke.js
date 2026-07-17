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
  const notificationSettingsResponse = await af("/users/notification-settings", {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ enabled: "0", recipients: "alerts@example.com, second@example.com" }).toString()
  });
  const usersAfterSettings = await (await af("/users")).text();
  const suggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=jf")).json();
  const plantFinderSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=studleys&query=plant")).json();
  const constantContactSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=source&client=studleys&query=ConstantContact")).json();
  const history = await (await af("/new/utm-intelligence/history.json?client=jf")).json();
  const existingQueryPreviewResponse = await af("/new/preview.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "jf",
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
      client: "jf",
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
      client: "jf", destination_url: "https://example.com/familiar-combination",
      utm_source: "facebook", utm_medium: "social", utm_campaign: "website",
      utm_term: "jfclientspecificterm", utm_content: "jfclientspecificcontent"
    })
  });
  const clientNewResponse = await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "castle", destination_url: "https://example.com/client-new-combination",
      utm_source: "facebook", utm_medium: "social", utm_campaign: "website",
      utm_term: "jfclientspecificterm", utm_content: "jfclientspecificcontent"
    })
  });
  const clientNew = await clientNewResponse.json();
  const typoContext = await (await af("/new/utm-intelligence/context.json?client=jf&campaign=websit&source=facebook&medium=social")).json();
  const compactEquivalentContext = await (await af("/new/utm-intelligence/context.json?client=studleys&campaign=Plantfinder&source=Constantcontact&medium=email&term=Landingpage&content=Homepage")).json();
  const duplicateResponseExact = await af("/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "castle",
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
      client: "jf", destination_url: "https://example.com/stale-consistency",
      utm_source: "facebook", utm_medium: "social", utm_campaign: "website",
      utm_term: "jfclientspecificterm", utm_content: "changed_copy",
      consistency_warning_fingerprint: createAttempt.firstBody.error?.consistency_warning_fingerprint
    })
  });
  const staleConsistency = await staleConsistencyResponse.json();
  const changedCopyAttempt = await createWithConsistencyConfirmation({
      client: "jf",
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
    client: "jf",
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
    '"1","completed","JF","Facebook","social","website","website","facebook","social","website","","","https://example.com","https://example.com/?utm_source=facebook&utm_medium=social&utm_campaign=website","https://bit.ly/example","","1","2026-01-01T00:00:00.000Z","2026-01-01T00:00:00.000Z","Smoke import"'
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
      client: "jf",
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
    body: new URLSearchParams({ field: "campaign", value: govValue, client: "jf", warning_type: "new_value" }).toString()
  });
  const libraryAfterAck = await (await af("/utms")).text();
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
    || adminLogin.status !== 302
    || !sessionCookie
    || !appCookieHeader.includes("SameSite=Lax")
    || appCookieHeader.includes("; Secure")
    || unauthenticated.status !== 401
    || crossSitePost.status !== 403
    || builderResponse.status !== 200
    || !builderHtml.includes('id="builder-form"')
    || !builderHtml.includes('href="/assets/jf-drop.png"')
    || !builderHtml.includes('src="/assets/just-flow-logo.png"')
    || !builderHtml.includes('id="destination-query-notice"')
    || !builderHtml.includes("This URL already has query parameters, so UTM values will be added with &amp; instead of another ?.")
    || builderHtml.indexOf("Consistency warnings") > builderHtml.indexOf("Resolved preview")
    || usersPage.status !== 200
    || !usersHtml.includes("Smoke Admin")
    || !usersHtml.includes("Administrator")
    || !usersHtml.includes("Consistency review emails")
    || notificationSettingsResponse.status !== 302
    || !usersAfterSettings.includes("alerts@example.com, second@example.com")
    || !suggestions.items?.length
    || !suggestions.items?.some((item) => item.value === "Website" && item.normalized_value === "website")
    || suggestions.items?.some((item) => String(item.value ?? "").includes("_"))
    || !plantFinderSuggestions.items?.some((item) => item.value === "PlantFinder" && item.normalized_value === "plant_finder")
    || !constantContactSuggestions.items?.some((item) => item.value === "ConstantContact" && item.normalized_value === "constant_contact" && item.known)
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
    || clientNewResponse.status !== 409
    || clientNew.error?.code !== "consistency_confirmation_required"
    || !clientNew.error?.consistency_warnings?.some((warning) => warning.type === "new_value")
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
    || !builderHtml.includes("Campaign Term — Publication Name")
    || !builderHtml.includes("Campaign Content — Issue Name")
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
