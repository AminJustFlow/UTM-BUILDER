import fs from "node:fs/promises";
import path from "node:path";

const config = {
  baseUrl: required("LOAD_TEST_BASE_URL"),
  username: required("LOAD_TEST_USERNAME"),
  password: required("LOAD_TEST_PASSWORD"),
  warmupSeconds: positiveNumber("LOAD_TEST_WARMUP_SECONDS", 60),
  steadySeconds: positiveNumber("LOAD_TEST_STEADY_SECONDS", 600),
  burstSeconds: positiveNumber("LOAD_TEST_BURST_SECONDS", 120),
  cooldownSeconds: positiveNumber("LOAD_TEST_COOLDOWN_SECONDS", 60),
  timeoutMs: positiveNumber("LOAD_TEST_TIMEOUT_MS", 10000),
  thinkMinMs: nonnegativeNumber("LOAD_TEST_THINK_MIN_MS", 250),
  thinkMaxMs: nonnegativeNumber("LOAD_TEST_THINK_MAX_MS", 1000)
};

const base = new URL(config.baseUrl);
if (base.hostname === "utm.justflownh.com" && process.env.LOAD_TEST_ALLOW_PRODUCTION !== "yes") {
  fail("Refusing to test production. Set LOAD_TEST_ALLOW_PRODUCTION=yes after confirming the read-only test window.");
}
if (!['https:', 'http:'].includes(base.protocol)) fail("LOAD_TEST_BASE_URL must use http or https.");
if (config.thinkMaxMs < config.thinkMinMs) fail("LOAD_TEST_THINK_MAX_MS must be greater than or equal to LOAD_TEST_THINK_MIN_MS.");

const scenarios = [
  {
    client: "studleys", destination_url: "https://studleys.com/product-category/houseplants/patio/",
    campaign: "Houseplants", source: "Instagram", medium: "Social", term: "Patio", content: "Shop"
  },
  {
    client: "castle", destination_url: "https://www.castleintheclouds.org/hours-admission/",
    campaign: "Visit", source: "ConstantContact", medium: "Email", term: "HoursAndAdmission", content: "Visit"
  },
  {
    client: "gas", destination_url: "https://guardianangelseniorservices.com/",
    campaign: "HomePage", source: "Facebook", medium: "Social", term: "LandingPage", content: "Learn"
  }
];

const allowed = [
  ["POST", /^\/login$/u],
  ["GET", /^\/new$/u],
  ["GET", /^\/new\/utm-intelligence\/suggestions\.json$/u],
  ["GET", /^\/new\/utm-intelligence\/context\.json$/u],
  ["POST", /^\/new\/preview\.json$/u],
  ["GET", /^\/utms\.json$/u],
  ["GET", /^\/health$/u]
];

const measurements = [];
const startedAt = new Date();
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
  process.stderr.write("\nStopping after active read-only requests finish…\n");
});

console.log(`Read-only UTM load test: ${base.origin}`);
console.log(`Phases: 1 user/${config.warmupSeconds}s, 5 users/${config.steadySeconds}s, 10 users/${config.burstSeconds}s, cooldown ${config.cooldownSeconds}s`);

await runPhase("warmup", 1, config.warmupSeconds);
if (!stopping) await runPhase("steady", 5, config.steadySeconds);
if (!stopping) await runPhase("burst", 10, config.burstSeconds);
if (!stopping) {
  console.log(`Cooling down for ${config.cooldownSeconds}s…`);
  await sleep(config.cooldownSeconds * 1000);
  await timedRequest({ phase: "cooldown", virtualUser: 0, label: "health", pathname: "/health" });
}

const report = buildReport();
const reportPath = process.env.LOAD_TEST_REPORT_PATH
  ? path.resolve(process.env.LOAD_TEST_REPORT_PATH)
  : path.resolve("storage", "load-tests", `utm-load-test-${startedAt.toISOString().replaceAll(":", "-")}.json`);
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
printSummary(report);
console.log(`Report: ${reportPath}`);
process.exitCode = report.passed ? 0 : 1;

async function runPhase(name, users, seconds) {
  console.log(`Starting ${name}: ${users} virtual user${users === 1 ? "" : "s"} for ${seconds}s…`);
  const deadline = Date.now() + seconds * 1000;
  const sessions = await Promise.all(Array.from({ length: users }, (_, index) => login(name, index + 1)));
  await Promise.all(sessions.map((session, index) => worker(name, index + 1, session, deadline)));
}

