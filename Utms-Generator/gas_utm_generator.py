#!/usr/bin/env python3
"""Generate the GAS starter UTM database in the required import CSV format.

This script uses only the Python standard library.

Default output:
    gas-starter-utm-import.csv

Expected starter database:
    170 unique UTM records

The literal spreadsheet value ``{null}`` is represented internally as ``None``.
For those records, the CSV's ``utm_content`` field is blank and the generated
URL does not contain a ``utm_content`` query parameter.
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


CLIENT = "GAS"
DEFAULT_STATUS = "completed_without_short_link"
EXPECTED_ROW_COUNT = 170

CSV_COLUMNS: tuple[str, ...] = (
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
    "original_message",
)


@dataclass(frozen=True)
class SourceMedium:
    source: str
    medium: str

    @property
    def asset_type(self) -> str:
        """Map the import's asset_type field to the lowercase UTM medium."""
        return self.medium.lower()


@dataclass(frozen=True)
class DestinationRule:
    label: str
    destination_url: str
    campaign: str
    term: str
    contents: tuple[Optional[str], ...]


# These five combinations are the non-gray source and medium combinations
# approved for the starter source-of-truth database.
AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS: tuple[SourceMedium, ...] = (
    SourceMedium("Facebook", "Social"),
    SourceMedium("GMB", "Social"),
    SourceMedium("Instagram", "Social"),
    SourceMedium("LinkedIn", "Social"),
    SourceMedium("ConstantContact", "Email"),
)

# Retained for future manual generation. These are intentionally excluded from
# the starter database produced by this script.
MANUAL_SOURCE_MEDIUM_COMBINATIONS: tuple[SourceMedium, ...] = (
    SourceMedium("MetaAd", "Social"),
    SourceMedium("CCABusDirectory", "QRCode"),
    SourceMedium("HamptonChamberFlyer", "QRCode"),
    SourceMedium("HamptonChamberFlyer", "Email"),
    SourceMedium("SSElderServices", "QRCode"),
)

STANDARD_CONTENTS: tuple[Optional[str], ...] = ("Read", "Learn", "Explore", None)

# News is intentionally excluded. Locations replaces News in the starter set.
DESTINATION_RULES: tuple[DestinationRule, ...] = (
    DestinationRule(
        label="Home",
        destination_url="https://guardianangelseniorservices.com/",
        campaign="HomePage",
        term="LandingPage",
        contents=STANDARD_CONTENTS,
    ),
    DestinationRule(
        label="About",
        destination_url="https://guardianangelseniorservices.com/about/",
        campaign="About",
        term="LandingPage",
        contents=STANDARD_CONTENTS,
    ),
    DestinationRule(
        label="Team",
        destination_url="https://guardianangelseniorservices.com/team/",
        campaign="About",
        term="Team",
        contents=STANDARD_CONTENTS,
    ),
    DestinationRule(
        label="Locations",
        destination_url="https://guardianangelseniorservices.com/locations/",
        campaign="About",
        term="Locations",
        contents=STANDARD_CONTENTS,
    ),
    DestinationRule(
        label="Services",
        destination_url="https://guardianangelseniorservices.com/services/",
        campaign="Services",
        term="LandingPage",
        contents=STANDARD_CONTENTS,
    ),
    DestinationRule(
        label="FAQs",
        destination_url="https://guardianangelseniorservices.com/faqs/",
        campaign="Services",
        term="FAQs",
        contents=STANDARD_CONTENTS,
    ),
    DestinationRule(
        label="Careers",
        destination_url="https://guardianangelseniorservices.com/careers/",
        campaign="Careers",
        term="Caregiver",
        contents=("Read", "Learn", "Explore", "Apply", None),
    ),
    DestinationRule(
        label="Shop",
        destination_url="https://www.promoplace.com/guardianangelseniorservices",
        campaign="Shop",
        term="LandingPage",
        contents=("Explore", "Shop", None),
    ),
    DestinationRule(
        label="Contact",
        destination_url="https://guardianangelseniorservices.com/contact/",
        campaign="Contact",
        term="LandingPage",
        contents=("Contact", None),
    ),
)


def utc_timestamp() -> str:
    """Return a UTC timestamp matching the attached import file's format."""
    now = datetime.now(timezone.utc)
    return now.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def validate_timestamp(value: str) -> str:
    """Validate a supplied timestamp and return it unchanged."""
    candidate = value.strip()
    if not candidate.endswith("Z"):
        raise argparse.ArgumentTypeError(
            "Timestamp must be UTC and end in Z, for example "
            "2026-07-31T15:45:00.000Z"
        )
    try:
        datetime.fromisoformat(candidate[:-1] + "+00:00")
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid ISO timestamp: {value}") from exc
    return candidate


