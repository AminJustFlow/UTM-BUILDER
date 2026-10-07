import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rules from "../config/rules.js";
import { connectDatabase } from "../src/support/database.js";
import { loadEnvFile } from "../src/support/env-loader.js";
import { MigrationRunner } from "../src/support/migration-runner.js";
import { resolveConfig } from "../src/support/utm-builder-app-factory.js";
import { HttpClient } from "../src/support/http-client.js";
import { RequestRepository } from "../src/repositories/request-repository.js";
import { GeneratedLinkRepository } from "../src/repositories/generated-link-repository.js";
import { UtmValueAcknowledgementRepository } from "../src/repositories/utm-value-acknowledgement-repository.js";
import { RulesService } from "../src/services/rules-service.js";
import { UtmIntelligenceService } from "../src/services/utm-intelligence-service.js";
import { BitlyService } from "../src/services/bitly-service.js";
import { UrlService } from "../src/services/url-service.js";
import { HistoricalUtmCasingRepairService } from "../src/services/historical-utm-casing-repair-service.js";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
if (!args.mode || (args.mode === "apply" && (!args.plan || !args.backupConfirmed))) usage();
loadEnvFile(path.join(projectRoot, ".env"));
const config = resolveConfig(projectRoot);
const database = await connectDatabase(config.database);
try {
  await new MigrationRunner(database, path.join(projectRoot, "database", config.database.client === "postgres" ? "utm-builder-migrations-pg" : "utm-builder-migrations")).migrate();
  const rulesService = new RulesService(rules);
  const intelligenceService = new UtmIntelligenceService({
    projectRoot, rulesService,
    requestRepository: new RequestRepository(database),
    generatedLinkRepository: new GeneratedLinkRepository(database),
    utmValueAcknowledgementRepository: new UtmValueAcknowledgementRepository(database)
  });
  const service = new HistoricalUtmCasingRepairService({
    database, intelligenceService,
    bitlyService: new BitlyService(new HttpClient(), config.bitly),
    urlService: new UrlService()
  });
  if (args.mode === "dry-run") {
    const plan = await service.plan();
    const reportPath = path.resolve(args.report || path.join(projectRoot, "storage", "reports", `utm-casing-plan-${Date.now()}.json`));
    writeReports(reportPath, plan);
    process.stdout.write(`${summary(plan)}\nDry-run plan: ${reportPath}\nRun --apply --plan "${reportPath}" --backup-confirmed after taking a database backup.\n`);
  } else {
    const planPath = path.resolve(args.plan);
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const result = await service.apply(plan);
    const reportPath = path.resolve(args.report || planPath.replace(/\.json$/iu, "-applied.json"));
    writeReports(reportPath, result);
    process.stdout.write(`Corrected ${result.corrected.length}; Bitly failures ${result.bitly_failures.length}; conflicts ${result.conflicts.length}.\nApply report: ${reportPath}\n`);
    if (result.bitly_failures.length || result.conflicts.length) process.exitCode = 2;
  }
} finally {
  await database.close?.();
}

function parseArgs(values) {
  const result = { mode: values.includes("--dry-run") ? "dry-run" : values.includes("--apply") ? "apply" : null, backupConfirmed: values.includes("--backup-confirmed") };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--plan") result.plan = values[index + 1];
    if (values[index] === "--report") result.report = values[index + 1];
  }
  return result;
}
function usage() {
  process.stderr.write("Usage:\n  node scripts/repair-historical-utm-casing.js --dry-run [--report plan.json]\n  node scripts/repair-historical-utm-casing.js --apply --plan plan.json --backup-confirmed [--report result.json]\n");
  process.exit(2);
}
function writeReports(jsonPath, report) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const rows = [
    ...(report.changes ?? report.corrected ?? []).map((row) => ({ category: report.changes ? "planned_correction" : "corrected", ...row })),
    ...(report.unchanged_records ?? []).map((row) => ({ category: "unchanged", ...row })),
    ...(report.archived_matches ?? []).map((row) => ({ category: "archived_match", ...row })),
    ...(report.conflicts ?? []).map((row) => ({ category: "conflict", details: row })),
    ...(report.bitly_failures ?? []).map((row) => ({ category: "bitly_failure", details: row })),
    ...(report.direct_qr_warnings ?? []).map((row) => ({ category: "direct_qr_warning", ...row }))
  ];
  const columns = ["category", "type", "id", "fingerprint", "corrections", "final_long_url", "details"];
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(
    ["corrections", "details"].includes(column) ? JSON.stringify(row[column] ?? {}) : row[column] ?? ""
  )).join(","))].join("\n") + "\n";
  fs.writeFileSync(jsonPath.replace(/\.json$/iu, ".csv"), csv);
}
function csvCell(value) { const text = String(value); return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text; }
function summary(plan) { return `Planned ${plan.changes.length} corrections; archived matches ${plan.archived_matches.length}; conflicts ${plan.conflicts.length}; direct QR warnings ${plan.direct_qr_warnings.length}.`; }
