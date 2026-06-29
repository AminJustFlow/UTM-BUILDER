import fs from "node:fs";
import { startUtmBuilderServer } from "../src/utm-builder-server.js";
import { BitlyError } from "../src/services/bitly-service.js";
import { LinkGenerationService } from "../src/services/link-generation-service.js";

const databasePath = "storage/database/utm-builder-smoke.sqlite";
process.env.DATABASE_CLIENT = "sqlite";
process.env.DATABASE_PATH = databasePath;
process.env.PORT = "3199";
process.env.SETUP_ADMIN_USERNAME = "setupadmin";
process.env.SETUP_ADMIN_PASSWORD = "setup-pass-123";
process.env.TRACKING_SECRET_ENCRYPTION_KEY = "smoke-test-cookie-secret";
process.env.BITLY_ACCESS_TOKEN = "";
process.env.UTM_BUILDER_SKIP_ENV_FILE = "1";
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
  const builderResponse = await af("/new");
  const builderHtml = await builderResponse.text();
  const suggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=jf")).json();
  const history = await (await af("/new/utm-intelligence/history.json?client=jf")).json();
  const createResponse = await af("/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "jf",
      destination_url: "https://example.com/bitly-degradation-smoke",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "smoke",
      utm_content: "missing_token",
      needs_qr: true
    })
  });
  const created = await createResponse.json();
  const duplicateResponseExact = await af("/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "castle",
      destination_url: "https://example.com/bitly-degradation-smoke",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "smoke",
      utm_content: "missing_token",
      needs_qr: false
    })
  });
  const exactDuplicate = await duplicateResponseExact.json();
  const duplicatePage = await af(`/new?duplicate_request_id=${created.result?.request_id}`);
  const duplicateHtml = await duplicatePage.text();
  const missingDuplicatePage = await af("/new?duplicate_request_id=99999999");
  const changedCopyResponse = await af("/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "jf",
      destination_url: "https://example.com/bitly-degradation-smoke",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "smoke",
      utm_content: "changed_copy"
    })
  });
  const concurrentPayload = (destination_url) => ({
    client: "jf",
    destination_url,
    utm_source: "linkedin",
    utm_medium: "social",
    utm_campaign: "concurrency",
    utm_term: "",
    utm_content: ""
  });
  const concurrentResponses = await Promise.all([
    af("/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(concurrentPayload("https://example.com/concurrent?b=2&a=1")) }),
    af("/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(concurrentPayload("https://example.com/concurrent?a=1&b=2")) })
  ]);
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

  const govCreateResponse = await af("/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "jf",
      destination_url: `https://example.com/governance-smoke-${Date.now()}`,
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "smokegovcampaign",
      utm_term: "",
      utm_content: ""
    })
  });
  const govCreated = await govCreateResponse.json();
  const govValue = govCreated.result?.utm_campaign ?? "";
  const govMarker = `data-governance-value="${govValue}"`;
  const libraryBeforeAck = await (await af("/utms")).text();
  const ackResponse = await fetch(`${base}/utms/governance/acknowledge`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({ field: "campaign", value: govValue }).toString()
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
    health.status !== "ok"
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
    || !suggestions.items?.length
    || !history.items?.length
    || createResponse.status !== 200
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
    || changedCopyResponse.status !== 200
    || concurrentStatuses.join(",") !== "200,409"
    || !builderHtml.includes("Campaign Term — Publication Name")
    || !builderHtml.includes("Campaign Content — Issue Name")
    || imported.summary?.imported !== 1
    || duplicate.summary?.skipped !== 1
    || historyResponse.status !== 200
    || !historyBody.events?.some((event) => event.actor === "Smoke Admin")
    || govCreateResponse.status !== 200
    || !govValue
    || !libraryBeforeAck.includes(govMarker)
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
