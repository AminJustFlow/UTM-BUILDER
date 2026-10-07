import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startUtmBuilderServer } from "../src/utm-builder-server.js";
import { BitlyError } from "../src/services/bitly-service.js";
import { LinkGenerationService } from "../src/services/link-generation-service.js";
import { ConsistencyNotificationService } from "../src/services/consistency-notification-service.js";
import { displayDestinationPath, displayGovernanceValue, formatGovernanceLabeledValue, summarizeGovernance } from "../src/controllers/utm-library-controller.js";
import { formatConsistencyWarningMessage, formatConsistencyWarningValue } from "../src/services/consistency-warning-format.js";
import { formatUserEnteredUtmValue, formatUtmValue } from "../src/services/utm-value-format.js";
import rules from "../config/rules.js";
import { RulesService } from "../src/services/rules-service.js";
import { QrCodeService, buildQrFilename } from "../src/services/qr-code-service.js";
import { UtmIntelligenceService } from "../src/services/utm-intelligence-service.js";
import { FingerprintService } from "../src/services/fingerprint-service.js";
import { UtmLibraryService } from "../src/services/utm-library-service.js";
import { RequestRepository } from "../src/repositories/request-repository.js";

let intelligenceHistoryLoads = 0;
let intelligenceStandardsLoads = 0;
const intelligenceService = new UtmIntelligenceService({
  projectRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  rulesService: new RulesService(rules),
  requestRepository: {
    async listConsistencyHistoryAsync() {
      intelligenceHistoryLoads += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [];
    }
  },
  campaignStandardsRepository: {
    async listActiveProfiles() {
      intelligenceStandardsLoads += 1;
      return null;
    }
  },
  refreshTtlMs: 60_000
});
await Promise.all([
  intelligenceService.refreshDataAsync(),
  intelligenceService.refreshDataAsync(),
  intelligenceService.refreshDataAsync()
]);
intelligenceService.suggestions({ client: "gas", field: "campaign" });
intelligenceService.suggestions({ client: "gas", field: "source", campaign: "About" });
if (intelligenceHistoryLoads !== 1 || intelligenceStandardsLoads !== 1) {
  throw new Error("UTM intelligence refresh coalescing/cache smoke test failed.");
}
intelligenceService.invalidateData();
await intelligenceService.refreshDataAsync();
if (intelligenceHistoryLoads !== 2 || intelligenceStandardsLoads !== 2) {
  throw new Error("UTM intelligence invalidation smoke test failed.");
}

const approvedDictionary = JSON.parse(fs.readFileSync(
  new URL("../utm_dictionary_output/utm_ui_dictionaries.json", import.meta.url),
  "utf8"
));
const approvedClientRowCount = (client) => (approvedDictionary.clients?.[client]?.value_counts?.campaign ?? [])
  .reduce((total, entry) => total + Number(entry.count ?? 0), 0);
if (
  approvedClientRowCount("gas") !== 170
  || approvedClientRowCount("sfg") !== 875
  || approvedClientRowCount("cic") !== 755
  || approvedClientRowCount("vth") !== 1
  || Object.keys(approvedDictionary.clients ?? {}).sort().join(",") !== "cic,gas,jf,sfg,vth"
  || !approvedDictionary.clients.vth.value_counts.source.some((entry) => entry.value === "eventspostcard")
  || !approvedDictionary.clients.vth.value_counts.medium.some((entry) => entry.value === "qrcode")
  || !approvedDictionary.clients.vth.value_counts.term.some((entry) => entry.value === "landingpage")
  || !approvedDictionary.clients.vth.value_counts.content.some((entry) => entry.value === "scan")
  || !approvedDictionary.clients.cic.value_counts.term.some((entry) => entry.value === "hikingwalkingtrails")
  || approvedDictionary.clients.gas.value_counts.term.some((entry) => entry.value === "hikingwalkingtrails")
  || approvedDictionary.clients.sfg.value_counts.term.some((entry) => entry.value === "hikingwalkingtrails")
) {
  throw new Error("Approved client dictionary isolation smoke test failed.");
}

const qrTestStorage = fs.mkdtempSync(path.join(os.tmpdir(), "jf-qr-smoke-"));
const qrCalls = [];
const qrService = new QrCodeService({
  async request(method, url, options) {
    qrCalls.push({ method, url, options });
    return { statusCode: 201, headers: {}, body: Buffer.from("%PDF-smoke") };
  }
}, {
  apiKey: "test-api-key", apiBase: "https://api.qrstuff.test/api", timeoutMs: 1000,
  size: 512, resolution: 300, errorCorrectionLevel: "M", storagePath: qrTestStorage,
  timezone: "America/New_York"
});
const qrGenerated = await qrService.generate("https://example.com/tracked", {
  fingerprint: "abcdef1234567890", clientCode: "CIC", campaign: "HomePage", source: "EventsPostcard",
  medium: "QRCode", term: "LandingPage", content: "Scan", projectId: 7, projectName: "CIC Campaigns",
  createdAt: "2026-08-12T12:00:00Z"
});
const qrPdf = await qrService.readAsset("abcdef1234567890", "pdf");
const qrPng = await qrService.readAsset("abcdef1234567890", "png");
if (
  buildQrFilename({
    createdAt: "2026-08-12T12:00:00Z", clientCode: "CIC", campaign: "HomePage", source: "EventsPostcard",
    medium: "QRCode", term: "LandingPage", content: "Scan", fingerprint: "abcdef1234567890", timezone: "America/New_York"
  }) !== "260812-CIC-HomePage-EventsPostcard-QRCode-LandingPage-Scan-abcdef12"
  || buildQrFilename({
    createdAt: "2026-08-12T12:00:00Z", clientCode: "SFG", campaign: "Spring Sale!", source: "Post Card",
    medium: "QRCode", term: "", content: "", fingerprint: "12345678different", timezone: "America/New_York"
  }) !== "260812-SFG-SpringSale-PostCard-QRCode-12345678"
  || buildQrFilename({
    createdAt: "2026-08-12T12:00:00Z", clientCode: "ClientCodeThatIsTooLong", campaign: "Café Campaign Value That Is Far Too Long",
    source: "Source Value That Is Far Too Long", medium: "Medium Value That Is Far Too Long", term: "Term Value That Is Far Too Long",
    content: "Content Value That Is Far Too Long", fingerprint: "FEDCBA9876543210", timezone: "America/New_York"
  }) !== "260812-CLIENTCODETHATIS-CafeCampaignValueThatIsF-SourceValueThatIsFarTooL-MediumValueThatIsFarTooL-TermValueThatIsFarTooLon-ContentValueThatIsFarToo-fedcba98"
  || qrGenerated.qrUrl !== "/qr-assets/abcdef1234567890/pdf"
  || qrGenerated.qrPreviewUrl !== null
  || qrPdf?.filename !== "260812-CIC-HomePage-EventsPostcard-QRCode-LandingPage-Scan-abcdef12.pdf"
  || qrPng !== null
  || qrCalls.length !== 1
    || qrCalls.some((call) => call.method !== "POST" || call.options.headers.Authorization !== "Bearer test-api-key"
    || call.options.json.type !== "URL" || call.options.json.dynamic !== true || call.options.json.colors.transparent !== true
    || call.options.json.format !== "pdf" || call.options.json.name !== "260812-CIC-HomePage-EventsPostcard-QRCode-LandingPage-Scan-abcdef12" || call.options.json.idproject !== 7)
) {
  throw new Error("QR Stuff generation smoke test failed.");
}
fs.rmSync(qrTestStorage, { recursive: true, force: true });

