import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { UrlService } from "../src/services/url-service.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(projectRoot, "utm_clean_output", "utm_master_clean.csv");
const urlService = new UrlService();

const imports = [
  {
    source: "X",
    output: "x-social-import.csv",
    clients: { fmb: 122, rad: 1 }
  },
  {
    source: "TikTok",
    output: "tiktok-social-import.csv",
    clients: { cic: 151, sfg: 175 }
  }
];

const headers = [
  "request_id",
  "status",
  "client",
  "channel",
  "asset_type",
  "campaign_label",
  "canonical_campaign",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "destination_url",
  "final_long_url",
  "short_url",
  "qr_url",
  "request_count",
  "first_seen_at",
  "last_seen_at",
  "original_message"
];

async function main() {
  const masterRows = parseCsv(await fs.readFile(inputPath, "utf8"));

  for (const definition of imports) {
    const rows = buildRows(masterRows, definition);
    validateRows(rows, definition);
    await writeCsv(path.join(projectRoot, definition.output), rows);
    process.stdout.write(`Wrote and validated ${rows.length} rows in ${definition.output}.\n`);
  }
}

function buildRows(masterRows, definition) {
  const rows = [];

  for (const [client, expectedCount] of Object.entries(definition.clients)) {
    const templates = masterRows.filter((row) => (
      row.client_code.toLowerCase() === client
      && row.source === "Facebook"
      && row.medium === "Social"
    ));

    if (templates.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} Facebook/Social templates for ${client.toUpperCase()}, found ${templates.length}.`);
    }

    for (const template of templates) {
      const timestamp = toIsoTimestamp(template.creation_date);
      const utms = {
        utm_source: definition.source,
        utm_medium: "Social",
        utm_campaign: template.campaign,
        utm_term: template.term,
        utm_content: template.content
      };

      rows.push({
        request_id: String(rows.length + 1),
        status: "completed_without_short_link",
        client: client.toUpperCase(),
        channel: definition.source,
        asset_type: "social",
        campaign_label: template.campaign,
        canonical_campaign: template.campaign,
        ...utms,
        destination_url: template.destination_url,
        final_long_url: urlService.appendUtms(template.destination_url, utms),
        short_url: "",
        qr_url: "",
        request_count: "1",
        first_seen_at: timestamp,
        last_seen_at: timestamp,
        original_message: `${client.toUpperCase()} social UTM | ${template.campaign} | ${definition.source}`
      });
    }
  }

  return rows;
}

function validateRows(rows, definition) {
  const expectedTotal = Object.values(definition.clients).reduce((sum, count) => sum + count, 0);
  const identities = new Set();

  if (rows.length !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} ${definition.source} rows, found ${rows.length}.`);
  }

  for (const row of rows) {
    const parsed = new URL(row.final_long_url);
    const expectedClientCount = definition.clients[row.client.toLowerCase()];
    if (!expectedClientCount || row.channel !== definition.source || row.utm_source !== definition.source
      || row.utm_medium !== "Social" || row.asset_type !== "social" || row.short_url || row.qr_url) {
      throw new Error(`Invalid metadata in ${definition.source} row ${row.request_id}.`);
    }

    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const expected = row[key] || "";
      const actual = parsed.searchParams.get(key) || "";
      if (actual !== expected) {
        throw new Error(`Invalid ${key} in ${definition.source} row ${row.request_id}.`);
      }
    }

    const identity = [
      row.client.toLowerCase(),
      normalizeDestination(row.destination_url),
      row.utm_source.toLowerCase(),
      row.utm_medium.toLowerCase(),
      row.utm_campaign.toLowerCase(),
      row.utm_term.toLowerCase(),
      row.utm_content.toLowerCase()
    ].join("|");
    if (identities.has(identity)) {
      throw new Error(`Duplicate canonical UTM combination in ${definition.source} row ${row.request_id}.`);
    }
    identities.add(identity);
  }

  for (const [client, expectedCount] of Object.entries(definition.clients)) {
    const actualCount = rows.filter((row) => row.client.toLowerCase() === client).length;
    if (actualCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} ${definition.source} rows for ${client.toUpperCase()}, found ${actualCount}.`);
    }
  }
}

async function writeCsv(outputPath, rows) {
  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))
  ].join("\n");
  const temporaryPath = `${outputPath}.tmp`;
  await fs.writeFile(temporaryPath, `${csv}\n`, "utf8");
  await fs.rename(temporaryPath, outputPath);
}

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted && character === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      record.push(field);
      field = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      record.push(field);
      if (record.some((value) => value !== "")) records.push(record);
      record = [];
      field = "";
      if (character === "\r" && next === "\n") index += 1;
    } else {
      field += character;
    }
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }

  const [headersRow = [], ...dataRows] = records;
  return dataRows.map((values) => Object.fromEntries(headersRow.map((header, index) => [header, values[index] ?? ""])));
}

function toIsoTimestamp(date) {
  const value = String(date || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? `${value}T00:00:00.000Z` : new Date(0).toISOString();
}

function normalizeDestination(value) {
  const url = new URL(value);
  url.hash = "";
  return url.toString().replace(/\/$/u, "").toLowerCase();
}

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