async function login(phase, virtualUser) {
  const body = new URLSearchParams({ username: config.username, password: config.password, return_to: "/new" });
  const response = await timedRequest({
    phase, virtualUser, label: "login", pathname: "/login",
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    expectedStatus: 302, redirect: "manual"
  });
  const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter(Boolean);
  const cookie = setCookies.map((value) => String(value).split(";", 1)[0]).find((value) => value.startsWith("jf_app_session="));
  if (!cookie) fail(`Virtual user ${virtualUser} could not authenticate. Check the dedicated test member credentials.`);
  return cookie;
}

async function worker(phase, virtualUser, cookie, deadline) {
  let iteration = virtualUser - 1;
  while (!stopping && Date.now() < deadline) {
    const scenario = scenarios[iteration % scenarios.length];
    await runWorkflow(phase, virtualUser, cookie, scenario);
    iteration += 1;
  }
}

async function runWorkflow(phase, virtualUser, cookie, scenario) {
  const headers = { Cookie: cookie };
  await timedRequest({ phase, virtualUser, label: "builder", pathname: "/new", headers });
  await think();
  for (const field of ["campaign", "source", "medium", "term", "content"]) {
    const query = new URLSearchParams({
      field, client: scenario.client, campaign: scenario.campaign, source: scenario.source,
      medium: scenario.medium, term: scenario.term, content: scenario.content, query: scenario[field]
    });
    await timedRequest({ phase, virtualUser, label: `suggestions_${field}`, pathname: `/new/utm-intelligence/suggestions.json?${query}`, headers, expectJsonOk: true });
    await think();
  }
  const contextQuery = new URLSearchParams({
    client: scenario.client, utm_campaign: scenario.campaign, utm_source: scenario.source,
    utm_medium: scenario.medium, utm_term: scenario.term, utm_content: scenario.content
  });
  await timedRequest({ phase, virtualUser, label: "context", pathname: `/new/utm-intelligence/context.json?${contextQuery}`, headers, expectJsonOk: true });
  await think();
  await timedRequest({
    phase, virtualUser, label: "preview", pathname: "/new/preview.json", method: "POST",
    headers: { ...headers, "Content-Type": "application/json" }, expectJsonOk: true,
    body: JSON.stringify({
      client: scenario.client, destination_url: scenario.destination_url, utm_campaign: scenario.campaign,
      utm_source: scenario.source, utm_medium: scenario.medium, utm_term: scenario.term,
      utm_content: scenario.content, needs_qr: false
    })
  });
  await think();
  const libraryQuery = new URLSearchParams({ client: scenario.client, campaign: scenario.campaign, per_page: "12" });
  await timedRequest({ phase, virtualUser, label: "library", pathname: `/utms.json?${libraryQuery}`, headers, expectJson: true });
  await think();
}

async function timedRequest({ phase, virtualUser, label, pathname, method = "GET", headers = {}, body, expectedStatus = 200, redirect = "follow", expectJson = false, expectJsonOk = false }) {
  assertAllowed(method, pathname);
  const beganAtMs = Date.now();
  const began = performance.now();
  let status = 0;
  let error = "";
  let response;
  try {
    response = await fetch(new URL(pathname, base), {
      method, headers, body, redirect, signal: AbortSignal.timeout(config.timeoutMs)
    });
    status = response.status;
    if (status !== expectedStatus) throw new Error(`unexpected_status_${status}`);
    if (expectJson || expectJsonOk) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) throw new Error("expected_json");
      const payload = await response.json();
      if (expectJsonOk && payload?.status !== "ok") throw new Error("json_status_not_ok");
    } else {
      await response.arrayBuffer();
    }
  } catch (caught) {
    error = caught?.name === "TimeoutError" || caught?.name === "AbortError" ? "timeout" : String(caught?.message ?? "request_failed");
  } finally {
    measurements.push({ phase, virtualUser, label, status, beganAtMs, endedAtMs: Date.now(), durationMs: round(performance.now() - began), error });
  }
  if (error && label === "login") fail(`Login failed: ${error}.`);
  return response;
}

