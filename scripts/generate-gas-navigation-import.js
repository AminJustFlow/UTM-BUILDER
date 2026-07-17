import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import appConfig from "../config/app.js";
import { BitlyService } from "../src/services/bitly-service.js";
import { UrlService } from "../src/services/url-service.js";
import { loadEnvFile } from "../src/support/env-loader.js";
import { HttpClient } from "../src/support/http-client.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(projectRoot, ".env"));

const argumentsList = process.argv.slice(2);
const skipBitly = argumentsList.includes("--skip-bitly");
const outputArgument = argumentsList.find((argument) => !argument.startsWith("--"));
const outputPath = path.resolve(projectRoot, outputArgument || "gas-main-navigation-import.csv");

const pages = [
  { name: "Home", url: "https://guardianangelseniorservices.com/", term: "LandingPage" },
  { name: "About", url: "https://guardianangelseniorservices.com/about/" },
  { name: "Team", url: "https://guardianangelseniorservices.com/team/" },
  { name: "News", url: "https://guardianangelseniorservices.com/news/" },
  { name: "Services", url: "https://guardianangelseniorservices.com/services/" },
  { name: "FAQs", url: "https://guardianangelseniorservices.com/faqs/" },
  { name: "Careers", url: "https://guardianangelseniorservices.com/careers/" },
  { name: "Shop", url: "https://www.promoplace.com/guardianangelseniorservices" },
  { name: "Contact", url: "https://guardianangelseniorservices.com/contact/", content: "ContactUs" }
];

const sources = ["Facebook", "GMB", "Instagram", "LinkedIn"];

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
  const accessToken = process.env.BITLY_ACCESS_TOKEN?.trim();
  if (!skipBitly && !accessToken) {
    throw new Error("BITLY_ACCESS_TOKEN is not configured in the environment or .env file.");
  }

  const urlService = new UrlService();
  const bitlyService = new BitlyService(new HttpClient(), {
    accessToken,
    domain: process.env.BITLY_DOMAIN?.trim() || appConfig.bitly.domain,
    groupGuid: process.env.BITLY_GROUP_GUID?.trim() || "",
    apiBase: appConfig.bitly.apiBase,
    timeoutMs: Number(process.env.BITLY_TIMEOUT_MS || appConfig.bitly.timeoutMs)
  });

  const timestamp = new Date().toISOString();
  const rows = [];

  for (const page of pages) {
    for (const source of sources) {
      const utmTerm = page.term || page.name;
      const utmContent = page.content || "LearnMore";
      const finalLongUrl = urlService.appendUtms(page.url, {
        utm_source: source,
        utm_medium: "Social",
        utm_campaign: "Website",
        utm_term: utmTerm,
        utm_content: utmContent
      });
      const shortened = skipBitly ? { link: "" } : await bitlyService.shorten(finalLongUrl);

      rows.push({
        request_id: String(rows.length + 1),
        status: skipBitly ? "completed_without_short_link" : "completed",
        client: "GAS",
        channel: source,
        asset_type: "social",
        campaign_label: "Website",
        canonical_campaign: "Website",
        utm_source: source,
        utm_medium: "Social",
        utm_campaign: "Website",
        utm_term: utmTerm,
        utm_content: utmContent,
        destination_url: page.url,
        final_long_url: finalLongUrl,
        short_url: shortened.link,
        qr_url: "",
        request_count: "1",
        first_seen_at: timestamp,
        last_seen_at: timestamp,
        original_message: `GAS main navigation | ${page.name} | ${source}`
      });

      const action = skipBitly ? "Prepared" : "Shortened";
      console.log(`${action} ${rows.length}/${pages.length * sources.length}: ${page.name} / ${source}`);
    }
  }

  validateRows(rows);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))
  ].join("\n");

  const temporaryPath = `${outputPath}.tmp`;
  await fs.writeFile(temporaryPath, `${csv}\n`, "utf8");
  await fs.rename(temporaryPath, outputPath);
  console.log(`Wrote ${rows.length} rows to ${outputPath}`);
}

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function validateRows(rows) {
  const expectedCount = pages.length * sources.length;
  const uniqueLongUrls = new Set(rows.map((row) => row.final_long_url));
  const destinationCounts = new Map();

  if (rows.length !== expectedCount || uniqueLongUrls.size !== expectedCount) {
    throw new Error(`Expected ${expectedCount} unique rows, received ${rows.length}.`);
  }

  for (const row of rows) {
    const parsed = new URL(row.final_long_url);
    const expectedTerm = row.destination_url === pages[0].url
      ? "LandingPage"
      : pages.find((page) => page.url === row.destination_url)?.name;
    const expectedContent = row.destination_url === pages.at(-1).url ? "ContactUs" : "LearnMore";
    const expectedUtms = {
      utm_source: row.utm_source,
      utm_medium: "Social",
      utm_campaign: "Website",
      utm_term: expectedTerm,
      utm_content: expectedContent
    };

    if (!expectedTerm || row.client !== "GAS" || !sources.includes(row.utm_source)) {
      throw new Error(`Unexpected row metadata for ${row.destination_url}.`);
    }
    for (const [key, value] of Object.entries(expectedUtms)) {
      if (parsed.searchParams.get(key) !== value || row[key] !== value) {
        throw new Error(`Invalid ${key} for ${row.destination_url}.`);
      }
    }
    if (skipBitly ? row.short_url !== "" : !row.short_url) {
      throw new Error(`Invalid short URL for ${row.destination_url}.`);
    }

    destinationCounts.set(row.destination_url, (destinationCounts.get(row.destination_url) || 0) + 1);
  }

  if (pages.some((page) => destinationCounts.get(page.url) !== sources.length)) {
    throw new Error("Every navigation destination must have one row per source.");
  }

  console.log(`Validated ${rows.length} unique rows.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
