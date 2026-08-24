#!/usr/bin/env python3
"""Generate the Studleys (SFG) starter UTM library import CSV.

The curated destinations mirror the current Studleys navigation and the
approved SFG workbook taxonomy. Product, Inspiration, utility, PlantFinder,
limited-campaign, and manually configured source/medium links are excluded.
The spreadsheet value ``{null}`` is represented by ``None``.
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


CLIENT = "SFG"
DEFAULT_STATUS = "completed_without_short_link"
APPROVED_HOST = "studleys.com"

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

MANUAL_SOURCE_MEDIUM_COMBINATIONS: tuple[SourceMedium, ...] = (
    SourceMedium("MetaAd", "Social"),
    SourceMedium("BusinesssCard", "QRCode"),
    SourceMedium("Pinterest", "Social"),
    SourceMedium("PrintedMap", "QRCode"),
    SourceMedium("Youtube", "Social"),
)

SHOP_CONTENTS: tuple[Optional[str], ...] = ("Shop", "Learn", "Explore", None)
READ_CONTENTS: tuple[Optional[str], ...] = ("Read", "Learn", "Explore", None)


def rule(label: str, path: str, campaign: str, term: str,
         contents: tuple[Optional[str], ...]) -> DestinationRule:
    return DestinationRule(label, path, campaign, term, contents)


DESTINATION_RULES: tuple[DestinationRule, ...] = (
    rule("Home", "/", "HomePage", "LandingPage", SHOP_CONTENTS),

    rule("Flowers", "/product-category/flowers/", "Floral", "LandingPage", SHOP_CONTENTS),
    rule("All Flowers", "/product-category/flowers/", "Floral", "AllFlowers", SHOP_CONTENTS),
    rule("Summer", "/product-category/flowers/summer/", "Floral", "Summer", SHOP_CONTENTS),
    rule("Garden Center Gifts", "/product-category/flowers/garden-center-gifts/", "Floral", "GardenCenterGifts", SHOP_CONTENTS),
    rule("Birthday", "/product-category/flowers/birthday/", "Floral", "Birthday", SHOP_CONTENTS),
    rule("Fresh Wrapped Bouquets", "/product-category/flowers/fresh-wrapped-bouquets/", "Floral", "FreshWrappedBouquets", SHOP_CONTENTS),
    rule("Get Well Soon", "/product-category/flowers/get-well-soon/", "Floral", "GetWellSoon", SHOP_CONTENTS),
    rule("Gift Cards", "/product-category/gift-cards/", "Floral", "GiftCards", SHOP_CONTENTS),
    rule("Just Because", "/product-category/flowers/just-because/", "Floral", "JustBecause", SHOP_CONTENTS),
    rule("Love & Romance", "/product-category/flowers/love-romance/", "Floral", "LoveRomance", SHOP_CONTENTS),
    rule("Memorial Service", "/product-category/flowers/memorial-service/", "Floral", "MemorialService", SHOP_CONTENTS),
    rule("New Baby", "/product-category/flowers/new-baby/", "Floral", "NewBaby", SHOP_CONTENTS),
    rule("Plant Gifts", "/product-category/flowers/plant-gifts/", "Floral", "PlantGifts", SHOP_CONTENTS),
    rule("Roses", "/product-category/flowers/roses/", "Floral", "Roses", SHOP_CONTENTS),
    rule("Sympathy", "/product-category/flowers/sympathy/", "Floral", "Sympathy", SHOP_CONTENTS),
    rule("Wedding A La Carte", "/product-category/flowers/wedding-a-la-carte/", "Floral", "WeddingALaCarte", SHOP_CONTENTS),
    rule("Staff Favorites", "/product-category/flowers/staff-favorites/", "Floral", "StaffFavorites", SHOP_CONTENTS),
    rule("Zodiac Flowers", "/product-category/flowers/zodiac-flowers-collection/", "Floral", "Zodiac", SHOP_CONTENTS),

    rule("Houseplants", "/houseplants/", "Houseplants", "LandingPage", SHOP_CONTENTS),
    rule("All Houseplants", "/product-category/houseplants/", "Houseplants", "AllHouseplants", SHOP_CONTENTS),
    rule("Collections", "/product-category/houseplants/collections/", "Houseplants", "Collections", SHOP_CONTENTS),
    rule("Peperomia", "/product-category/houseplants/peperomia/", "Houseplants", "Peperomia", SHOP_CONTENTS),
    rule("Scented Geranium", "/product-category/houseplants/scented-geranium/", "Houseplants", "ScentedGeranium", SHOP_CONTENTS),
    rule("Succulent", "/product-category/houseplants/succulent/", "Houseplants", "Succulent", SHOP_CONTENTS),
    rule("Terrarium", "/product-category/houseplants/terrarium/", "Houseplants", "Terrarium", SHOP_CONTENTS),
    rule("Trailing", "/product-category/houseplants/trailing/", "Houseplants", "Trailing", SHOP_CONTENTS),
    rule("Windowsill", "/product-category/houseplants/windowsill/", "Houseplants", "Windowsill", SHOP_CONTENTS),
    rule("Blooming", "/product-category/houseplants/blooming/", "Houseplants", "Blooming", SHOP_CONTENTS),
    rule("Air Purifying", "/product-category/houseplants/air-purifying/", "Houseplants", "AirPurifying", SHOP_CONTENTS),
    rule("Bonsai", "/product-category/houseplants/bonsai/", "Houseplants", "Bonsai", SHOP_CONTENTS),

    rule("Garden Center", "/garden-plants/", "GardenCenter", "LandingPage", READ_CONTENTS),
    rule("Wedding Services", "/wedding-flowers/", "Wedding", "LandingPage", READ_CONTENTS),
    rule("DIY Wedding Flowers", "/diy-wedding-flowers/", "Wedding", "DIYWedding", READ_CONTENTS),
    rule("Landscaping", "/landscaping/", "Landscaping", "LandingPage", READ_CONTENTS),
    rule("Irrigation Services", "/irrigation-services/", "Landscaping", "IrrigationServices", READ_CONTENTS),

    rule("About", "/about/", "About", "LandingPage", READ_CONTENTS),
    rule("Studleys Guarantee", "/studleys-guarantee/", "About", "Guarantee", READ_CONTENTS),
    rule("FAQ", "/faq/", "About", "FAQ", READ_CONTENTS),
    rule("Refunds & Returns", "/refunds-returns/", "About", "RefundsReturns", READ_CONTENTS),
    rule("Donations", "/donations/", "About", "Donations", ("Request", "Contact", None)),
    rule("Enews", "/enews/", "About", "SignUpEnews", ("SignUp", "Subscribe", None)),
    rule("Contact", "/contact-us/", "Contact", "LandingPage", ("Contact", None)),
    rule("My Account", "/my-account/", "MyAccount", "LandingPage", ("SignIn", "Register", None)),
)

EXPECTED_ROW_COUNT = sum(
    len(item.contents) * len(AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS)
    for item in DESTINATION_RULES
)


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
        raise ValueError(f"Destination is outside the approved SFG host: {url!r}")
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
                final_url = build_final_url(
                    destination, source_medium.source, source_medium.medium,
                    item.campaign, item.term, content,
                )
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
                    "final_long_url": final_url,
                    "short_url": "",
                    "qr_url": "",
                    "request_count": 1,
                    "first_seen_at": timestamp,
                    "last_seen_at": timestamp,
                    "original_message": (
                        f"SFG starter database | {item.label} | "
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
    if len(rows) != EXPECTED_ROW_COUNT:
        errors.append(f"Expected {EXPECTED_ROW_COUNT} rows but generated {len(rows)}.")
    if len({str(row['final_long_url']) for row in rows}) != len(rows):
        errors.append("Duplicate final URLs were generated.")
    if len({int(row['request_id']) for row in rows}) != len(rows):
        errors.append("Duplicate request IDs were generated.")

    excluded_sources = {item.source for item in MANUAL_SOURCE_MEDIUM_COMBINATIONS}
    allowed_pairs = {(item.source, item.medium) for item in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS}
    for row in rows:
        destination = str(row["destination_url"])
        path = urlsplit(destination).path.lower()
        query = dict(parse_qsl(urlsplit(str(row["final_long_url"])).query,
                               keep_blank_values=True))
        if row["client"] != CLIENT:
            errors.append(f"Invalid client in request {row['request_id']}.")
            break
        if (str(row["utm_source"]), str(row["utm_medium"])) not in allowed_pairs:
            errors.append(f"Invalid source/medium in request {row['request_id']}.")
            break
        if str(row["utm_source"]) in excluded_sources:
            errors.append(f"Manual source generated in request {row['request_id']}.")
            break
        if "/product/" in path or "/inspiration/" in path or "plantfinder" in path:
            errors.append(f"Excluded destination generated: {destination}")
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
    print(f"Destinations: {len(DESTINATION_RULES)}")
    print(f"Rows: {len(rows)}")
    print(f"Blank utm_content rows: {sum(row['utm_content'] == '' for row in rows)}")
    print("Rows by campaign:")
    for campaign, count in sorted(campaigns.items()):
        print(f"  {campaign}: {count}")
    print("Validation: PASSED")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=f"Generate the {EXPECTED_ROW_COUNT}-row SFG starter UTM library."
    )
    parser.add_argument("--output", type=Path,
                        default=Path("sfg-starter-utm-import.csv"))
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
