import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connectDatabase } from "../src/support/database.js";
import { MigrationRunner } from "../src/support/migration-runner.js";
import { UrlService } from "../src/services/url-service.js";
import { FingerprintService } from "../src/services/fingerprint-service.js";
import { CicCatcRepairService } from "../src/services/cic-catc-repair-service.js";

const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cic-catc-repair-"));
const database = await connectDatabase(path.join(directory, "test.sqlite"));
try {
  await new MigrationRunner(database, path.join(root, "database", "utm-builder-migrations")).migrate();
  await insertTarget({ id: 1, fingerprint: "success", shortUrl: "https://bit.ly/success" });
  await insertGenerated("success", "https://bit.ly/success");
  await insertTarget({ id: 2, fingerprint: "failure", shortUrl: "https://bit.ly/failure", destination: "https://www.castleintheclouds.org/calendar-of-events/" });
  await insertGenerated("failure", "https://bit.ly/failure", "https://www.castleintheclouds.org/calendar-of-events/");
  await insertTarget({ id: 3, fingerprint: "no-bitly", shortUrl: "", destination: "https://www.castleintheclouds.org/upcoming-events/" });
  await insertGenerated("no-bitly", "", "https://www.castleintheclouds.org/upcoming-events/");
  await insertTarget({ id: 4, fingerprint: "archived", shortUrl: "", archived: true });
  const calls = [];
  const service = new CicCatcRepairService({ database, urlService: new UrlService(), fingerprintService: new FingerprintService(), bitlyService: {
    async updateDestination(input) { calls.push(input); if (input.shortUrl.endsWith("/failure")) throw Object.assign(new Error("Bitly update failed with status 429."), { statusCode: 429, code: "RATE_LIMIT" }); return { link: input.shortUrl }; }
  } });
  const plan = await service.plan();
  if (plan.changes.length !== 3 || plan.conflicts.length !== 0) throw new Error("CIC CATC dry-run did not find the expected active records.");
  const report = await service.apply(plan);
  if (report.corrected.length !== 2 || report.bitly_failures.length !== 1 || report.bitly_failures[0].status_code !== 429) throw new Error("CIC CATC apply result was unexpected.");
  const corrected = await database.getAsync("SELECT * FROM requests WHERE id=1");
  const failed = await database.getAsync("SELECT * FROM requests WHERE id=2");
  const noBitly = await database.getAsync("SELECT * FROM requests WHERE id=3");
  const archived = await database.getAsync("SELECT * FROM requests WHERE id=4");
  const correctedGenerated = await database.getAsync("SELECT * FROM generated_links WHERE fingerprint=:fingerprint", { fingerprint: corrected.fingerprint });
  if (JSON.parse(corrected.normalized_payload).utm_content !== "CATC" || correctedGenerated?.utm_content !== "CATC"
    || !corrected.final_long_url.includes("utm_content=CATC") || JSON.parse(failed.normalized_payload).utm_content !== "ChristmasAtTheCastle"
    || JSON.parse(noBitly.normalized_payload).utm_content !== "CATC" || JSON.parse(archived.normalized_payload).utm_content !== "ChristmasAtTheCastle"
    || calls.length !== 2) throw new Error("CIC CATC repair did not preserve its safety guarantees.");
  const second = await service.plan();
  if (second.changes.length !== 1 || second.changes[0].old_fingerprint !== "failure") throw new Error("CIC CATC repair is not idempotent or retryable.");
  process.stdout.write("CIC CATC repair smoke test passed.\n");
} finally { await database.close(); fs.rmSync(directory, { recursive: true, force: true }); }

async function insertTarget({ id, fingerprint, shortUrl, destination = "https://www.castleintheclouds.org/christmas-at-the-castle/", archived = false }) {
  const payload = { client: "castle", channel: "ConstantContact", asset_type: "email", normalized_destination_url: destination,
    canonical_campaign: "ProgramsAndEvents", utm_source: "ConstantContact", utm_medium: "Email", utm_campaign: "ProgramsAndEvents",
    utm_term: "ChristmasAtTheCastle", utm_content: "ChristmasAtTheCastle" };
  const url = `${destination}?utm_source=ConstantContact&utm_medium=Email&utm_campaign=ProgramsAndEvents&utm_term=ChristmasAtTheCastle&utm_content=ChristmasAtTheCastle`;
  await database.runAsync("INSERT INTO requests (id,request_uuid,delivery_key,status,original_message,normalized_payload,fingerprint,final_long_url,short_url,created_at,updated_at,archived_at) VALUES (:id,:uuid,:delivery,'completed','Smoke',:payload,:fingerprint,:url,:short_url,:created,:created,:archived)", {
    id, uuid: `uuid-${id}`, delivery: `delivery-${id}`, payload: JSON.stringify(payload), fingerprint, url, short_url: shortUrl || null,
    created: "2026-01-01T00:00:00.000Z", archived: archived ? "2026-01-02T00:00:00.000Z" : null
  });
}
async function insertGenerated(fingerprint, shortUrl, destination = "https://www.castleintheclouds.org/christmas-at-the-castle/") {
  const url = `${destination}?utm_source=ConstantContact&utm_medium=Email&utm_campaign=ProgramsAndEvents&utm_term=ChristmasAtTheCastle&utm_content=ChristmasAtTheCastle`;
  await database.runAsync("INSERT INTO generated_links (fingerprint,client,channel,asset_type,normalized_destination_url,canonical_campaign,utm_source,utm_medium,utm_campaign,utm_term,utm_content,final_long_url,short_url,bitly_payload,created_at,updated_at) VALUES (:fingerprint,'castle','ConstantContact','email',:destination,'ProgramsAndEvents','ConstantContact','Email','ProgramsAndEvents','ChristmasAtTheCastle','ChristmasAtTheCastle',:url,:short_url,'{}',:created,:created)", {
    fingerprint, destination, url, short_url: shortUrl, created: "2026-01-01T00:00:00.000Z"
  });
}

