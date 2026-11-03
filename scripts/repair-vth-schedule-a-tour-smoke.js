import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connectDatabase } from "../src/support/database.js";
import { MigrationRunner } from "../src/support/migration-runner.js";
import { UrlService } from "../src/services/url-service.js";
import { VthScheduleATourRepairService } from "../src/services/vth-schedule-a-tour-repair-service.js";

const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vth-schedule-a-tour-repair-"));
const database = await connectDatabase(path.join(directory, "test.sqlite"));
try {
  await new MigrationRunner(database, path.join(root, "database", "utm-builder-migrations")).migrate();
  await insertTarget({ id: 1, fingerprint: "success", shortUrl: "https://bit.ly/vth-success", qrUrl: "/qr-assets/success/pdf" });
  await insertGenerated("success", "https://bit.ly/vth-success", "/qr-assets/success/pdf", "QR1");
  await insertTarget({ id: 2, fingerprint: "failure", shortUrl: "https://bit.ly/vth-failure" });
  await insertGenerated("failure", "https://bit.ly/vth-failure", "", "QR2");
  await insertTarget({ id: 3, fingerprint: "no-bitly" });
  await insertGenerated("no-bitly", "", "", "QR3");
  await insertTarget({ id: 4, fingerprint: "direct-qr", qrUrl: "/qr-assets/direct/pdf" });
  await insertGenerated("direct-qr", "", "/qr-assets/direct/pdf", "QR4");
  await insertTarget({ id: 5, fingerprint: "archived", archived: true });
  await insertTarget({ id: 6, fingerprint: "canonical", content: "ScheduleATour" });
  const calls = [];
  const service = new VthScheduleATourRepairService({ database, urlService: new UrlService(), fingerprintService: {
    generate(input) { return `corrected-${input.channel}`; },
    generateUtmIdentity(input) { return `identity-${input.channel}`; }
  }, bitlyService: {
    async updateDestination(input) { calls.push(input); if (input.shortUrl.endsWith("vth-failure")) throw Object.assign(new Error("Bitly update failed with status 429."), { statusCode: 429, code: "RATE_LIMIT" }); return { link: input.shortUrl }; }
  } });
  const plan = await service.plan();
  if (plan.changes.length !== 3 || plan.conflicts.length !== 1 || !plan.conflicts[0].reason.includes("direct QR")) {
    throw new Error(`VTH ScheduleATour dry-run was unexpected: ${JSON.stringify({ changes: plan.changes.length, conflicts: plan.conflicts })}`);
  }
  const report = await service.apply(plan);
  if (report.corrected.length !== 2 || report.bitly_failures.length !== 1 || report.bitly_failures[0].status_code !== 429 || report.conflicts.length !== 1) {
    throw new Error("VTH ScheduleATour apply result was unexpected.");
  }
  const success = await database.getAsync("SELECT * FROM requests WHERE id=1");
  const failure = await database.getAsync("SELECT * FROM requests WHERE id=2");
  const noBitly = await database.getAsync("SELECT * FROM requests WHERE id=3");
  const directQr = await database.getAsync("SELECT * FROM requests WHERE id=4");
  const archived = await database.getAsync("SELECT * FROM requests WHERE id=5");
  const canonical = await database.getAsync("SELECT * FROM requests WHERE id=6");
  const generated = await database.getAsync("SELECT * FROM generated_links WHERE fingerprint=:fingerprint", { fingerprint: success.fingerprint });
  if (JSON.parse(success.normalized_payload).utm_content !== "ScheduleATour" || generated?.utm_content !== "ScheduleATour"
    || !success.final_long_url.includes("utm_content=ScheduleATour") || JSON.parse(failure.normalized_payload).utm_content !== "ScheduleAtour"
    || JSON.parse(noBitly.normalized_payload).utm_content !== "ScheduleATour" || JSON.parse(directQr.normalized_payload).utm_content !== "ScheduleAtour"
    || JSON.parse(archived.normalized_payload).utm_content !== "ScheduleAtour" || JSON.parse(canonical.normalized_payload).utm_content !== "ScheduleATour"
    || calls.length !== 2) throw new Error("VTH ScheduleATour repair did not preserve its safety guarantees.");
  const second = await service.plan();
  if (second.changes.length !== 1 || second.changes[0].old_fingerprint !== "failure" || second.conflicts.length !== 1) {
    throw new Error("VTH ScheduleATour repair is not idempotent or retryable.");
  }
  process.stdout.write("VTH ScheduleATour repair smoke test passed.\n");
} finally { await database.close(); fs.rmSync(directory, { recursive: true, force: true }); }

async function insertTarget({ id, fingerprint, shortUrl = "", qrUrl = "", archived = false, content = "ScheduleAtour" }) {
  const destination = "https://technologyhillnh.com/";
  const payload = { client: "vth", channel: `QR${id}`, asset_type: "offline", normalized_destination_url: destination,
    canonical_campaign: "Ads", utm_source: "SpectrumMonthlyHolidayShopper", utm_medium: "QRCode", utm_campaign: "Ads",
    utm_term: "LandingPage", utm_content: content };
  const url = `${destination}?utm_source=SpectrumMonthlyHolidayShopper&utm_medium=QRCode&utm_campaign=Ads&utm_term=LandingPage&utm_content=${content}`;
  await database.runAsync("INSERT INTO requests (id,request_uuid,delivery_key,status,original_message,normalized_payload,fingerprint,final_long_url,short_url,qr_url,created_at,updated_at,archived_at) VALUES (:id,:uuid,:delivery,'completed','Smoke',:payload,:fingerprint,:url,:short_url,:qr_url,:created,:created,:archived)", {
    id, uuid: `uuid-${id}`, delivery: `delivery-${id}`, payload: JSON.stringify(payload), fingerprint, url,
    short_url: shortUrl || null, qr_url: qrUrl || null, created: "2026-11-03T00:00:00.000Z", archived: archived ? "2026-11-04T00:00:00.000Z" : null
  });
}

async function insertGenerated(fingerprint, shortUrl, qrUrl = "", channel = "QR") {
  const destination = "https://technologyhillnh.com/";
  const url = `${destination}?utm_source=SpectrumMonthlyHolidayShopper&utm_medium=QRCode&utm_campaign=Ads&utm_term=LandingPage&utm_content=ScheduleAtour`;
  await database.runAsync("INSERT INTO generated_links (fingerprint,client,channel,asset_type,normalized_destination_url,canonical_campaign,utm_source,utm_medium,utm_campaign,utm_term,utm_content,final_long_url,short_url,qr_url,bitly_payload,created_at,updated_at) VALUES (:fingerprint,'vth',:channel,'offline',:destination,'Ads','SpectrumMonthlyHolidayShopper','QRCode','Ads','LandingPage','ScheduleAtour',:url,:short_url,:qr_url,'{}',:created,:created)", {
    fingerprint, channel, destination, url, short_url: shortUrl || "", qr_url: qrUrl || null, created: "2026-11-03T00:00:00.000Z"
  });
}