def normalize_destination(url: str) -> str:
    """Return a canonical destination without fragments or UTM parameters."""
    parts = urlsplit(url.strip())
    if parts.scheme.lower() not in {"http", "https"} or not parts.netloc:
        raise ValueError(f"Invalid destination URL: {url!r}")

    cleaned_query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_")
    ]

    path = parts.path or "/"
    hostname = (parts.hostname or "").lower()

    # GAS WordPress pages use a trailing slash. The external PromoPlace URL is
    # kept exactly as configured because it is not a GAS WordPress route.
    if hostname == "guardianangelseniorservices.com" and not path.endswith("/"):
        path += "/"

    return urlunsplit(
        (
            parts.scheme.lower(),
            parts.netloc.lower(),
            path,
            urlencode(cleaned_query, doseq=True),
            "",
        )
    )


def build_final_url(
    destination_url: str,
    source: str,
    medium: str,
    campaign: str,
    term: str,
    content: Optional[str],
) -> str:
    """Build a final URL with deterministic UTM parameter ordering."""
    normalized = normalize_destination(destination_url)
    parts = urlsplit(normalized)

    query_items = list(parse_qsl(parts.query, keep_blank_values=True))
    query_items.extend(
        (
            ("utm_source", source),
            ("utm_medium", medium),
            ("utm_campaign", campaign),
            ("utm_term", term),
        )
    )
    if content is not None:
        query_items.append(("utm_content", content))

    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(query_items, doseq=True),
            "",
        )
    )


def generate_rows(start_id: int, timestamp: str) -> list[dict[str, str | int]]:
    """Expand all approved rules into import-ready rows."""
    rows: list[dict[str, str | int]] = []
    request_id = start_id

    for rule in DESTINATION_RULES:
        destination = normalize_destination(rule.destination_url)

        for source_medium in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS:
            for content in rule.contents:
                content_label = content if content is not None else "{null}"
                final_url = build_final_url(
                    destination_url=destination,
                    source=source_medium.source,
                    medium=source_medium.medium,
                    campaign=rule.campaign,
                    term=rule.term,
                    content=content,
                )

                rows.append(
                    {
                        "request_id": request_id,
                        "status": DEFAULT_STATUS,
                        "client": CLIENT,
                        "channel": source_medium.source,
                        "asset_type": source_medium.asset_type,
                        "campaign_label": rule.campaign,
                        "canonical_campaign": rule.campaign,
                        "utm_source": source_medium.source,
                        "utm_medium": source_medium.medium,
                        "utm_campaign": rule.campaign,
                        "utm_term": rule.term,
                        "utm_content": content or "",
                        "destination_url": destination,
                        "final_long_url": final_url,
                        "short_url": "",
                        "qr_url": "",
                        "request_count": 1,
                        "first_seen_at": timestamp,
                        "last_seen_at": timestamp,
                        "original_message": (
                            f"GAS starter database | {rule.label} | "
                            f"{source_medium.source} | {content_label}"
                        ),
                    }
                )
                request_id += 1

    return rows


def validate_template_header(template_path: Path) -> None:
    """Confirm an existing import template has the exact expected columns."""
    with template_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        try:
            header = tuple(next(reader))
        except StopIteration as exc:
            raise ValueError(f"Template CSV is empty: {template_path}") from exc

    if header != CSV_COLUMNS:
        missing = [column for column in CSV_COLUMNS if column not in header]
        extra = [column for column in header if column not in CSV_COLUMNS]
        raise ValueError(
            "Template header does not match the required import format.\n"
            f"Expected: {list(CSV_COLUMNS)}\n"
            f"Found:    {list(header)}\n"
            f"Missing:  {missing}\n"
            f"Extra:    {extra}"
        )


