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
  const targets = [
    ["ConstantContact", "Email", "Learn", "https://bit.ly/4Akgw2f"],
    ["Facebook", "Social", "Read", "https://bit.ly/4zzL5B6"],
    ["Instagram", "Social", "Read", "https://bit.ly/48b0gVs"],
    ["LinkedIn", "Social", "Read", "https://bit.ly/4880YTl"],
    ["Twitter", "Social", "Read", "https://bit.ly/3ULcEIG"]
  ];
  for (const [index, [source, medium, content, shortUrl]] of targets.entries()) {
    const id = index + 1;
    const fingerprint = `old-rad-fingerprint-${id}`;
    const trackedUrl = `${destination}?utm_source=${source}&utm_medium=${medium}&utm_campaign=NewsAndPromos&utm_term=Promos&utm_content=${content}`;
    const payload = { client: "jf", client_display_name: "JF", channel: source, asset_type: medium.toLowerCase(), normalized_destination_url: destination,
      canonical_campaign: "NewsAndPromos", utm_source: source, utm_medium: medium, utm_campaign: "NewsAndPromos", utm_term: "Promos", utm_content: content };
    await database.runAsync("INSERT INTO requests (id,request_uuid,delivery_key,status,original_message,raw_payload,parsed_payload,normalized_payload,fingerprint,final_long_url,short_url,qr_url,bitly_id,bitly_payload,created_at,updated_at) VALUES (:id,:uuid,:delivery,'completed','RAD smoke','{\"original\":true}',:parsed,:normalized,:fingerprint,:tracked,:short_url,:qr_url,:bitly_id,:bitly_payload,:created,:created)", {
      id, uuid: `rad-uuid-${id}`, delivery: `rad-delivery-${id}`, parsed: JSON.stringify(payload), normalized: JSON.stringify(payload), fingerprint,
      tracked: trackedUrl, short_url: shortUrl, qr_url: id === 1 ? "https://qr.example/rad.pdf" : null,
      bitly_id: `bitly-id-${id}`, bitly_payload: JSON.stringify({ link: shortUrl }), created: "2026-11-09T00:00:00.000Z"
    });
    await database.runAsync("INSERT INTO generated_links (fingerprint,client,channel,asset_type,normalized_destination_url,canonical_campaign,utm_source,utm_medium,utm_campaign,utm_term,utm_content,final_long_url,short_url,qr_url,bitly_id,bitly_payload,created_at,updated_at) VALUES (:fingerprint,'jf',:source,:asset_type,:destination,'NewsAndPromos',:source,:medium,'NewsAndPromos','Promos',:content,:tracked,:short_url,:qr_url,:bitly_id,'{\"preserved\":true}',:created,:created)", {
      fingerprint, source, asset_type: medium.toLowerCase(), destination, medium, content, tracked: trackedUrl, short_url: shortUrl,
      qr_url: id === 1 ? "https://qr.example/rad.pdf" : null, bitly_id: `bitly-id-${id}`, created: "2026-11-09T00:00:00.000Z"
    });
  }
  await database.runAsync("INSERT INTO link_audit_events (fingerprint,request_id,action,summary,created_at) VALUES ('old-rad-fingerprint-1',1,'created','Original history',:created)", { created: "2026-11-09T00:00:00.000Z" });

  const service = new RadLinkMigrationService({ database, fingerprintService: new FingerprintService() });
  const plan = await service.plan();
  if (plan.changes.length !== 5 || plan.conflicts.length !== 0) throw new Error("RAD dry-run did not find exactly five safe moves.");
  const report = await service.apply(plan);
  if (report.moved.length !== 5 || report.conflicts.length !== 0) throw new Error("RAD apply result was unexpected.");
  const request = await database.getAsync("SELECT * FROM requests WHERE id=1");
  const generated = await database.getAsync("SELECT * FROM generated_links WHERE fingerprint=:fingerprint", { fingerprint: request.fingerprint });
  const history = await database.allAsync("SELECT * FROM link_audit_events WHERE fingerprint=:fingerprint ORDER BY id", { fingerprint: request.fingerprint });
  const normalized = JSON.parse(request.normalized_payload);
  const parsed = JSON.parse(request.parsed_payload);
  const expectedTracked = `${destination}?utm_source=ConstantContact&utm_medium=Email&utm_campaign=NewsAndPromos&utm_term=Promos&utm_content=Learn`;
  const movedCount = await database.getAsync("SELECT COUNT(*) AS total FROM generated_links WHERE client='rad'");
  if (normalized.client !== "rad" || normalized.client_display_name !== "RAD" || parsed.client !== "rad"
    || generated?.client !== "rad" || request.final_long_url !== expectedTracked || generated.final_long_url !== expectedTracked
    || request.short_url !== "https://bit.ly/4Akgw2f" || generated.short_url !== "https://bit.ly/4Akgw2f"
    || request.qr_url !== "https://qr.example/rad.pdf" || generated.qr_url !== "https://qr.example/rad.pdf"
    || request.bitly_payload !== '{"link":"https://bit.ly/4Akgw2f"}' || generated.bitly_payload !== '{"preserved":true}'
    || Number(movedCount.total) !== 5 || history.length !== 2 || history[0].summary !== "Original history") throw new Error("RAD migration did not preserve link data and history.");
  const second = await service.plan();
  if (second.changes.length !== 0) throw new Error("RAD migration is not idempotent.");
  process.stdout.write("RAD link migration smoke test passed.\n");
} finally { await database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
