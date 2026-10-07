import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import rules from "../config/rules.js";
import { connectDatabase } from "../src/support/database.js";
import { MigrationRunner } from "../src/support/migration-runner.js";
import { RequestRepository } from "../src/repositories/request-repository.js";
import { GeneratedLinkRepository } from "../src/repositories/generated-link-repository.js";
import { RulesService } from "../src/services/rules-service.js";
import { UtmIntelligenceService } from "../src/services/utm-intelligence-service.js";
import { UrlService } from "../src/services/url-service.js";
import { HistoricalUtmCasingRepairService } from "../src/services/historical-utm-casing-repair-service.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "utm-case-repair-"));
const database = await connectDatabase(path.join(directory, "test.sqlite"));
try {
  await new MigrationRunner(database, path.join(projectRoot, "database", "utm-builder-migrations")).migrate();
  const basePayload = {
    client: "castle", normalized_destination_url: "https://www.castleintheclouds.org/sponsor/?ref=smoke#section",
    utm_source: "Instagram", utm_medium: "Social", utm_campaign: "Support",
    canonical_campaign: "Support", utm_term: "BecomeAsponsor", utm_content: "Learn"
  };
  const oldUrl = "https://www.castleintheclouds.org/sponsor/?ref=smoke&utm_source=Instagram&utm_medium=Social&utm_campaign=Support&utm_term=BecomeAsponsor&utm_content=Learn#section";
  await insertRequest(1, "active", basePayload, oldUrl, null, "https://bit.ly/casing", null);
  await insertRequest(2, "archived", basePayload, oldUrl, "2026-01-02T00:00:00.000Z", "", null);
  await insertRequest(3, "direct", basePayload, oldUrl, null, "", "/qr-assets/direct/pdf");
  await insertRequest(4, "custom", { ...basePayload, utm_term: "CustomAsponsorValue" }, oldUrl.replace("BecomeAsponsor", "CustomAsponsorValue"), null, "", null);
  await insertRequest(5, "bitly-failure", { ...basePayload, normalized_destination_url: "https://www.castleintheclouds.org/membership/" }, oldUrl.replace("/sponsor/", "/membership/"), null, "https://bit.ly/failure", null);
  await insertRequest(6, "conflict-a", { ...basePayload, normalized_destination_url: "https://www.castleintheclouds.org/contact-us/" }, oldUrl.replace("/sponsor/", "/contact-us/"), null, "https://bit.ly/shared", null);
  await insertRequest(7, "conflict-b", { ...basePayload, normalized_destination_url: "https://www.castleintheclouds.org/donate/" }, oldUrl.replace("/sponsor/", "/donate/"), null, "https://bit.ly/shared", null);
  await database.runAsync(`INSERT INTO generated_links (fingerprint,client,channel,asset_type,normalized_destination_url,canonical_campaign,utm_source,utm_medium,utm_campaign,utm_term,utm_content,final_long_url,short_url,qr_url,bitly_id,bitly_payload,created_at,updated_at) VALUES ('active','castle','Instagram','social',:destination,'Support','Instagram','Social','Support','BecomeAsponsor','Learn',:url,'https://bit.ly/casing',NULL,NULL,'{}',:created,:created)`, {
    destination: basePayload.normalized_destination_url, url: oldUrl, created: "2026-01-01T00:00:00.000Z"
  });
  const bitlyUpdates = [];
  const intelligenceService = new UtmIntelligenceService({
    projectRoot, rulesService: new RulesService(rules),
    requestRepository: new RequestRepository(database), generatedLinkRepository: new GeneratedLinkRepository(database)
  });
  const service = new HistoricalUtmCasingRepairService({
    database, intelligenceService, urlService: new UrlService(),
    bitlyService: { async updateDestination(value) { bitlyUpdates.push(value); if (value.shortUrl.endsWith("/failure")) throw Object.assign(new Error("Bitly denied update."), { code: "FORBIDDEN" }); } }
  });
  const plan = await service.plan();
  if (plan.changes.length !== 6 || plan.archived_matches.length !== 1 || plan.direct_qr_warnings.length !== 1 || plan.conflicts.length !== 1) {
    throw new Error(`Unexpected casing repair plan: ${JSON.stringify({ changes: plan.changes.length, archived: plan.archived_matches.length, directQr: plan.direct_qr_warnings.length, conflicts: plan.conflicts.length })}`);
  }
  const report = await service.apply(plan);
  const active = await database.getAsync("SELECT * FROM requests WHERE fingerprint='active'");
  const archived = await database.getAsync("SELECT * FROM requests WHERE fingerprint='archived'");
  const custom = await database.getAsync("SELECT * FROM requests WHERE fingerprint='custom'");
  const failed = await database.getAsync("SELECT * FROM requests WHERE fingerprint='bitly-failure'");
  const conflict = await database.getAsync("SELECT * FROM requests WHERE fingerprint='conflict-a'");
  const generated = await database.getAsync("SELECT * FROM generated_links WHERE fingerprint='active'");
  const activePayload = JSON.parse(active.normalized_payload);
  if (
    report.corrected.length !== 3 || bitlyUpdates.length !== 2 || report.bitly_failures.length !== 1
    || activePayload.utm_term !== "BecomeASponsor"
    || generated.utm_term !== "BecomeASponsor"
    || !active.final_long_url.includes("utm_term=BecomeASponsor")
    || !active.final_long_url.includes("ref=smoke") || !active.final_long_url.endsWith("#section")
    || JSON.parse(archived.normalized_payload).utm_term !== "BecomeAsponsor"
    || JSON.parse(custom.normalized_payload).utm_term !== "CustomAsponsorValue"
    || JSON.parse(failed.normalized_payload).utm_term !== "BecomeAsponsor"
    || JSON.parse(conflict.normalized_payload).utm_term !== "BecomeAsponsor"
  ) throw new Error("Historical UTM casing repair smoke test failed.");
  const secondPlan = await service.plan();
  if (secondPlan.changes.length !== 3 || secondPlan.archived_matches.length !== 1 || secondPlan.changes.some((change) => ["active", "direct"].includes(change.fingerprint))) {
    throw new Error("Historical UTM casing repair is not idempotent.");
  }
  process.stdout.write("Historical UTM casing repair smoke test passed.\n");
} finally {
  await database.close();
  fs.rmSync(directory, { recursive: true, force: true });
}

async function insertRequest(id, fingerprint, payload, url, archivedAt, shortUrl, qrUrl) {
  const created = "2026-01-01T00:00:00.000Z";
  await database.runAsync(`INSERT INTO requests (id,request_uuid,delivery_key,status,original_message,normalized_payload,fingerprint,final_long_url,short_url,qr_url,created_at,updated_at,archived_at) VALUES (:id,:uuid,:delivery,'completed','Smoke',:payload,:fingerprint,:url,:short_url,:qr_url,:created,:created,:archived_at)`, {
    id, uuid: `uuid-${id}`, delivery: `delivery-${id}`, payload: JSON.stringify(payload), fingerprint, url,
    short_url: shortUrl, qr_url: qrUrl, created, archived_at: archivedAt
  });
}