function assertAllowed(method, pathname) {
  const url = new URL(pathname, base);
  const safe = allowed.some(([allowedMethod, pattern]) => allowedMethod === method && pattern.test(url.pathname));
  if (!safe) fail(`Safety block: ${method} ${url.pathname} is not an approved read-only load-test request.`);
}

function buildReport() {
  const finishedAt = new Date();
  const groups = new Map();
  for (const item of measurements) {
    const key = `${item.phase}|${item.label}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const summaries = [...groups.entries()].map(([key, items]) => summarize(key, items));
  const phases = Object.fromEntries(["warmup", "steady", "burst", "cooldown"].map((phase) => {
    const items = measurements.filter((item) => item.phase === phase);
    return [phase, summarize(phase, items)];
  }));
  const violations = [];
  const steady = measurements.filter((item) => item.phase === "steady");
  const burst = measurements.filter((item) => item.phase === "burst");
  checkErrorRate("steady", steady, 0.01, violations);
  checkErrorRate("burst", burst, 0.01, violations);
  checkP95("steady recommendations/context", steady.filter((item) => item.label.startsWith("suggestions_") || item.label === "context"), 1000, violations);
  checkP95("steady builder/library", steady.filter((item) => ["builder", "library"].includes(item.label)), 2000, violations);
  checkP95("burst overall", burst, 2000, violations);
  if (measurements.some((item) => item.status >= 500 || item.error === "timeout")) violations.push("At least one HTTP 5xx response or timeout occurred.");
  return {
    version: 1, target: base.origin, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    configuration: { ...config, username: "[redacted]", password: "[redacted]" },
    totals: summarize("overall", measurements), phases, endpoints: summaries, violations, passed: violations.length === 0
  };
}

function summarize(name, items) {
  const durations = items.map((item) => item.durationMs).sort((a, b) => a - b);
  const failures = items.filter((item) => item.error || item.status >= 400).length;
  const elapsedSeconds = items.length
    ? Math.max(0.001, (Math.max(...items.map((item) => item.endedAtMs)) - Math.min(...items.map((item) => item.beganAtMs))) / 1000)
    : 0.001;
  return {
    name, requests: items.length, failures, errorRate: items.length ? round(failures / items.length, 4) : 0,
    p50Ms: percentile(durations, 0.50), p95Ms: percentile(durations, 0.95), p99Ms: percentile(durations, 0.99),
    maxMs: durations.at(-1) ?? 0, approximateRps: round(items.length / elapsedSeconds, 3)
  };
}

function checkErrorRate(label, items, maximum, violations) {
  const failures = items.filter((item) => item.error || item.status >= 400).length;
  const rate = items.length ? failures / items.length : 1;
  if (rate >= maximum) violations.push(`${label} error rate ${round(rate * 100, 2)}% is not below ${maximum * 100}%.`);
}

function checkP95(label, items, maximum, violations) {
  const value = percentile(items.map((item) => item.durationMs).sort((a, b) => a - b), 0.95);
  if (!items.length || value > maximum) violations.push(`${label} p95 ${value}ms exceeds ${maximum}ms.`);
}

function printSummary(report) {
  console.table(report.endpoints.map((item) => ({ phase_endpoint: item.name, requests: item.requests, failures: item.failures, p50_ms: item.p50Ms, p95_ms: item.p95Ms, p99_ms: item.p99Ms, max_ms: item.maxMs })));
  console.log(report.passed ? "PASS: application latency and error thresholds passed." : "FAIL: load-test thresholds were exceeded.");
  for (const violation of report.violations) console.log(`- ${violation}`);
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))];
}

function think() {
  const duration = config.thinkMinMs + Math.random() * (config.thinkMaxMs - config.thinkMinMs);
  return sleep(duration);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function round(value, decimals = 1) { const factor = 10 ** decimals; return Math.round(value * factor) / factor; }
function required(name) { const value = String(process.env[name] ?? "").trim(); if (!value) fail(`${name} is required.`); return value; }
function positiveNumber(name, fallback) { const value = Number(process.env[name] ?? fallback); if (!Number.isFinite(value) || value <= 0) fail(`${name} must be greater than zero.`); return value; }
function nonnegativeNumber(name, fallback) { const value = Number(process.env[name] ?? fallback); if (!Number.isFinite(value) || value < 0) fail(`${name} must be zero or greater.`); return value; }
function fail(message) { throw new Error(message); }