const projectCalls = [];
const projectService = new QrCodeService({
  async request(method, url, options) {
    projectCalls.push({ method, url, options });
    const page = Number(new URL(url).searchParams.get("page"));
    const payload = page === 1
      ? { data: [{ id: 2, name: "Zulu" }, { id: 1, name: "Alpha" }], meta: { last_page: 2 } }
      : { data: [{ id: 3, name: "Marketing" }], meta: { last_page: 2 } };
    return { statusCode: 200, headers: {}, body: JSON.stringify(payload), json() { return payload; } };
  }
}, { apiKey: "test-api-key", apiBase: "https://api.qrstuff.test/api", timeoutMs: 1000, projectsCacheMs: 300000 });
const projects = await projectService.listProjects();
const cachedProjects = await projectService.listProjects();
if (
  projectCalls.length !== 2
  || projectCalls.some((call) => call.method !== "GET" || call.options.headers.Authorization !== "Bearer test-api-key")
  || projects.map((project) => project.name).join(",") !== "Alpha,Marketing,Zulu"
  || cachedProjects !== projects
  || (await projectService.validateProject(3))?.name !== "Marketing"
  || await projectService.validateProject(999) !== null
) {
  throw new Error("QR Stuff project catalog smoke test failed.");
}

const dictionaryOnlyRules = new RulesService(rules);
if (dictionaryOnlyRules.clients().some((client) =>
  dictionaryOnlyRules.getClientTaxonomy(client).campaigns.length !== 0
  || dictionaryOnlyRules.matchTaxonomyValue("campaign", "ServicesAd", { client }) !== null
  || dictionaryOnlyRules.normalizeUtmField("campaign", "Services Add", { client }) !== "Services Add"
)) {
  throw new Error("Dictionary-only client rules smoke test failed.");
}
if (
  dictionaryOnlyRules.getGlobalUtmSuggestions("medium").join(",") !== "QRCode"
  || dictionaryOnlyRules.getClientCode("castle") !== "CIC"
  || dictionaryOnlyRules.getClientCode("studleys") !== "SFG"
  || dictionaryOnlyRules.getClientCode("gas") !== "GAS"
  || dictionaryOnlyRules.getClientCode("bis_603") !== "BIS 603"
  || dictionaryOnlyRules.getClientCode("woodstone") !== "WOODSTONE"
  || dictionaryOnlyRules.getSourceMedium("qr")?.medium !== "Offline"
  || dictionaryOnlyRules.normalizeChannel(null, null, false, { medium: "QRCode" }) !== "qr"
  || dictionaryOnlyRules.normalizeAssetType(null, "qr", { medium: "QRCode" }) !== "offline"
) {
  throw new Error("Universal QRCode suggestion rules smoke test failed.");
}
if (dictionaryOnlyRules.normalizeUtmField("campaign", "News", { client: "studleys" }) !== "Inspiration") {
  throw new Error("Configured campaign alias smoke test failed.");
}

if (
  displayDestinationPath("https://guardianangelseniorservices.com/contact/") !== "/contact/"
  || displayDestinationPath("https://guardianangelseniorservices.com/?source=test#top") !== "/"
  || displayDestinationPath("not-a-url") !== "not-a-url"
) {
  throw new Error("Destination pathname formatting smoke test failed.");
}

if (
  displayGovernanceValue("gas", "caregiver") !== "Caregiver"
  || displayGovernanceValue("GAS", "follow") !== "Follow"
  || displayGovernanceValue("gas", "massachusetts") !== "Massachusetts"
  || displayGovernanceValue("gas", "inspiration") !== "Inspiration"
  || displayGovernanceValue("gas", "ShopNow") !== "ShopNow"
  || displayGovernanceValue("gas", "utm") !== "UTM"
  || displayGovernanceValue("gas", "linkedin") !== "LinkedIn"
  || displayGovernanceValue("gas", "unrelatedvalue") !== "Unrelatedvalue"
  || displayGovernanceValue("studleys", "caregiver") !== "Caregiver"
  || displayGovernanceValue("gas", "campaign=inspiration|source=linkedin", "new_combination") !== "campaign=inspiration|source=linkedin"
) {
  throw new Error("Governance warning display smoke test failed.");
}

const compoundWarning = {
  type: "new_pairing",
  fields: ["campaign", "content"],
  values: { campaign: "floral", content: "shopnow" },
  display_values: { campaign: "Floral", content: "ShopNow" }
};
if (
  formatConsistencyWarningValue(compoundWarning) !== "Floral|ShopNow"
  || formatGovernanceLabeledValue(compoundWarning) !== "Campaign: Floral + Content: ShopNow"
  || formatGovernanceLabeledValue({
    type: "new_combination",
    fields: ["source", "medium", "campaign", "term", "content"],
    values: { source: "facebook", medium: "social", campaign: "floral", term: "autumn", content: "shopnow" },
    display_values: { source: "Facebook", medium: "Social", campaign: "Floral", term: "Autumn", content: "ShopNow" }
  }) !== "Source: Facebook + Medium: Social + Campaign: Floral + Term: Autumn + Content: ShopNow"
  || formatConsistencyWarningMessage(compoundWarning) !== 'Campaign "Floral" with Content "ShopNow" has not been used for this client.'
) {
  throw new Error("Compound consistency warning formatting smoke test failed.");
}

const castleGovernance = summarizeGovernance([{
  client: "castle",
  requestCount: 3,
  createdByName: "Smoke Admin",
  createdAt: "2026-09-24T23:05:00.000Z",
  acceptedConsistencyWarnings: [{
    type: "new_value",
    fields: ["source"],
    values: { source: "laconiadailysun" },
    display_values: { source: "LaconiaDailySun" }
  }]
}], {}, new Set(), dictionaryOnlyRules);
const castleWarning = castleGovernance.fields.find((field) => field.key === "new_value")?.items?.[0];
if (
  castleWarning?.client !== "castle"
  || castleWarning?.clientCode !== "CIC"
  || castleWarning?.labeledDisplayValue !== "Source: LaconiaDailySun"
  || castleWarning?.count !== 3
) {
  throw new Error("Governance client code aggregation smoke test failed.");
}

const legacyApprovalOverrides = intelligenceService.buildApprovedValueOverrides([
  { field: "gas|content", value: "legacyapprovedvalue", display_value: null },
  { field: "gas|pair:campaign+content", value: "caregiver|legacyapprovedvalue", display_value: null },
  { field: "gas|combination", value: "campaign=caregiver|content=legacyapprovedvalue", display_value: null }
], [{ client: "gas", content: "legacyapprovedvalue", contentDisplay: "LegacyApprovedValue" }]);
if (
  legacyApprovalOverrides.size !== 1
  || legacyApprovalOverrides.get("gas:content")?.get("legacyapprovedvalue") !== "LegacyApprovedValue"
) {
  throw new Error("Legacy approved-value overlay smoke test failed.");
}

