#!/usr/bin/env python3
"""Generate the Fimbel (FMB) starter UTM library import CSV.

The curated destinations follow the approved FMB ecosystem workbook and the
current fimbel.com navigation. Gray/manual campaigns, individual products,
unrepresented pages, and unresolved QR/DigitalAd sources are excluded.
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


CLIENT = "FMB"
DEFAULT_STATUS = "completed_without_short_link"
APPROVED_HOST = "fimbel.com"

CSV_COLUMNS: tuple[str, ...] = (
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

    @property
    def asset_type(self) -> str:
        return self.medium.lower()


@dataclass(frozen=True)
class DestinationRule:
    label: str
    path: str
    campaign: str
    term: str
    contents: tuple[Optional[str], ...]

    @property
    def destination_url(self) -> str:
        return f"https://{APPROVED_HOST}{self.path}"


AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS: tuple[SourceMedium, ...] = (
    SourceMedium("Facebook", "Social"),
    SourceMedium("GMB", "Social"),
    SourceMedium("Instagram", "Social"),
    SourceMedium("LinkedIn", "Social"),
    SourceMedium("ConstantContact", "Email"),
)

MANUAL_OR_UNRESOLVED_COMBINATIONS: tuple[SourceMedium, ...] = (
    SourceMedium("MetaAd", "Social"),
    SourceMedium("{TBD}", "QRCode"),
    SourceMedium("{TBD}", "DigitalAd"),
)

STANDARD_CONTENTS: tuple[Optional[str], ...] = ("Learn", "Explore", None)
NEWS_CONTENTS: tuple[Optional[str], ...] = ("Read", "Learn", None)
MOBILE_CONTENTS: tuple[Optional[str], ...] = ("Read", "Learn", "Explore", None)


def rule(label: str, path: str, campaign: str, term: str,
         contents: tuple[Optional[str], ...] = STANDARD_CONTENTS) -> DestinationRule:
    return DestinationRule(label, path, campaign.strip(), term.strip(), contents)


DESTINATION_RULES: tuple[DestinationRule, ...] = (
    rule("Home", "/", "HomePage", "LandingPage"),

    rule("Garage Doors", "/garage-doors/", "GarageDoors", "LandingPage"),
    rule("Residential Garage Doors", "/garage-doors/residential/", "GarageDoors", "ResidentialGarageDoors"),
    rule("Garage Door Styles", "/garage-doors/styles/", "GarageDoors", "Styles"),
    rule("Garage Door Materials", "/garage-doors/materials/", "GarageDoors", "Materials"),

    rule("All Garage Door Products", "/products/garage-doors/", "Products", "AllProducts"),
    rule("Residential Products", "/products/garage-doors/?stpb_cat=residential", "Products", "Residential"),
    rule("Amarr Products", "/products/garage-doors/?stpb_manufacturer=amarr", "Products", "Amarr"),
    rule("CHI Products", "/products/garage-doors/?stpb_manufacturer=chi", "Products", "CHI"),
    rule("FADS Products", "/products/garage-doors/?stpb_manufacturer=fads", "Products", "FADS"),
    rule("Commercial Products", "/products/garage-doors/?stpb_cat=commercial", "Products", "Commercial"),
    rule("Trac-Rite Products", "/products/garage-doors/?stpb_manufacturer=trac-rite", "Products", "Trac-Rite"),

    rule("Commercial", "/commercial/", "Commercial", "LandingPage"),
    rule("Commercial Garage Doors", "/commercial/garage-doors/", "Commercial", "CommercialGarageDoors"),
    rule("Loading Dock Solutions", "/commercial/loading-dock-solutions/", "Commercial", "LoadingDockSolutions"),

    rule("Services", "/services/", "Services", "LandingPage"),
    rule("Garage Door Installation", "/services/garage-door-installation/", "Services", "GarageDoorInstallation"),
    rule("Garage Door Repair", "/services/garage-door-repair/", "Services", "GarageDoorRepair"),
    rule("Emergency Repair", "/services/emergency-garage-door-repair/", "Services", "EmergencyRepair"),
    rule("Panel Replacement", "/services/panel-replacement/", "Services", "PanelReplacement"),
    rule("Garage Door Opener Installation", "/services/garage-door-opener-installation/", "Services", "GarageDoorOpenerInstallation"),
    rule("Maintenance Plans", "/services/maintenance-plans/", "Services", "MaintenancePlans"),
    rule("Consultation", "/services/consultation/", "Services", "Consultation"),
    rule("Parts", "/services/parts/", "Services", "Parts"),
    rule("Service Areas", "/services/service-areas/", "Services", "ServiceAreas"),

    rule("Products", "/products/", "Products", "LandingPage"),
    rule("Garage Doors Catalogue", "/products/garage-doors/", "Products", "GarageDoors"),
    rule("Garage Door Openers", "/products/garage-door-openers/", "Products", "GarageDoorOpeners"),

    rule("Locations", "/locations/", "Locations", "LandingPage"),
    rule("Merrimack", "/locations/merrimack-nh/", "Locations", "Merrimack"),
    rule("Epping", "/locations/epping-nh/", "Locations", "Epping"),

    rule("About Fimbel", "/about/", "AboutFimbel", "LandingPage"),
    rule("Fimbel Price Match Guarantee", "/about/price-match-guarantee/", "AboutFimbel", "FimbelPriceMatchGuarantee"),
    rule("Careers", "/careers/", "AboutFimbel", "Careers"),
    rule("Customer Reviews", "/reviews/", "AboutFimbel", "CustomerReviews"),

    rule("Resources", "/resources/", "Resources", "LandingPage"),
    rule("Garage Door Buying Guide", "/resources/garage-door-buying-guide/", "Resources", "BuyingGuide"),
    rule("Garage Door Troubleshooting Guide", "/resources/garage-door-troubleshooting-guide/", "Resources", "TroubleshootingGuide"),

    rule("Contact", "/contact/", "Contact", "LandingPage", ("Contact",)),
    rule(
        "October 2, 2026 press release",
        "/epping-community-supports-fimbel-garage-doors-new-showroom-grand-opening/",
        "News", "10022026", NEWS_CONTENTS,
    ),
    rule("Mobile Links", "/links/", "MobileLinks", "LandingPage", MOBILE_CONTENTS),
)

EXPECTED_DESTINATION_RULE_COUNT = 41
EXPECTED_UNIQUE_DESTINATION_COUNT = 40
EXPECTED_ROW_COUNT = 610


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def validate_timestamp(value: str) -> str:
    candidate = value.strip()
    if not candidate.endswith("Z"):
        raise argparse.ArgumentTypeError("Timestamp must be UTC and end in Z.")
    try:
        datetime.fromisoformat(candidate[:-1] + "+00:00")
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid ISO timestamp: {value}") from exc
    return candidate


def normalize_destination(url: str) -> str:
    parts = urlsplit(url.strip())
    if parts.scheme.lower() != "https" or (parts.hostname or "").lower() != APPROVED_HOST:
        raise ValueError(f"Destination is outside the approved FMB host: {url!r}")
    query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
             if not key.lower().startswith("utm_")]
    path = parts.path or "/"
    if not path.endswith("/"):
        path += "/"
    return urlunsplit(("https", APPROVED_HOST, path, urlencode(query, doseq=True), ""))


def build_final_url(destination_url: str, source: str, medium: str,
                    campaign: str, term: str, content: Optional[str]) -> str:
    parts = urlsplit(normalize_destination(destination_url))
    query = list(parse_qsl(parts.query, keep_blank_values=True))
    query.extend((
        ("utm_source", source), ("utm_medium", medium),
        ("utm_campaign", campaign), ("utm_term", term),
    ))
    if content is not None:
        query.append(("utm_content", content))
    return urlunsplit((parts.scheme, parts.netloc, parts.path,
                       urlencode(query, doseq=True), ""))


def generate_rows(start_id: int, timestamp: str) -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    request_id = start_id
    for item in DESTINATION_RULES:
        destination = normalize_destination(item.destination_url)
        for source_medium in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS:
            for content in item.contents:
                rows.append({
                    "request_id": request_id,
                    "status": DEFAULT_STATUS,
                    "client": CLIENT,
                    "channel": source_medium.source,
                    "asset_type": source_medium.asset_type,
                    "campaign_label": item.campaign,
                    "canonical_campaign": item.campaign,
                    "utm_source": source_medium.source,
                    "utm_medium": source_medium.medium,
                    "utm_campaign": item.campaign,
                    "utm_term": item.term,
                    "utm_content": content or "",
                    "destination_url": destination,
                    "final_long_url": build_final_url(
                        destination, source_medium.source, source_medium.medium,
                        item.campaign, item.term, content,
                    ),
                    "short_url": "",
                    "qr_url": "",
                    "request_count": 1,
                    "first_seen_at": timestamp,
                    "last_seen_at": timestamp,
                    "original_message": (
                        f"FMB starter database | {item.label} | "
                        f"{source_medium.source} | {content if content is not None else '{null}'}"
                    ),
                })
                request_id += 1
    return rows


def validate_template_header(template_path: Path) -> None:
    with template_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        try:
            header = tuple(next(reader))
        except StopIteration as exc:
            raise ValueError(f"Template CSV is empty: {template_path}") from exc
    if header != CSV_COLUMNS:
        raise ValueError("Template header does not match the required import format.")


def validate_rows(rows: Sequence[dict[str, str | int]]) -> None:
    errors: list[str] = []
    destinations = {str(row["destination_url"]) for row in rows}
    if len(DESTINATION_RULES) != EXPECTED_DESTINATION_RULE_COUNT:
        errors.append(f"Expected {EXPECTED_DESTINATION_RULE_COUNT} rules but found {len(DESTINATION_RULES)}.")
    if len(destinations) != EXPECTED_UNIQUE_DESTINATION_COUNT:
        errors.append(f"Expected {EXPECTED_UNIQUE_DESTINATION_COUNT} unique destinations but found {len(destinations)}.")
    if len(rows) != EXPECTED_ROW_COUNT:
        errors.append(f"Expected {EXPECTED_ROW_COUNT} rows but generated {len(rows)}.")
    if len({str(row['final_long_url']) for row in rows}) != len(rows):
        errors.append("Duplicate final URLs were generated.")
    if len({int(row['request_id']) for row in rows}) != len(rows):
        errors.append("Duplicate request IDs were generated.")

    allowed_pairs = {(item.source, item.medium) for item in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS}
    excluded_pairs = {(item.source, item.medium) for item in MANUAL_OR_UNRESOLVED_COMBINATIONS}
    excluded_campaigns = {"LimitedCampaign", "MetaAdCampaignName", "Website", "Community", "EppingShowroom"}
    for row in rows:
        destination = str(row["destination_url"])
        destination_parts = urlsplit(destination)
        final_parts = urlsplit(str(row["final_long_url"]))
        query_pairs = parse_qsl(final_parts.query, keep_blank_values=True)
        query = dict(query_pairs)
        pair = (str(row["utm_source"]), str(row["utm_medium"]))
        if row["client"] != CLIENT:
            errors.append(f"Invalid client in request {row['request_id']}.")
            break
        if pair not in allowed_pairs or pair in excluded_pairs:
            errors.append(f"Invalid source/medium in request {row['request_id']}.")
            break
        if str(row["utm_campaign"]) in excluded_campaigns:
            errors.append(f"Excluded campaign generated in request {row['request_id']}.")
            break
        if destination_parts.scheme != "https" or destination_parts.hostname != APPROVED_HOST:
            errors.append(f"Invalid destination generated: {destination}")
            break
        if "/products/garage-doors/" in destination_parts.path and destination_parts.query:
            allowed_filters = {"stpb_cat", "stpb_manufacturer"}
            if any(key not in allowed_filters for key, _value in parse_qsl(destination_parts.query)):
                errors.append(f"Invalid product filter generated: {destination}")
                break
            if query_pairs[:1] != parse_qsl(destination_parts.query, keep_blank_values=True):
                errors.append(f"Product filter was not preserved first in request {row['request_id']}.")
                break
        expected = {
            "utm_source": str(row["utm_source"]),
            "utm_medium": str(row["utm_medium"]),
            "utm_campaign": str(row["utm_campaign"]),
            "utm_term": str(row["utm_term"]),
        }
        if any(query.get(key) != value for key, value in expected.items()):
            errors.append(f"UTM mismatch in request {row['request_id']}.")
            break
        content = str(row["utm_content"])
        if (content and query.get("utm_content") != content) or (
                not content and "utm_content" in query):
            errors.append(f"utm_content mismatch in request {row['request_id']}.")
            break
        if row["short_url"] or row["qr_url"]:
            errors.append(f"Short or QR URL unexpectedly populated in request {row['request_id']}.")
            break
    if errors:
        raise ValueError("Validation failed:\n- " + "\n- ".join(errors))


def write_csv(rows: Iterable[dict[str, str | int]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(CSV_COLUMNS),
                                extrasaction="raise", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def print_summary(rows: Sequence[dict[str, str | int]], output_path: Path) -> None:
    campaigns = Counter(str(row["utm_campaign"]) for row in rows)
    print(f"Created: {output_path.resolve()}")
    print(f"Rules: {len(DESTINATION_RULES)}")
    print(f"Unique destinations: {len({str(row['destination_url']) for row in rows})}")
    print(f"Rows: {len(rows)}")
    print(f"Blank utm_content rows: {sum(row['utm_content'] == '' for row in rows)}")
    print("Rows by campaign:")
    for campaign, count in sorted(campaigns.items()):
        print(f"  {campaign}: {count}")
    print("Validation: PASSED")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=f"Generate the {EXPECTED_ROW_COUNT}-row FMB starter UTM library."
    )
    parser.add_argument("--output", type=Path,
                        default=Path("fmb-starter-utm-import.csv"))
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--timestamp", type=validate_timestamp, default=None)
    parser.add_argument("--template", type=Path, default=None)
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    if args.start_id < 1:
        print("Error: --start-id must be 1 or greater.", file=sys.stderr)
        return 2
    try:
        if args.template is not None:
            validate_template_header(args.template)
        rows = generate_rows(args.start_id, args.timestamp or utc_timestamp())
        validate_rows(rows)
        write_csv(rows, args.output)
        print_summary(rows, args.output)
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