def validate_rows(rows: Sequence[dict[str, str | int]]) -> None:
    """Fail fast if the generated database violates an approved rule."""
    errors: list[str] = []

    if len(rows) != EXPECTED_ROW_COUNT:
        errors.append(
            f"Expected {EXPECTED_ROW_COUNT} rows but generated {len(rows)}."
        )

    request_ids = [int(row["request_id"]) for row in rows]
    if len(request_ids) != len(set(request_ids)):
        errors.append("Duplicate request_id values were generated.")

    final_urls = [str(row["final_long_url"]) for row in rows]
    if len(final_urls) != len(set(final_urls)):
        duplicate_count = len(final_urls) - len(set(final_urls))
        errors.append(f"Generated {duplicate_count} duplicate final URL(s).")

    if any("/news/" in str(row["destination_url"]).lower() for row in rows):
        errors.append("News URLs must not be included in the starter database.")

    if any(str(row["utm_campaign"]).lower() == "news" for row in rows):
        errors.append("The News campaign must not be generated.")

    locations_url = "https://guardianangelseniorservices.com/locations/"
    if not any(row["destination_url"] == locations_url for row in rows):
        errors.append("The GAS Locations destination is missing.")

    actual_source_medium = {
        (str(row["utm_source"]), str(row["utm_medium"])) for row in rows
    }
    expected_source_medium = {
        (item.source, item.medium)
        for item in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS
    }
    if actual_source_medium != expected_source_medium:
        errors.append(
            "Generated source and medium combinations differ from the five "
            "approved automatic combinations."
        )

    for row in rows:
        final_url = str(row["final_long_url"])
        content = str(row["utm_content"])
        parsed_query = dict(
            parse_qsl(urlsplit(final_url).query, keep_blank_values=True)
        )

        if "{null}" in final_url.lower() or "%7bnull%7d" in final_url.lower():
            errors.append(
                f"Literal {{null}} found in final URL for request {row['request_id']}."
            )
            break

        if content == "" and "utm_content" in parsed_query:
            errors.append(
                "A blank utm_content row incorrectly contains utm_content in "
                f"request {row['request_id']}."
            )
            break

        if content != "" and parsed_query.get("utm_content") != content:
            errors.append(
                f"utm_content mismatch in request {row['request_id']}."
            )
            break

        required_query = {
            "utm_source": str(row["utm_source"]),
            "utm_medium": str(row["utm_medium"]),
            "utm_campaign": str(row["utm_campaign"]),
            "utm_term": str(row["utm_term"]),
        }
        for key, expected_value in required_query.items():
            if parsed_query.get(key) != expected_value:
                errors.append(
                    f"{key} mismatch in request {row['request_id']}: "
                    f"expected {expected_value!r}."
                )
                break

    if errors:
        raise ValueError("Validation failed:\n- " + "\n- ".join(errors))


def write_csv(rows: Iterable[dict[str, str | int]], output_path: Path) -> None:
    """Write UTF-8 CSV with the exact attached import column order."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=list(CSV_COLUMNS),
            extrasaction="raise",
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)


def print_summary(rows: Sequence[dict[str, str | int]], output_path: Path) -> None:
    """Print a compact validation and generation summary."""
    by_campaign_term = Counter(
        (str(row["utm_campaign"]), str(row["utm_term"])) for row in rows
    )
    by_source_medium = Counter(
        (str(row["utm_source"]), str(row["utm_medium"])) for row in rows
    )
    blank_content_count = sum(1 for row in rows if row["utm_content"] == "")

    print(f"Created: {output_path.resolve()}")
    print(f"Rows: {len(rows)}")
    print(f"Blank utm_content rows: {blank_content_count}")
    print("\nRows by campaign + term:")
    for (campaign, term), count in sorted(by_campaign_term.items()):
        print(f"  {campaign} + {term}: {count}")

    print("\nRows by source + medium:")
    for (source, medium), count in sorted(by_source_medium.items()):
        print(f"  {source} + {medium}: {count}")

    print("\nValidation: PASSED")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate the 170-row GAS starter UTM database using the attached "
            "20-column import format."
        )
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("gas-starter-utm-import.csv"),
        help="Output CSV path. Default: gas-starter-utm-import.csv",
    )
    parser.add_argument(
        "--start-id",
        type=int,
        default=1,
        help="First request_id to use. Default: 1",
    )
    parser.add_argument(
        "--timestamp",
        type=validate_timestamp,
        default=None,
        help=(
            "UTC timestamp for first_seen_at and last_seen_at, for example "
            "2026-07-31T15:45:00.000Z. Defaults to the current UTC time."
        ),
    )
    parser.add_argument(
        "--template",
        type=Path,
        default=None,
        help=(
            "Optional existing CSV whose header will be checked against the "
            "required import format before generation."
        ),
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    if args.start_id < 1:
        print("Error: --start-id must be 1 or greater.", file=sys.stderr)
        return 2

    try:
        if args.template is not None:
            validate_template_header(args.template)
            print(f"Template header validated: {args.template}")

        timestamp = args.timestamp or utc_timestamp()
        rows = generate_rows(start_id=args.start_id, timestamp=timestamp)
        validate_rows(rows)
        write_csv(rows, args.output)
        print_summary(rows, args.output)
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
