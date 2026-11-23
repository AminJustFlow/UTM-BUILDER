#!/usr/bin/env python3
"""Generate the approved AAA Pump Service starter UTM import CSV.

The ecosystem workbook is authoritative. Gray/manual campaigns and source
combinations are intentionally excluded. The current page sitemap contains 20
pages; the two thank-you pages are excluded, leaving 17 approved destinations
and 340 generated rows.
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional, Sequence
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


CLIENT = "AAA"
APPROVED_HOST = "aaapumpservice.com"
DEFAULT_STATUS = "completed_without_short_link"
EXPECTED_DESTINATION_COUNT = 17
EXPECTED_ROW_COUNT = 340

CSV_COLUMNS = (
    "request_id", "status", "client", "channel", "asset_type",
    "campaign_label", "canonical_campaign", "utm_source", "utm_medium",
    "utm_campaign", "utm_term", "utm_content", "destination_url",
    "final_long_url", "short_url", "qr_url", "request_count",
    "first_seen_at", "last_seen_at", "original_message",
)


@dataclass(frozen=True)
class SourceMedium:
    source: str
    medium: str


@dataclass(frozen=True)
class DestinationRule:
    label: str
    destination_url: str
    campaign: str
    term: str


AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS = (
    SourceMedium("Facebook", "Social"),
    SourceMedium("GMB", "Social"),
    SourceMedium("Instagram", "Social"),
    SourceMedium("LinkedIn", "Social"),
    SourceMedium("ConstantContact", "Email"),
)

STANDARD_CONTENTS: tuple[Optional[str], ...] = ("Read", "Learn", "Explore", None)

DESTINATION_RULES = (
    DestinationRule("Home", "https://aaapumpservice.com/", "HomePage", "LandingPage"),
    DestinationRule("Careers", "https://aaapumpservice.com/careers/", "Careers", "LandingPage"),
    DestinationRule("Sewage Pump Sales", "https://aaapumpservice.com/sewage-pump-sales/", "SewagePumpSales", "LandingPage"),
    DestinationRule("Industrial Commercial Pump Sales", "https://aaapumpservice.com/industrial-commercial-pump-sales/", "SewagePumpSales", "IndustrialCommercialPumpSales"),
    DestinationRule("Electric Motor Sales", "https://aaapumpservice.com/electric-motor-sales/", "ElectricMotorSales", "LandingPage"),
    DestinationRule("Sewage Pump Service and Installation", "https://aaapumpservice.com/sewage-pump-service-installation/", "SewagePumpServiceAndInstallation", "LandingPage"),
    DestinationRule("Residential", "https://aaapumpservice.com/residential/", "SewagePumpServiceAndInstallation", "Residential"),
    DestinationRule("Industrial", "https://aaapumpservice.com/industrial/", "SewagePumpServiceAndInstallation", "Industrial"),
    DestinationRule("Commercial", "https://aaapumpservice.com/commercial/", "SewagePumpServiceAndInstallation", "Commercial"),
    DestinationRule("Contractors", "https://aaapumpservice.com/contractors/", "SewagePumpServiceAndInstallation", "Contractors"),
    DestinationRule("Electric Motor Repairs", "https://aaapumpservice.com/electric-motor-repairs/", "ElectricMotorRepairs", "LandingPage"),
    DestinationRule("About Us", "https://aaapumpservice.com/about-us/", "AboutUs", "LandingPage"),
    DestinationRule("Our History", "https://aaapumpservice.com/our-history/", "AboutUs", "OurHistory"),
    DestinationRule("Contact", "https://aaapumpservice.com/contact/", "AboutUs", "Contact"),
    DestinationRule("Products", "https://aaapumpservice.com/products/", "AboutUs", "Products"),
    DestinationRule("Partnerships", "https://aaapumpservice.com/partnerships/", "AboutUs", "Partnerships"),
    DestinationRule("Reviews", "https://aaapumpservice.com/reviews/", "Reviews", "LandingPage"),
)


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def validate_timestamp(value: str) -> str:
    candidate = value.strip()
    if not candidate.endswith("Z"):
        raise argparse.ArgumentTypeError("Timestamp must be UTC and end in Z.")
    try:
        datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError as error:
        raise argparse.ArgumentTypeError("Timestamp must be valid ISO-8601.") from error
    return candidate


def normalize_destination(value: str) -> str:
    parts = urlsplit(value.strip())
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", parts.query, ""))


def build_final_url(destination: str, source: str, medium: str, campaign: str, term: str, content: Optional[str]) -> str:
    parts = urlsplit(destination)
    query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True) if not key.lower().startswith("utm_")]
    query.extend((("utm_source", source), ("utm_medium", medium), ("utm_campaign", campaign), ("utm_term", term)))
    if content is not None:
        query.append(("utm_content", content))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def generate_rows(start_id: int, timestamp: str) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    request_id = start_id
    for destination in DESTINATION_RULES:
        for combination in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS:
            for content in STANDARD_CONTENTS:
                url = normalize_destination(destination.destination_url)
                rows.append({
                    "request_id": request_id,
                    "status": DEFAULT_STATUS,
                    "client": CLIENT,
                    "channel": combination.source,
                    "asset_type": combination.medium.lower(),
                    "campaign_label": destination.campaign,
                    "canonical_campaign": destination.campaign,
                    "utm_source": combination.source,
                    "utm_medium": combination.medium,
                    "utm_campaign": destination.campaign,
                    "utm_term": destination.term,
                    "utm_content": content or "",
                    "destination_url": url,
                    "final_long_url": build_final_url(url, combination.source, combination.medium, destination.campaign, destination.term, content),
                    "short_url": "",
                    "qr_url": "",
                    "request_count": 1,
                    "first_seen_at": timestamp,
                    "last_seen_at": timestamp,
                    "original_message": f"AAA starter database | {destination.label} | {combination.source} | {content if content is not None else '{null}'}",
                })
                request_id += 1
    return rows


def validate_rows(rows: Sequence[dict[str, object]]) -> None:
    errors: list[str] = []
    destinations = {rule.destination_url for rule in DESTINATION_RULES}
    if len(DESTINATION_RULES) != EXPECTED_DESTINATION_COUNT or len(destinations) != EXPECTED_DESTINATION_COUNT:
        errors.append(f"Expected {EXPECTED_DESTINATION_COUNT} unique destinations but found {len(destinations)}.")
    if len(rows) != EXPECTED_ROW_COUNT:
        errors.append(f"Expected {EXPECTED_ROW_COUNT} rows but generated {len(rows)}.")
    if len({str(row['final_long_url']) for row in rows}) != len(rows):
        errors.append("Duplicate final URLs were generated.")
    for row in rows:
        destination = urlsplit(str(row["destination_url"]))
        query = dict(parse_qsl(urlsplit(str(row["final_long_url"])).query, keep_blank_values=True))
        if row["client"] != CLIENT or destination.scheme != "https" or destination.hostname != APPROVED_HOST:
            errors.append(f"Invalid client or destination in request {row['request_id']}.")
            break
        expected = {"utm_source": row["utm_source"], "utm_medium": row["utm_medium"], "utm_campaign": row["utm_campaign"], "utm_term": row["utm_term"]}
        if any(query.get(key) != value for key, value in expected.items()):
            errors.append(f"UTM mismatch in request {row['request_id']}.")
            break
        content = str(row["utm_content"])
        if (content and query.get("utm_content") != content) or (not content and "utm_content" in query):
            errors.append(f"Content mismatch in request {row['request_id']}.")
            break
        if str(row["utm_campaign"]) in {"LimitedCampaign", "MetaAdCampaignName", "Website", "Media", "MobileLinks"}:
            errors.append(f"Manual or unresolved campaign generated in request {row['request_id']}.")
            break
    if errors:
        raise ValueError("Validation failed:\n- " + "\n- ".join(errors))


def write_csv(rows: Iterable[dict[str, object]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Generate the 340-row AAA starter UTM library.")
    parser.add_argument("--output", type=Path, default=Path("aaa-starter-utm-import.csv"))
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--timestamp", type=validate_timestamp, default=None)
    args = parser.parse_args(argv)
    try:
        rows = generate_rows(args.start_id, args.timestamp or utc_timestamp())
        validate_rows(rows)
        write_csv(rows, args.output)
        print(f"Created: {args.output.resolve()}")
        print(f"Destinations: {len(DESTINATION_RULES)}")
        print(f"Rows: {len(rows)}")
        print(f"Blank utm_content rows: {sum(row['utm_content'] == '' for row in rows)}")
        for campaign, count in sorted(Counter(str(row["utm_campaign"]) for row in rows).items()):
            print(f"  {campaign}: {count}")
        print("Validation: PASSED")
    except (OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