if (
  formatUtmValue("facebook") !== "Facebook"
  || formatUtmValue("shop now") !== "ShopNow"
  || formatUtmValue("shop_now") !== "ShopNow"
  || formatUtmValue("shop-now") !== "ShopNow"
  || formatUtmValue("ShopNow") !== "ShopNow"
  || formatUtmValue("ConstantContact") !== "ConstantContact"
  || formatUtmValue("LandingPage") !== "LandingPage"
  || formatUtmValue("linkedin") !== "LinkedIn"
  || formatUtmValue("Qrcode") !== "QRCode"
  || formatUtmValue("QRCode") !== "QRCode"
  || formatUtmValue("QrCode") !== "QRCode"
  || formatUtmValue("qrcode") !== "QRCode"
  || formatUtmValue("QR Code") !== "QRCode"
  || formatUtmValue("seo") !== "SEO"
  || formatUtmValue("utm") !== "UTM"
  || formatUtmValue("ma") !== "MA"
) {
  throw new Error("PascalCase UTM formatting smoke test failed.");
}

if (
  formatUserEnteredUtmValue("TestValue") !== "TestValue"
  || formatUserEnteredUtmValue("spring campaign") !== "SpringCampaign"
  || formatUserEnteredUtmValue("event-postcard") !== "EventPostcard"
  || formatUserEnteredUtmValue("  internalCAPValue  ") !== "InternalCAPValue"
  || formatUserEnteredUtmValue("qrcode") !== "QRCode"
  || formatUserEnteredUtmValue("linkedin") !== "LinkedIn"
  || formatUserEnteredUtmValue("utm") !== "UTM"
  || formatUserEnteredUtmValue("gmb") !== "GMB"
) {
  throw new Error("Case-preserving guided UTM formatting smoke test failed.");
}

const legacyQrShape = {
  client: "castle",
  channel: "qr",
  assetType: "offline",
  normalizedDestinationUrl: "https://example.com/event/",
  utmSource: "LaconiaDailySun",
  utmMedium: "Qrcode",
  utmCampaign: "CarShow",
  canonicalCampaign: "CarShow",
  utmTerm: "LaconiaDailySun",
  utmContent: "Scan"
};
const legacyCurrentQrShape = { ...legacyQrShape, utmMedium: "QrCode" };
const canonicalQrShape = { ...legacyQrShape, utmMedium: "QRCode" };
const fingerprintService = new FingerprintService();
if (
  fingerprintService.generate(legacyQrShape) === fingerprintService.generate(canonicalQrShape)
  || fingerprintService.generate(legacyCurrentQrShape) === fingerprintService.generate(canonicalQrShape)
  || fingerprintService.generateUtmIdentity(legacyQrShape) === fingerprintService.generateUtmIdentity(canonicalQrShape)
  || fingerprintService.generateUtmIdentity(legacyCurrentQrShape) === fingerprintService.generateUtmIdentity(canonicalQrShape)
  || fingerprintService.generate({ ...legacyQrShape, utmMedium: "Social" })
    !== fingerprintService.generate({ ...legacyQrShape, utmMedium: "social" })
) {
  throw new Error("Canonical QRCode identity versioning smoke test failed.");
}

const legacyTrackedUrl = "https://example.com/event/?utm_source=laconiaDailySUN&utm_medium=Qrcode&utm_campaign=carSHOW&utm_term=DailySUN&utm_content=SCAN";
const rawLibraryItem = new UtmLibraryService({}).mapRequestRecord({
  id: 1,
  request_uuid: "raw-library-smoke",
  status: "completed",
  normalized_payload: JSON.stringify({
    client: "castle",
    channel: "qr",
    canonical_campaign: "CarShow",
    utm_source: "LaconiaDailySun",
    utm_medium: "QrCode",
    utm_campaign: "CarShow",
    utm_term: "LaconiaDailySun",
    utm_content: "Scan",
    destination_url: "https://example.com/event/",
    normalized_destination_url: "https://example.com/event/",
    final_long_url: legacyTrackedUrl
  }),
  final_long_url: legacyTrackedUrl,
  raw_payload: "{}",
  warnings: "[]",
  missing_fields: "[]"
});
if (
  rawLibraryItem.utmSource !== "laconiaDailySUN"
  || rawLibraryItem.utmMedium !== "Qrcode"
  || rawLibraryItem.utmCampaign !== "carSHOW"
  || rawLibraryItem.utmTerm !== "DailySUN"
  || rawLibraryItem.utmContent !== "SCAN"
) {
  throw new Error("Raw Link Library UTM display smoke test failed.");
}

const duplicateQueries = [];
const duplicateRepository = new RequestRepository({
  client: "sqlite",
  async getAsync(sql, params) {
    duplicateQueries.push({ sql, params });
    return null;
  }
});
await duplicateRepository.findExactUtmDuplicateAsync(canonicalQrShape);
await duplicateRepository.findExactUtmDuplicateAsync(legacyQrShape);
await duplicateRepository.findExactUtmDuplicateAsync(legacyCurrentQrShape);
if (
  !duplicateQueries[0]?.sql.includes("= :medium_exact")
  || duplicateQueries[0]?.params?.medium_exact !== "QRCode"
  || duplicateQueries[1]?.sql.includes("= :medium_exact")
  || duplicateQueries[2]?.sql.includes("= :medium_exact")
) {
  throw new Error("Canonical QRCode duplicate matching smoke test failed.");
}

