import fs from "node:fs";
import { startUtmBuilderServer } from "../src/utm-builder-server.js";
import { BitlyError } from "../src/services/bitly-service.js";
import { LinkGenerationService } from "../src/services/link-generation-service.js";

const databasePath = "storage/database/utm-builder-smoke.sqlite";
process.env.DATABASE_CLIENT = "sqlite";
process.env.DATABASE_PATH = databasePath;
process.env.PORT = "3199";
process.env.LIBRARY_AUTH_ENABLED = "false";
for (const suffix of ["", "-shm", "-wal"]) {
  fs.rmSync(`${databasePath}${suffix}`, { force: true });
}

const instance = await startUtmBuilderServer(process.cwd());
try {
  const health = await (await fetch("http://127.0.0.1:3199/health")).json();
  const builderResponse = await fetch("http://127.0.0.1:3199/new");
  const builderHtml = await builderResponse.text();
  const suggestions = await (await fetch("http://127.0.0.1:3199/new/utm-intelligence/suggestions.json?field=campaign&client=jf")).json();
  const history = await (await fetch("http://127.0.0.1:3199/new/utm-intelligence/history.json?client=jf")).json();
  const createResponse = await fetch("http://127.0.0.1:3199/new", {
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
  const duplicateResponseExact = await fetch("http://127.0.0.1:3199/new", {
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
  const duplicatePage = await fetch(`http://127.0.0.1:3199/new?duplicate_request_id=${created.result?.request_id}`);
  const duplicateHtml = await duplicatePage.text();
  const missingDuplicatePage = await fetch("http://127.0.0.1:3199/new?duplicate_request_id=99999999");
  const changedCopyResponse = await fetch("http://127.0.0.1:3199/new", {
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
    fetch("http://127.0.0.1:3199/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(concurrentPayload("https://example.com/concurrent?b=2&a=1")) }),
    fetch("http://127.0.0.1:3199/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(concurrentPayload("https://example.com/concurrent?a=1&b=2")) })
  ]);
  const concurrentStatuses = concurrentResponses.map((response) => response.status).sort((left, right) => left - right);
  const csv = [
    "request_id,status,client,channel,asset_type,campaign_label,canonical_campaign,utm_source,utm_medium,utm_campaign,utm_term,utm_content,destination_url,final_long_url,short_url,qr_url,request_count,first_seen_at,last_seen_at,original_message",
    '"1","completed","JF","Facebook","social","website","website","facebook","social","website","","","https://example.com","https://example.com/?utm_source=facebook&utm_medium=social&utm_campaign=website","https://bit.ly/example","","1","2026-01-01T00:00:00.000Z","2026-01-01T00:00:00.000Z","Smoke import"'
  ].join("\n");
  const importResponse = await fetch("http://127.0.0.1:3199/imports", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csv
  });
  const imported = await importResponse.json();
  const duplicateResponse = await fetch("http://127.0.0.1:3199/imports", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csv
  });
  const duplicate = await duplicateResponse.json();
  if (
    health.status !== "ok"
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
