import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "../src/support/database.js";
import { loadEnvFile } from "../src/support/env-loader.js";
import { MigrationRunner } from "../src/support/migration-runner.js";
import { resolveConfig } from "../src/support/utm-builder-app-factory.js";
import { FingerprintService } from "../src/services/fingerprint-service.js";
import { RadLinkMigrationService } from "../src/services/rad-link-migration-service.js";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
if (!args.mode || (args.mode === "apply" && (!args.plan || !args.backupConfirmed))) usage();
loadEnvFile(path.join(projectRoot, ".env"));
const config = resolveConfig(projectRoot);
const database = await connectDatabase(config.database);
try {
  await new MigrationRunner(database, path.join(projectRoot, "database", config.database.client === "postgres" ? "utm-builder-migrations-pg" : "utm-builder-migrations")).migrate();
  const service = new RadLinkMigrationService({ database, fingerprintService: new FingerprintService() });
  if (args.mode === "dry-run") {
    const plan = await service.plan();
    const reportPath = path.resolve(args.report || path.join(projectRoot, "storage", "reports", `rad-link-move-plan-${Date.now()}.json`));
    writeJson(reportPath, plan);
    process.stdout.write(`Planned ${plan.changes.length} move(s); conflicts ${plan.conflicts.length}.\nPlan: ${reportPath}\nTake a database backup, then run --apply --plan "${reportPath}" --backup-confirmed.\n`);
  } else {
    const plan = JSON.parse(fs.readFileSync(path.resolve(args.plan), "utf8"));
    const result = await service.apply(plan);
    const reportPath = path.resolve(args.report || path.resolve(args.plan).replace(/\.json$/iu, "-applied.json"));
    writeJson(reportPath, result);
    process.stdout.write(`Moved ${result.moved.length}; conflicts ${result.conflicts.length}.\nReport: ${reportPath}\n`);
    if (result.conflicts.length) process.exitCode = 2;
  }
} finally { await database.close?.(); }

function parseArgs(values) { const result = { mode: values.includes("--dry-run") ? "dry-run" : values.includes("--apply") ? "apply" : null, backupConfirmed: values.includes("--backup-confirmed") }; for (let i=0;i<values.length;i+=1) { if (values[i] === "--plan") result.plan=values[i+1]; if (values[i] === "--report") result.report=values[i+1]; } return result; }
function usage() { process.stderr.write("Usage:\n  npm run move-rad-link -- --dry-run [--report plan.json]\n  npm run move-rad-link -- --apply --plan plan.json --backup-confirmed [--report result.json]\n"); process.exit(2); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
