#!/usr/bin/env python3
"""Generate the Village on Technology Hill (VTH) starter UTM import.

The ecosystem workbook is the taxonomy source. Stable website pages receive the
four complete automatic social combinations. Gray/manual campaigns, incomplete
Email/QRCode combinations, and dated NewsAndUpdates items are not generated.
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


CLIENT = "VTH"
APPROVED_HOST = "technologyhillnh.com"
DEFAULT_STATUS = "completed_without_short_link"
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


AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS = (
    SourceMedium("Facebook", "Social"),
    SourceMedium("GMB", "Social"),
    SourceMedium("Instagram", "Social"),
    SourceMedium("LinkedIn", "Social"),
)
MANUAL_OR_UNRESOLVED_COMBINATIONS = (
    SourceMedium("MetaAd", "Social"),
    SourceMedium("{TBD}", "QRCode"),
    SourceMedium("{TBD}", "Email"),
)
STANDARD_CONTENTS: tuple[Optional[str], ...] = ("Read", "Learn", "Explore", None)


def rule(label: str, path: str, campaign: str, term: str,
         contents: tuple[Optional[str], ...] = STANDARD_CONTENTS) -> DestinationRule:
    return DestinationRule(label, path, campaign, term, contents)


DESTINATION_RULES = (
    rule("Home", "/", "HomePage", "LandingPage"),
    rule("Amenities", "/amenities/", "TheVillage", "Amenities"),
    rule("Lifestyle", "/lifestyle/", "TheVillage", "Lifestyle"),
    rule("Child Care", "/child-care/", "TheVillage", "ChildCare"),
    rule("Past Events", "/past-events/", "TheVillage", "PastEvents"),
    rule("FAQs", "/faq/", "TheVillage", "FAQs"),
    rule("One Bedroom", "/1-bedroom/", "Apartments", "1Bedroom"),
    rule("One Bedroom with Den", "/1-bedroom-den/", "Apartments", "1BedroomWithDen"),
    rule("Two Bedroom", "/2-bedroom/", "Apartments", "2Bedroom"),
    rule("Three Bedroom", "/3-bedroom/", "Apartments", "3Bedroom"),
    rule("Book a Tour", "/book-a-tour/", "BookATour", "LandingPage", ("Book", None)),
    rule("Contact Us", "/contact/", "ContactUs", "LandingPage", ("Contact", None)),
    rule("Search Units", "/search-units/", "SearchUnits", "LandingPage", ("Search", "Explore", None)),
)

CURATED_LINKS = (
    {
        "label": "Events postcard QR code",
        "destination_url": "https://technologyhillnh.com/",
        "source": "EventsPostcard", "medium": "QRCode",
        "campaign": "HomePage", "term": "LandingPage", "content": "Scan",
        "creation_date": "2026-10-07T00:00:00.000Z",
    },
)

EXPECTED_DESTINATION_COUNT = 13
EXPECTED_ROW_COUNT = 189


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
    host = (parts.hostname or "").lower()
    if parts.scheme.lower() != "https" or host not in {APPROVED_HOST, f"www.{APPROVED_HOST}"}:
        raise ValueError(f"Destination is outside the approved VTH host: {url!r}")
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
    query.extend((("utm_source", source), ("utm_medium", medium),
                  ("utm_campaign", campaign), ("utm_term", term)))
    if content is not None:
        query.append(("utm_content", content))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def row(request_id: int, timestamp: str, label: str, destination: str,
        source: str, medium: str, campaign: str, term: str,
        content: Optional[str], curated: bool = False) -> dict[str, str | int]:
    destination = normalize_destination(destination)
    return {
        "request_id": request_id,
        "status": DEFAULT_STATUS,
        "client": CLIENT,
        "channel": source,
        "asset_type": medium.lower(),
        "campaign_label": campaign,
        "canonical_campaign": campaign,
        "utm_source": source,
        "utm_medium": medium,
        "utm_campaign": campaign,
        "utm_term": term,
        "utm_content": content or "",
        "destination_url": destination,
        "final_long_url": build_final_url(destination, source, medium, campaign, term, content),
        "short_url": "",
        "qr_url": "",
        "request_count": 1,
        "first_seen_at": timestamp,
        "last_seen_at": timestamp,
        "original_message": f"VTH {'curated link' if curated else 'starter database'} | {label} | {source} | {content if content is not None else '{null}'}",
    }


def generate_rows(start_id: int, timestamp: str) -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    request_id = start_id
    for item in DESTINATION_RULES:
        for combination in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS:
            for content in item.contents:
                rows.append(row(request_id, timestamp, item.label, item.destination_url,
                                combination.source, combination.medium, item.campaign,
                                item.term, content))
                request_id += 1
    for item in CURATED_LINKS:
        rows.append(row(request_id, item["creation_date"], item["label"],
                        item["destination_url"], item["source"], item["medium"],
                        item["campaign"], item["term"], item["content"], True))
        request_id += 1
    return rows


def validate_rows(rows: Sequence[dict[str, str | int]]) -> None:
    errors: list[str] = []
    if len(DESTINATION_RULES) != EXPECTED_DESTINATION_COUNT:
        errors.append(f"Expected {EXPECTED_DESTINATION_COUNT} destinations but found {len(DESTINATION_RULES)}.")
    if len(rows) != EXPECTED_ROW_COUNT:
        errors.append(f"Expected {EXPECTED_ROW_COUNT} rows but generated {len(rows)}.")
    if len({str(item["final_long_url"]) for item in rows}) != len(rows):
        errors.append("Duplicate final URLs were generated.")
    automatic_pairs = {(item.source, item.medium) for item in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS}
    curated_pairs = {(item["source"], item["medium"]) for item in CURATED_LINKS}
    for item in rows:
        destination = urlsplit(str(item["destination_url"]))
        query = dict(parse_qsl(urlsplit(str(item["final_long_url"])).query, keep_blank_values=True))
        pair = (str(item["utm_source"]), str(item["utm_medium"]))
        if item["client"] != CLIENT or destination.scheme != "https" or destination.hostname != APPROVED_HOST:
            errors.append(f"Invalid client or destination in request {item['request_id']}.")
            break
        if pair not in automatic_pairs | curated_pairs:
            errors.append(f"Invalid source/medium in request {item['request_id']}.")
            break
        expected = {"utm_source": str(item["utm_source"]), "utm_medium": str(item["utm_medium"]),
                    "utm_campaign": str(item["utm_campaign"]), "utm_term": str(item["utm_term"])}
        if any(query.get(key) != value for key, value in expected.items()):
            errors.append(f"UTM mismatch in request {item['request_id']}.")
            break
        content = str(item["utm_content"])
        if (content and query.get("utm_content") != content) or (not content and "utm_content" in query):
            errors.append(f"utm_content mismatch in request {item['request_id']}.")
            break
        if str(item["utm_campaign"]) == "NewsAndUpdates":
            errors.append("NewsAndUpdates requires dated campaign-specific input and must not be generated.")
            break
    if errors:
        raise ValueError("Validation failed:\n- " + "\n- ".join(errors))


def write_csv(rows: Iterable[dict[str, str | int]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(CSV_COLUMNS), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Generate the 189-row VTH starter UTM library.")
    parser.add_argument("--output", type=Path, default=Path("vth-starter-utm-import.csv"))
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
        print(f"Blank utm_content rows: {sum(item['utm_content'] == '' for item in rows)}")
        for campaign, count in sorted(Counter(str(item["utm_campaign"]) for item in rows).items()):
            print(f"  {campaign}: {count}")
        print("Validation: PASSED")
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
