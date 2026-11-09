import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connectDatabase } from "../src/support/database.js";
import { MigrationRunner } from "../src/support/migration-runner.js";
import { FingerprintService } from "../src/services/fingerprint-service.js";
import { RadLinkMigrationService } from "../src/services/rad-link-migration-service.js";

const root = path.resolve(import.meta.dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rad-link-move-"));
const database = await connectDatabase(path.join(directory, "test.sqlite"));
try {
  await new MigrationRunner(database, path.join(root, "database", "utm-builder-migrations")).migrate();
  const destination = "https://redarrowdiner.com/news-promos/serving-those-who-serve-us-veterans-and-active-military-eat-free-on-november-11/";
  const tracked = `${destination}?utm_source=ConstantContact&utm_medium=Email&utm_campaign=NewsAndPromos&utm_term=Promos&utm_content=Learn`;
  const payload = { client: "jf", client_display_name: "JF", channel: "ConstantContact", asset_type: "email", normalized_destination_url: destination,
    canonical_campaign: "NewsAndPromos", utm_source: "ConstantContact", utm_medium: "Email", utm_campaign: "NewsAndPromos", utm_term: "Promos", utm_content: "Learn" };
  await database.runAsync("INSERT INTO requests (id,request_uuid,delivery_key,status,original_message,raw_payload,parsed_payload,normalized_payload,fingerprint,final_long_url,short_url,qr_url,bitly_id,bitly_payload,created_at,updated_at) VALUES (1,'rad-uuid','rad-delivery','completed','RAD smoke','{\"original\":true}',:parsed,:normalized,'old-rad-fingerprint',:tracked,'https://bit.ly/4Akgw2f','https://qr.example/rad.pdf','bitly-id','{\"link\":\"https://bit.ly/4Akgw2f\"}',:created,:created)", {
    parsed: JSON.stringify(payload), normalized: JSON.stringify(payload), tracked, created: "2026-11-09T00:00:00.000Z"
  });
  await database.runAsync("INSERT INTO generated_links (fingerprint,client,channel,asset_type,normalized_destination_url,canonical_campaign,utm_source,utm_medium,utm_campaign,utm_term,utm_content,final_long_url,short_url,qr_url,bitly_id,bitly_payload,created_at,updated_at) VALUES ('old-rad-fingerprint','jf','ConstantContact','email',:destination,'NewsAndPromos','ConstantContact','Email','NewsAndPromos','Promos','Learn',:tracked,'https://bit.ly/4Akgw2f','https://qr.example/rad.pdf','bitly-id','{\"preserved\":true}',:created,:created)", { destination, tracked, created: "2026-11-09T00:00:00.000Z" });
  await database.runAsync("INSERT INTO link_audit_events (fingerprint,request_id,action,summary,created_at) VALUES ('old-rad-fingerprint',1,'created','Original history',:created)", { created: "2026-11-09T00:00:00.000Z" });

  const service = new RadLinkMigrationService({ database, fingerprintService: new FingerprintService() });
  const plan = await service.plan();
  if (plan.changes.length !== 1 || plan.conflicts.length !== 0) throw new Error("RAD dry-run did not find exactly one safe move.");
  const report = await service.apply(plan);
  if (report.moved.length !== 1 || report.conflicts.length !== 0) throw new Error("RAD apply result was unexpected.");
  const request = await database.getAsync("SELECT * FROM requests WHERE id=1");
  const generated = await database.getAsync("SELECT * FROM generated_links WHERE fingerprint=:fingerprint", { fingerprint: request.fingerprint });
  const history = await database.allAsync("SELECT * FROM link_audit_events WHERE fingerprint=:fingerprint ORDER BY id", { fingerprint: request.fingerprint });
  const normalized = JSON.parse(request.normalized_payload);
  const parsed = JSON.parse(request.parsed_payload);
  if (normalized.client !== "rad" || normalized.client_display_name !== "RAD" || parsed.client !== "rad"
    || generated?.client !== "rad" || request.final_long_url !== tracked || generated.final_long_url !== tracked
    || request.short_url !== "https://bit.ly/4Akgw2f" || generated.short_url !== "https://bit.ly/4Akgw2f"
    || request.qr_url !== "https://qr.example/rad.pdf" || generated.qr_url !== "https://qr.example/rad.pdf"
    || request.bitly_payload !== '{"link":"https://bit.ly/4Akgw2f"}' || generated.bitly_payload !== '{"preserved":true}'
    || history.length !== 2 || history[0].summary !== "Original history") throw new Error("RAD migration did not preserve link data and history.");
  const second = await service.plan();
  if (second.changes.length !== 0) throw new Error("RAD migration is not idempotent.");
  process.stdout.write("RAD link migration smoke test passed.\n");
} finally { await database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