const qrConsistency = intelligenceService.consistencyAnalysis({
  client: "studleys",
  campaign: "Floral",
  source: "ConstantContact",
  medium: "QRCode"
});
if (qrConsistency.warnings.some((warning) => warning.fields?.includes("medium")) || qrConsistency.requires_confirmation) {
  throw new Error("Universal QRCode consistency suppression smoke test failed.");
}

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
  const unauthenticatedQrProjects = await fetch(`${base}/new/qr-projects.json`, { redirect: "manual" });
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
  const importPageResponse = await af("/imports");
  const importPageHtml = await importPageResponse.text();
  const qrProjectsUnavailableResponse = await af("/new/qr-projects.json");
  const qrProjectsUnavailable = await qrProjectsUnavailableResponse.json();
  const missingQrProjectResponse = await af("/new", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client: "gas", destination_url: "https://example.com/missing-qr-project", needs_qr: true, utm_source: "facebook", utm_medium: "social", utm_campaign: "website", utm_term: "", utm_content: "" })
  });
  const missingQrProject = await missingQrProjectResponse.json();
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
  const cicCampaignSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=castle")).json();
  const cicTermSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=term&client=castle&campaign=Visit&query=HikingWalkingTrails")).json();
  const approvedCampaignSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=about")).json();
  const configuredCampaignSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=SmokeCampaignCopy")).json();
  const configuredCampaignContext = await (await af("/new/utm-intelligence/context.json?client=studleys&campaign=Inspiration&source=ConstantContact&medium=Email&term=LandingPage&content=ShopNow")).json();
  const configuredAliasPreview = await (await af("/new/preview.json", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client: "gas", destination_url: "https://example.com/configured-alias", utm_source: "facebook", utm_medium: "social", utm_campaign: "SmokeAlias", utm_term: "", utm_content: "" })
  })).json();
  const constantContactSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=source&client=gas&query=ConstantContact")).json();
  const landingPageSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=term&client=gas&query=LandingPage")).json();
  const sourceScopedMediums = await (await af("/new/utm-intelligence/suggestions.json?field=medium&client=gas&campaign=about&source=constantcontact")).json();
  const unscopedMediums = await (await af("/new/utm-intelligence/suggestions.json?field=medium&client=gas&campaign=about")).json();
  const universalMediumSuggestions = await Promise.all(["gas", "studleys", "castle"].map(async (client) => (
    await (await af(`/new/utm-intelligence/suggestions.json?field=medium&client=${client}`)).json()
  )));
  const filteredMediumSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=medium&client=gas&query=email")).json();
  const qrCodePreviewResponse = await af("/new/preview.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "gas",
      destination_url: "https://example.com/qr-code-medium",
      utm_source: "QR",
      utm_medium: "QrCode",
      utm_campaign: "Website",
      utm_term: "",
      utm_content: ""
    })
  });
  const qrCodePreview = await qrCodePreviewResponse.json();
  const unapprovedSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=not-a-client")).json();
  const vthPreviewResponse = await af("/new/preview.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "vth",
      destination_url: "https://www.technologyhillnh.com/",
      utm_source: "EventsPostcard",
      utm_medium: "QRCode",
      utm_campaign: "HomePage",
      utm_term: "LandingPage",
      utm_content: "Scan"
    })
  });
  const vthPreview = await vthPreviewResponse.json();
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
  const preservedCasePreviewResponse = await af("/new/preview.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "gas",
      destination_url: "https://example.com/preserved-case",
      utm_source: " MetaAd ",
      utm_medium: " Social ",
      utm_campaign: " Caregiver ",
      utm_term: " MA ",
      utm_content: " Springfield "
    })
  });
  const preservedCasePreview = await preservedCasePreviewResponse.json();
  const customCasePreviewResponse = await af("/new/preview.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "gas",
      destination_url: "https://example.com/custom-case",
      utm_source: "TestSourceValue",
      utm_medium: "TestMediumValue",
      utm_campaign: "TestCampaignValue",
      utm_term: "TestTermValue",
      utm_content: "TestContentValue"
    })
  });
  const customCasePreview = await customCasePreviewResponse.json();
  const createAttempt = await createWithConsistencyConfirmation({
      client: "gas",
      destination_url: "https://example.com/bitly-degradation-smoke",
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "website",
      utm_term: "jfclientspecificterm",
      utm_content: "jfclientspecificcontent",
      needs_qr: false
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
      client: "not-a-client", destination_url: "https://example.com/client-new-combination",
      utm_source: "facebook", utm_medium: "social", utm_campaign: "website",
      utm_term: "jfclientspecificterm", utm_content: "jfclientspecificcontent"
    })
  });
  const clientNew = await clientNewResponse.json();
  const unapprovedPreviewResponse = await af("/new/preview.json", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client: "not-a-client", destination_url: "https://example.com/unapproved-client", utm_source: "facebook", utm_medium: "social", utm_campaign: "website" })
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
    '"1","completed","GAS","Facebook","social","website","website","facebook","social","website","landing_page","shop now","https://example.com/?ref=smoke#section","https://example.com/?ref=smoke&utm_source=facebook&utm_medium=social&utm_campaign=website&utm_term=landing_page&utm_content=shop+now#section","https://bit.ly/example","","1","2026-01-01T00:00:00.000Z","2026-01-01T00:00:00.000Z","Smoke import"'
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
  const aliasCsv = [
    csv.split("\n")[0],
    '"2","completed","SFG","Facebook","social","houseplants","houseplants","facebook","social","houseplants","patio","shop","https://studleys.com/product-category/houseplants/patio/","https://studleys.com/product-category/houseplants/patio/?utm_source=facebook&utm_medium=social&utm_campaign=houseplants&utm_term=patio&utm_content=shop","","","1","2026-01-01T00:00:00.000Z","2026-01-01T00:00:00.000Z","SFG alias import"',
    '"3","completed","CIC","Facebook","social","visit","visit","facebook","social","visit","mansion","learn","https://www.castleintheclouds.org/visit/mansion/","https://www.castleintheclouds.org/visit/mansion/?utm_source=facebook&utm_medium=social&utm_campaign=visit&utm_term=mansion&utm_content=learn","","","1","2026-01-01T00:00:00.000Z","2026-01-01T00:00:00.000Z","CIC alias import"'
  ].join("\n");
  const aliasImportResponse = await af("/imports", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: aliasCsv
  });
  const aliasImported = await aliasImportResponse.json();
  const aliasLibrary = await (await af("/utms.json")).json();
  const sfgAliasItem = aliasLibrary.items?.find((item) => item.originalMessage === "SFG alias import");
  const cicAliasItem = aliasLibrary.items?.find((item) => item.originalMessage === "CIC alias import");
  const importedLibrary = await (await af("/utms.json?search=Smoke%20import")).json();
  const importedItem = importedLibrary.items?.find((item) => item.originalMessage === "Smoke import");
  const historyResponse = await af(`/utms/history.json?fingerprint=${encodeURIComponent(created.result?.fingerprint ?? "")}`);
  const historyBody = await historyResponse.json();

  const adminCookieBeforeGovernance = sessionCookie;
  const governanceRegularLogin = await fetch(`${base}/login`, {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "smokeuser", password: "smoke-user-pass-123" }).toString()
  });
  sessionCookie = cookieValue(governanceRegularLogin, "jf_app_session");
  const govCreateAttempt = await createWithConsistencyConfirmation({
      client: "gas",
      destination_url: `https://example.com/governance-smoke-${Date.now()}`,
      utm_source: "facebook",
      utm_medium: "social",
      utm_campaign: "Caregiver",
      utm_term: "",
      utm_content: "ApprovalOnlyValue"
  });
  sessionCookie = adminCookieBeforeGovernance;
  const govCreateResponse = govCreateAttempt.response;
  const govCreated = govCreateAttempt.body;
  const govWarning = govCreateAttempt.firstBody.error?.consistency_warnings?.find((warning) => warning.type === "new_value" && warning.fields?.includes("content"));
  const govValue = govCreated.result?.utm_content ?? "";
  const govMarker = `data-governance-value="${String(govValue).toLowerCase()}"`;
  const libraryBeforeAck = await (await af("/utms")).text();
  const govSuggestionsBeforeAck = await (await af("/new/utm-intelligence/suggestions.json?field=content&client=gas&query=approvalonlyvalue")).json();
  const ackResponse = await fetch(`${base}/utms/governance/acknowledge`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({ field: "content", value: String(govValue).toLowerCase(), display_value: govValue, client: "gas", warning_type: "new_value" }).toString()
  });
  const duplicateAckResponse = await fetch(`${base}/utms/governance/acknowledge`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({ field: "content", value: String(govValue).toLowerCase(), display_value: govValue, client: "gas", warning_type: "new_value" }).toString()
  });
  const pairAckResponse = await fetch(`${base}/utms/governance/acknowledge`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({ field: "pair:campaign+content", value: "caregiver|paironlyvalue", client: "gas", warning_type: "new_pairing" }).toString()
  });
  const typoAckResponse = await fetch(`${base}/utms/governance/acknowledge`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: sessionCookie },
    body: new URLSearchParams({ field: "source", value: "facebok", display_value: "Facebok", client: "gas", warning_type: "new_value" }).toString()
  });
  const libraryAfterAck = await (await af("/utms")).text();
  const govSuggestionsAfterAck = await (await af("/new/utm-intelligence/suggestions.json?field=content&client=gas&campaign=Caregiver&source=Facebook&query=approvalonlyvalue")).json();
  const govSuggestionsOtherClient = await (await af("/new/utm-intelligence/suggestions.json?field=content&client=castle&query=approvalonlyvalue")).json();
  const govSuggestionsWrongField = await (await af("/new/utm-intelligence/suggestions.json?field=source&client=gas&query=approvalonlyvalue")).json();
  const pairValueSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=content&client=gas&query=paironlyvalue")).json();
  const typoValueSuggestions = await (await af("/new/utm-intelligence/suggestions.json?field=source&client=gas&query=facebok")).json();
  const govArchiveResponse = await af("/utms/archive", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: govCreated.result?.request_id })
  });
  const govSuggestionsAfterArchive = await (await af("/new/utm-intelligence/suggestions.json?field=content&client=gas&query=approvalonlyvalue")).json();
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
  const overlayKnownBeforeArchive = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=adminoverlaycampaign")).json();
  const overlayArchiveResponse = await af("/utms/archive", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: overlayRequestId })
  });
  const overlayKnownAfterFirstArchive = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=adminoverlaycampaign")).json();
  const secondOverlayArchiveResponse = await af("/utms/archive", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: secondOverlayRequestId })
  });
  const overlayKnownAfterArchive = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=adminoverlaycampaign")).json();
  const archivedLibrary = await (await af("/utms.json?view=archived")).json();
  const archivedLibraryHtml = await (await af("/utms?view=archived")).text();
  const overlayRestoreResponse = await af("/utms/restore", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: overlayRequestId })
  });
  const clientsPage = await af("/clients");
  const clientsHtml = await clientsPage.text();
  const renameClientResponse = await af("/clients/rename", {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: "studleys", display_name: "Studleys Smoke Name" }).toString()
  });
  const builderAfterClientRename = await (await af("/new")).text();
  const libraryAfterClientRename = await (await af("/utms.json?client=SFG")).json();
  const libraryHtmlAfterClientRename = await (await af("/utms?client=SFG")).text();
  const restoreClientNameResponse = await af("/clients/rename", {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: "studleys", display_name: "Studleys" }).toString()
  });
  const rejectedPurgeResponse = await af("/clients/purge", {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: "studleys", confirmation: "wrong" }).toString()
  });
  const purgeClientResponse = await af("/clients/purge", {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: "studleys", confirmation: "PURGE studleys" }).toString()
  });
  const builderAfterClientPurge = await (await af("/new")).text();
  const suggestionsAfterClientPurge = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=studleys")).json();
  const overlayKnownAfterRestore = await (await af("/new/utm-intelligence/suggestions.json?field=campaign&client=gas&query=adminoverlaycampaign")).json();
  const archiveBeforeRecreateResponse = await af("/utms/archive", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: overlayRequestId })
  });
  const recreateArchivedAttempt = await createWithConsistencyConfirmation({
    client: "gas", destination_url: "https://example.com/admin-overlay",
    utm_source: "facebook", utm_medium: "social", utm_campaign: "adminoverlaycampaign",
    utm_term: "", utm_content: ""
  });
  const recreateArchivedRequestId = recreateArchivedAttempt.body.result?.request_id;

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
    qrSupplementResponse.status !== 422
    || qrSupplement.error?.code !== "qr_project_required"
    || repeatedQrSupplementResponse.status !== 422
    || shortSupplementResponse.status !== 503
    || shortSupplement.error?.code !== "bitly_not_configured"
    || !supplementedLibraryHtml.includes('data-generate-asset="short"')
    || !supplementedLibraryHtml.includes('data-generate-asset="qr"')
    || !supplementedLibraryHtml.includes('<details class="card-details">')
    || supplementedLibraryHtml.includes('<details class="card-details" open')
    || !supplementedLibraryHtml.includes("View details and actions")
    || !supplementedLibraryHtml.includes('class="compact-utm"')
    || !supplementedLibraryHtml.includes("Copy tracked link")
    || !supplementedLibraryHtml.includes('class="banner-meta destination-path">/bitly-degradation-smoke</div>')
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
    || !builderHtml.includes('id="result-celebration" hidden')
    || !builderHtml.includes("🎉 Nailed it!")
    || !builderHtml.includes("Your UTM values are clean, consistent, and ready to shine.")
    || builderHtml.indexOf('id="campaign-standards"') > builderHtml.indexOf("<h3>Consistency warnings</h3>")
    || builderHtml.indexOf("<h3>Consistency warnings</h3>") > builderHtml.indexOf('id="campaign-label"')
    || !builderHtml.includes('<option value="gas"')
    || !builderHtml.includes('<option value="studleys"')
    || !builderHtml.includes('<option value="vth"')
    || !builderHtml.includes("Meta Ad campaign name")
    || !builderHtml.includes('id="qr-project-picker"')
    || !builderHtml.includes('id="qr-project-search"')
    || !builderHtml.includes('id="tracking-loading-shell"')
    || builderHtml.includes('id="tracking-loading-overlay"')
    || !builderHtml.includes('id="campaign-combo-card" aria-busy="false"')
    || !builderHtml.includes('id="source-field-loading" hidden role="status" aria-live="polite"')
    || !builderHtml.includes("Loading Source recommendations…")
    || !builderHtml.includes("Loading Medium recommendations…")
    || !builderHtml.includes("Loading Term recommendations…")
    || !builderHtml.includes("Loading Content recommendations…")
    || !builderHtml.includes("Loading suggestions…")
    || !builderHtml.includes("suggestionRequestIds")
    || !builderHtml.includes("suggestionControllers")
    || !builderHtml.includes("suggestionCache")
    || !builderHtml.includes("new AbortController()")
    || !builderHtml.includes("debouncedSuggestionLoads")
    || !builderHtml.includes("requestId!==suggestionRequestIds[field]")
    || !builderHtml.includes('data-new-value="true"')
    || !builderHtml.includes("token.charAt(0).toUpperCase()+token.slice(1)")
    || builderHtml.includes("cachedKnown")
    || !builderHtml.includes("state.activeRecommendationField")
    || !builderHtml.includes("state.queuedSubmission=true")
    || !builderHtml.includes("Finishing recommended values…")
    || builderHtml.includes("Wait for recommended values to finish loading.")
    || !builderHtml.includes(".builder-flow{display:flex;flex-direction:column;gap:16px}")
    || !builderHtml.includes(".guide-grid{display:grid;gap:12px;grid-template-columns:repeat(5,minmax(0,1fr))}")
    || !builderHtml.includes(".builder-layout{display:grid;gap:20px;grid-template-columns:minmax(0,1fr) 340px")
    || !builderHtml.includes(".advanced-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}")
    || !builderHtml.includes(".combo-card{position:relative;display:grid;gap:7px;padding:12px")
    || !builderHtml.includes("Reporting campaign or category")
    || !builderHtml.includes("Traffic source or platform")
    || !builderHtml.includes("Marketing channel type")
    || !builderHtml.includes("Optional page, audience, or category detail")
    || !builderHtml.includes("Optional message, CTA, or creative detail")
    || !builderHtml.includes("Campaign tracking details")
    || !builderHtml.includes("No UTM values entered yet.")
    || !builderHtml.includes("Channel is assigned automatically from Source and Medium.")
    || builderHtml.includes("Advanced tracking settings")
    || builderHtml.includes("manual tracking changes")
    || builderHtml.includes("Change the platform")
    || builderHtml.includes("â€”")
    || builderHtml.includes("CicRackCard")
    || !builderHtml.includes("formatUtmInput")
    || !builderHtml.includes('addEventListener("blur"')
    || builderHtml.includes('String(typedValue||"").trim().toLowerCase()')
    || missingQrProjectResponse.status !== 422
    || missingQrProject.error?.code !== "qr_project_required"
    || unauthenticatedQrProjects.status !== 401
    || qrProjectsUnavailableResponse.status !== 502
    || qrProjectsUnavailable.error?.code !== "qr_projects_unavailable"
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
    || !gasStandardsBefore.includes("Campaign value")
    || !gasStandardsBefore.includes("Visible standard name")
    || !gasStandardsBefore.includes("Aliases (comma-separated)")
    || !gasStandardsBefore.includes("Sort order")
    || importPageResponse.status !== 200
    || !importPageHtml.includes("Upload an import-ready UTM CSV.")
    || !importPageHtml.includes("destination URLs, tracked URLs, short URLs, and QR URLs")
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
    || !cicCampaignSuggestions.items?.some((item) => item.value === "Visit" && item.normalized_value === "visit" && item.known)
    || cicCampaignSuggestions.items?.some((item) => item.value === "Floral")
    || !cicTermSuggestions.items?.some((item) => item.value === "HikingWalkingTrails" && item.normalized_value === "hikingwalkingtrails" && item.known)
    || !approvedCampaignSuggestions.items?.some((item) => item.value === "About" && item.normalized_value === "about")
    || !configuredCampaignSuggestions.items?.some((item) => item.value === "SmokeCampaignCopy" && item.normalized_value === "smokecampaigncopy" && item.known && item.count === 0)
    || configuredCampaignContext.consistency?.warnings?.some((warning) => warning.type === "new_value" && warning.fields?.includes("campaign"))
    || configuredAliasPreview.preview?.resolved?.utm_campaign !== "SmokeCampaignCopy"
    || !constantContactSuggestions.items?.some((item) => item.value === "ConstantContact" && item.normalized_value === "constantcontact" && item.known)
    || !landingPageSuggestions.items?.some((item) => item.value === "LandingPage" && item.normalized_value === "landingpage" && item.known)
    || sourceScopedMediums.items?.length !== 2
    || !sourceScopedMediums.items?.some((item) => item.normalized_value === "email" && item.relation === "Used with ConstantContact 34 times" && item.recommended === true)
    || !sourceScopedMediums.items?.some((item) => item.value === "QRCode" && item.normalized_value === "qrcode" && item.known === true)
    || sourceScopedMediums.items?.some((item) => item.normalized_value === "social")
    || !unscopedMediums.items?.some((item) => item.normalized_value === "email")
    || !unscopedMediums.items?.some((item) => item.normalized_value === "social")
    || !unscopedMediums.items?.some((item) => item.value === "QRCode" && item.normalized_value === "qrcode" && item.known === true)
    || universalMediumSuggestions.some((response) => !response.items?.some((item) => item.value === "QRCode" && item.normalized_value === "qrcode" && item.known === true))
    || filteredMediumSuggestions.items?.some((item) => item.normalized_value === "qrcode")
    || qrCodePreviewResponse.status !== 200
    || qrCodePreview.preview?.resolved?.utm_medium !== "QRCode"
    || !qrCodePreview.preview?.resolved?.final_long_url?.includes("utm_medium=QRCode")
    || qrCodePreview.preview?.resolved?.final_long_url?.includes("utm_medium=QrCode")
    || qrCodePreview.preview?.resolved?.channel !== "qr"
    || !history.items?.length
    || existingQueryPreviewResponse.status !== 200
    || existingQueryPreview.preview?.resolved?.utm_source !== "Facebook"
    || existingQueryPreview.preview?.resolved?.utm_medium !== "Social"
    || existingQueryPreview.preview?.resolved?.utm_campaign !== "Website"
    || !existingQueryPreview.preview?.resolved?.final_long_url?.includes("?existing=1&utm_source=Facebook")
    || existingQueryPreview.preview?.resolved?.final_long_url?.includes("?existing=1?utm_source=")
    || vthPreviewResponse.status !== 200
    || vthPreview.preview?.resolved?.utm_source !== "EventsPostcard"
    || vthPreview.preview?.resolved?.utm_medium !== "QRCode"
    || vthPreview.preview?.resolved?.utm_campaign !== "HomePage"
    || vthPreview.preview?.resolved?.utm_term !== "LandingPage"
    || vthPreview.preview?.resolved?.utm_content !== "Scan"
    || vthPreview.preview?.resolved?.final_long_url !== "https://www.technologyhillnh.com/?utm_source=EventsPostcard&utm_medium=QRCode&utm_campaign=HomePage&utm_term=LandingPage&utm_content=Scan"
    || preservedCasePreviewResponse.status !== 200
    || preservedCasePreview.preview?.resolved?.utm_source !== "MetaAd"
    || preservedCasePreview.preview?.resolved?.utm_medium !== "Social"
    || preservedCasePreview.preview?.resolved?.utm_campaign !== "Caregiver"
    || preservedCasePreview.preview?.resolved?.utm_term !== "MA"
    || preservedCasePreview.preview?.resolved?.utm_content !== "Springfield"
    || !preservedCasePreview.preview?.resolved?.final_long_url?.includes("utm_term=MA")
    || customCasePreviewResponse.status !== 200
    || customCasePreview.preview?.resolved?.utm_source !== "TestSourceValue"
    || customCasePreview.preview?.resolved?.utm_medium !== "TestMediumValue"
    || customCasePreview.preview?.resolved?.utm_campaign !== "TestCampaignValue"
    || customCasePreview.preview?.resolved?.utm_term !== "TestTermValue"
    || customCasePreview.preview?.resolved?.utm_content !== "TestContentValue"
    || customCasePreview.preview?.resolved?.final_long_url !== "https://example.com/custom-case?utm_source=TestSourceValue&utm_medium=TestMediumValue&utm_campaign=TestCampaignValue&utm_term=TestTermValue&utm_content=TestContentValue"
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
    || compactEquivalentContext.consistency?.warnings?.some((warning) => warning.type === "rare_combination")
    || compactEquivalentContext.duplicate_warnings?.length
    || created.result?.utm_source !== "Facebook"
    || created.result?.utm_medium !== "Social"
    || created.result?.utm_campaign !== "Website"
    || created.result?.utm_term !== "Jfclientspecificterm"
    || created.result?.utm_content !== "Jfclientspecificcontent"
    || !created.result?.tracked_url?.includes("utm_campaign=Website")
    || !created.result?.tracked_url?.includes("Jfclientspecificterm")
    || created.result?.status !== "completed_without_short_link"
    || created.result?.degradation_reason !== "bitly_not_configured"
    || !created.result?.tracked_url
    || created.result?.short_url
    || created.result?.qr_url
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
    || aliasImported.summary?.imported !== 2
    || sfgAliasItem?.client !== "studleys"
    || cicAliasItem?.client !== "castle"
    || aliasLibrary.available?.clients?.includes("sfg")
    || aliasLibrary.available?.clients?.includes("cic")
    || !aliasLibrary.available?.clients?.includes("studleys")
    || !aliasLibrary.available?.clients?.includes("castle")
    || importedItem?.utmSource !== "Facebook"
    || importedItem?.utmMedium !== "Social"
    || importedItem?.utmCampaign !== "Website"
    || importedItem?.utmTerm !== "LandingPage"
    || importedItem?.utmContent !== "ShopNow"
    || !importedItem?.finalLongUrl?.includes("ref=smoke&utm_source=Facebook&utm_medium=Social&utm_campaign=Website&utm_term=LandingPage&utm_content=ShopNow")
    || !importedItem?.finalLongUrl?.endsWith("#section")
    || historyResponse.status !== 200
    || !historyBody.events?.some((event) => event.actor === "Smoke Admin")
    || !historyBody.events?.some((event) => event.action === "consistency_override")
    || govCreateResponse.status !== 200
    || governanceRegularLogin.status !== 302
    || govWarning?.values?.content !== "approvalonlyvalue"
    || govWarning?.display_values?.content !== "ApprovalOnlyValue"
    || govWarning?.message !== 'Content "ApprovalOnlyValue" has never been used for this client.'
    || !govValue
    || !libraryBeforeAck.includes(govMarker)
    || !libraryBeforeAck.includes("GAS · Content: ApprovalOnlyValue (1)")
    || libraryBeforeAck.includes("gas: ApprovalOnlyValue (1)")
    || !libraryBeforeAck.includes('name="client" value="gas"')
    || !libraryBeforeAck.includes('name="value" value="approvalonlyvalue"')
    || !libraryBeforeAck.includes('name="display_value" value="ApprovalOnlyValue"')
    || libraryBeforeAck.indexOf("Consistency warnings") > libraryBeforeAck.indexOf("<h1>Link Library</h1>")
    || !libraryBeforeAck.includes("Created by <strong>Smoke Admin</strong>")
    || !libraryBeforeAck.includes('class="grid library-results-grid"')
    || !libraryBeforeAck.includes('name="campaign" value="" placeholder="SpringSale"')
    || libraryBeforeAck.includes('placeholder="spring_sale"')
    || !libraryBeforeAck.includes('placeholder="Optional term"')
    || !libraryBeforeAck.includes('placeholder="Optional content"')
    || !libraryBeforeAck.includes(".library-results-grid>.library-card:nth-child(odd){background:var(--surface)}")
    || !libraryBeforeAck.includes(".library-results-grid>.library-card:nth-child(even){background:var(--surface-2)}")
    || libraryBeforeAck.includes("Last edited by")
    || ackResponse.status !== 302
    || duplicateAckResponse.status !== 302
    || pairAckResponse.status !== 302
    || typoAckResponse.status !== 302
    || !typoAckResponse.headers.get("location")?.includes("Possible+typos")
    || libraryAfterAck.includes(govMarker)
    || govSuggestionsBeforeAck.items?.some((item) => item.normalized_value === "approvalonlyvalue")
    || !govSuggestionsAfterAck.items?.some((item) => item.value === "ApprovalOnlyValue" && item.normalized_value === "approvalonlyvalue" && item.known)
    || govSuggestionsOtherClient.items?.some((item) => item.normalized_value === "approvalonlyvalue")
    || govSuggestionsWrongField.items?.some((item) => item.normalized_value === "approvalonlyvalue")
    || pairValueSuggestions.items?.some((item) => item.normalized_value === "paironlyvalue")
    || typoValueSuggestions.items?.some((item) => item.normalized_value === "facebok")
    || govArchiveResponse.status !== 200
    || !govSuggestionsAfterArchive.items?.some((item) => item.value === "ApprovalOnlyValue" && item.normalized_value === "approvalonlyvalue" && item.known)
    || overlayAttempt.response.status !== 200
    || secondOverlayAttempt.response.status !== 200
    || !overlayKnownBeforeArchive.items?.some((item) => item.normalized_value === "adminoverlaycampaign" && item.known)
    || overlayArchiveResponse.status !== 200
    || !overlayKnownAfterFirstArchive.items?.some((item) => item.normalized_value === "adminoverlaycampaign" && item.known)
    || secondOverlayArchiveResponse.status !== 200
    || recreateArchivedAttempt.response.status !== 200
    || !recreateArchivedRequestId
    || archiveBeforeRecreateResponse.status !== 200
    || overlayKnownAfterArchive.items?.length
    || archivedLibrary.filters?.view !== "archived"
    || !archivedLibrary.items?.some((item) => item.requestId === overlayRequestId)
    || archivedLibraryHtml.includes("Consistency Warnings To Review")
    || overlayRestoreResponse.status !== 200
    || !overlayKnownAfterRestore.items?.some((item) => item.normalized_value === "adminoverlaycampaign" && item.known)
    || clientsPage.status !== 200
    || !clientsHtml.includes("Permanently purge client")
    || !clientsHtml.includes("Renaming changes only the visible name. The internal key and existing UTM data stay unchanged.")
    || renameClientResponse.status !== 302
    || !builderAfterClientRename.includes("STUDLEYS SMOKE NAME")
    || libraryAfterClientRename.filters?.client !== "studleys"
    || libraryAfterClientRename.available?.clientLabels?.studleys !== "Studleys Smoke Name"
    || !libraryAfterClientRename.items?.some((item) => item.originalMessage === "SFG alias import")
    || !libraryHtmlAfterClientRename.includes('<option value="studleys" selected>Studleys Smoke Name</option>')
    || libraryHtmlAfterClientRename.includes('<option value="sfg"')
    || restoreClientNameResponse.status !== 302
    || rejectedPurgeResponse.status !== 302
    || purgeClientResponse.status !== 302
    || builderAfterClientPurge.includes('<option value="studleys"')
    || suggestionsAfterClientPurge.items?.length
    || regularLogin.status !== 302
    || regularAttempt.response.status !== 200
    || regularSuggestions.items?.length
    || !regularHistory.items?.some((item) => item.campaign === "regularhistorycampaign")
    || passwordChange.status !== 302
    || oldSessionAfterPasswordChange.status !== 302
    || oldSessionAfterPasswordChange.headers.get("location")?.startsWith("/login") !== true
  ) {
    throw new Error(`Standalone UTM Builder smoke test failed. ${JSON.stringify({
      recreateArchivedStatus: recreateArchivedAttempt.response.status,
      recreateArchivedRequestId,
      archiveBeforeRecreateStatus: archiveBeforeRecreateResponse.status,
      restoreStatus: overlayRestoreResponse.status,
      unauthenticatedQrProjectsStatus: unauthenticatedQrProjects.status,
      qrProjectsUnavailableStatus: qrProjectsUnavailableResponse.status,
      qrProjectsUnavailableCode: qrProjectsUnavailable.error?.code,
      missingQrProjectStatus: missingQrProjectResponse.status,
      missingQrProjectCode: missingQrProject.error?.code,
      vthPreviewStatus: vthPreviewResponse.status,
      vthPreview: vthPreview.preview?.resolved,
      customCasePreviewStatus: customCasePreviewResponse.status,
      customCasePreview: customCasePreview.preview?.resolved,
      govSuggestionsBeforeAck: govSuggestionsBeforeAck.items,
      govSuggestionsAfterAck: govSuggestionsAfterAck.items,
      govSuggestionsOtherClient: govSuggestionsOtherClient.items,
      govSuggestionsWrongField: govSuggestionsWrongField.items,
      govArchiveStatus: govArchiveResponse.status,
      govSuggestionsAfterArchive: govSuggestionsAfterArchive.items
    })}`);
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
    if (!result.degraded || result.degradedReason !== expectedReason || !result.result.longUrl || result.result.longUrl.includes("jf_fp")) {
      throw new Error(`Bitly degradation classification failed for ${expectedReason}.`);
    }
  }

  const normalizedWithLegacyFingerprint = mockNormalized();
  normalizedWithLegacyFingerprint.finalLongUrl += "&jf_fp=legacy-fingerprint#details";
  const expectedCleanLongUrl = mockNormalized().finalLongUrl + "#details";
  let shortenedSuccessUrl = null;
  let createdSuccess = null;
  const successService = new LinkGenerationService({
    generatedLinkRepository: {
      async findByFingerprintAsync() { return null; },
      async createAsync(payload) { createdSuccess = payload; return 1; }
    },
    bitlyService: {
      async shorten(longUrl) {
        shortenedSuccessUrl = longUrl;
        return {
          link: "https://bit.ly/smoke",
          id: "bitly/smoke",
          payload: { link: "https://bit.ly/smoke", long_url: longUrl }
        };
      }
    },
    qrCodeService: { generateUrl(url) { return `https://qr.example/?data=${encodeURIComponent(url)}`; } }
  });
  const success = await successService.generate(normalizedWithLegacyFingerprint, "smoke-success");
  if (
    success.degraded
    || success.result.shortUrl !== "https://bit.ly/smoke"
    || success.result.longUrl !== expectedCleanLongUrl
    || shortenedSuccessUrl !== expectedCleanLongUrl
    || createdSuccess?.finalLongUrl !== expectedCleanLongUrl
    || createdSuccess?.fingerprint !== "smoke-success"
  ) {
    throw new Error("New Bitly links must use a clean URL while retaining the internal fingerprint.");
  }

  const legacyExisting = {
    fingerprint: "legacy-existing",
    final_long_url: `${mockNormalized().finalLongUrl}&jf_fp=legacy-existing`,
    short_url: "https://bit.ly/legacy-existing",
    qr_url: "https://qr.example/legacy-existing",
    qr_preview_url: null,
    bitly_id: "bitly/legacy-existing",
    bitly_payload: JSON.stringify({ link: "https://bit.ly/legacy-existing" })
  };
  const existingService = new LinkGenerationService({
    generatedLinkRepository: {
      async findByFingerprintAsync() { return legacyExisting; },
      async updateByFingerprintAsync() { throw new Error("Existing records must not be updated."); }
    },
    bitlyService: {
      async shorten() { throw new Error("Existing Bitly links must not be recreated."); }
    },
    qrCodeService: {
      generateUrl() { throw new Error("Existing QR assets must not be recreated."); }
    }
  });
  const reused = await existingService.generate(mockNormalized(), legacyExisting.fingerprint);
  if (
    !reused.result.reusedExisting
    || reused.result.longUrl !== legacyExisting.final_long_url
    || reused.result.shortUrl !== legacyExisting.short_url
    || reused.result.qrUrl !== legacyExisting.qr_url
  ) {
    throw new Error("Existing fingerprinted links must be reused without modification.");
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
  const legacySupplementLongUrl = `${cleanLongUrl}&jf_fp=supplement-fingerprint`;
  const supplement = await supplementService.supplement({
    fingerprint: "supplement-fingerprint",
    final_long_url: legacySupplementLongUrl,
    short_url: "",
    qr_url: null
  }, { generateShort: true });
  if (
    supplement.shortUrl !== "https://bit.ly/supplement"
    || supplementedLongUrl !== cleanLongUrl
    || supplementedLongUrl.includes("jf_fp")
    || supplement.finalLongUrl !== legacySupplementLongUrl
    || Object.hasOwn(supplementedFields ?? {}, "final_long_url")
  ) {
    throw new Error("Missing short-link generation must omit jf_fp without rewriting the existing record.");
  }

  let generatedQrContext = null;
  const descriptiveQrService = new LinkGenerationService({
    generatedLinkRepository: {
      async findByFingerprintAsync() { return null; },
      async createAsync() { return 1; }
    },
    bitlyService: {
      async shorten() { return { link: "https://bit.ly/descriptive-qr", id: "bitly/descriptive-qr", payload: {} }; }
    },
    qrCodeService: {
      async generate(_targetUrl, context) {
        generatedQrContext = context;
        return { qrUrl: "/qr-assets/descriptive-qr-fingerprint/pdf", qrPreviewUrl: null };
      }
    },
    rulesService: {
      getClientCode(client) { return client === "castle" ? "CIC" : String(client).toUpperCase(); }
    }
  });
  await descriptiveQrService.generate({
    ...mockNormalized(),
    client: "castle",
    utmCampaign: "HomePage",
    canonicalCampaign: "HomePage",
    utmSource: "EventsPostcard",
    utmMedium: "QRCode",
    utmTerm: "LandingPage",
    utmContent: "Scan"
  }, "descriptive-qr-fingerprint", { qrProjectId: 7, qrProjectName: "CIC Campaigns" });
  if (
    generatedQrContext?.clientCode !== "CIC"
    || generatedQrContext?.campaign !== "HomePage"
    || generatedQrContext?.source !== "EventsPostcard"
    || generatedQrContext?.medium !== "QRCode"
    || generatedQrContext?.term !== "LandingPage"
    || generatedQrContext?.content !== "Scan"
    || generatedQrContext?.fingerprint !== "descriptive-qr-fingerprint"
  ) {
    throw new Error("New QR generation must receive canonical client and complete UTM filename context.");
  }

  let supplementedQrContext = null;
  let supplementedQrFields = null;
  const descriptiveSupplementService = new LinkGenerationService({
    generatedLinkRepository: {
      async updateByFingerprintAsync(_fingerprint, fields) { supplementedQrFields = fields; }
    },
    bitlyService: { async shorten() { throw new Error("Bitly must not run for QR-only supplementation."); } },
    qrCodeService: {
      isManagedUrl() { return false; },
      async generate(_targetUrl, context) {
        supplementedQrContext = context;
        return { qrUrl: "/qr-assets/supplemented-qr-fingerprint/pdf", qrPreviewUrl: null };
      }
    },
    rulesService: { getClientCode() { return "SFG"; } }
  });
  const supplementedQr = await descriptiveSupplementService.supplement({
    fingerprint: "supplemented-qr-fingerprint",
    client: "studleys",
    final_long_url: "https://example.com/tracked",
    short_url: "https://bit.ly/tracked",
    qr_url: null,
    utm_campaign: "Floral",
    canonical_campaign: "Floral",
    utm_source: "Postcard",
    utm_medium: "QRCode",
    utm_term: "LandingPage",
    utm_content: "Scan",
    created_at: "2026-10-07T12:00:00.000Z"
  }, { generateQr: true, qrProjectId: 9, qrProjectName: "SFG Campaigns" });
  if (
    supplementedQr.qrUrl !== "/qr-assets/supplemented-qr-fingerprint/pdf"
    || supplementedQrFields?.qr_url !== "/qr-assets/supplemented-qr-fingerprint/pdf"
    || supplementedQrContext?.clientCode !== "SFG"
    || supplementedQrContext?.campaign !== "Floral"
    || supplementedQrContext?.source !== "Postcard"
    || supplementedQrContext?.medium !== "QRCode"
    || supplementedQrContext?.term !== "LandingPage"
    || supplementedQrContext?.content !== "Scan"
  ) {
    throw new Error("Missing QR generation must receive stored client and complete UTM filename context.");
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
            type: "new_value", fields: ["content"], values: { content: "shopnow" }, message: 'Content "Shopnow" has never been used for this client.'
          }] }),
          normalized_payload: JSON.stringify({ client: "jf", utm_content: "ShopNow" }),
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
  if (!first.sent || second.sent || sent.length !== 1
    || !sent[0].html.includes("ShopNow") || sent[0].html.includes("Shopnow")
    || !sent[0].text.includes("ShopNow") || sent[0].text.includes("Shopnow")) {
    throw new Error("Consistency notification schedule verification failed.");
  }
}
