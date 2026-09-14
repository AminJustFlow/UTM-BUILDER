#!/usr/bin/env python3
"""Generate the Castle in the Clouds (CIC) starter UTM import CSV.

The curated destinations mirror stable Castle navigation and the approved CIC
workbook taxonomy. External forms, PDFs, jobs, dated events, specialty
campaigns, and manually configured source/medium links are excluded.
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


CLIENT = "CIC"
DEFAULT_STATUS = "completed_without_short_link"
APPROVED_HOST = "www.castleintheclouds.org"

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
    SourceMedium("BusinessCard", "QRCode"),
    SourceMedium("Pinterest", "Social"),
    SourceMedium("PrintedMap", "QRCode"),
    SourceMedium("YouTube", "Social"),
)

VISIT_CONTENTS: tuple[Optional[str], ...] = ("Visit", "Learn", "Explore", None)
LEARN_CONTENTS: tuple[Optional[str], ...] = ("Learn", "Explore", None)
SUPPORT_CONTENTS: tuple[Optional[str], ...] = ("Support", "Learn", "Donate", None)


def rule(label: str, path: str, campaign: str, term: str,
         contents: tuple[Optional[str], ...]) -> DestinationRule:
    return DestinationRule(label, path, campaign, term.strip(), contents)


DESTINATION_RULES: tuple[DestinationRule, ...] = (
    rule("Home", "/", "HomePage", "LandingPage", LEARN_CONTENTS),

    rule("Hours & Admission", "/hours-admission/", "Visit", "HoursAndAdmission", VISIT_CONTENTS),
    rule("Things to Do", "/things-to-do/", "Visit", "ThingsToDo", VISIT_CONTENTS),
    rule("The Mansion", "/things-to-do/museum/", "Visit", "Mansion", VISIT_CONTENTS),
    rule("Basement Tours", "/things-to-do/basement-tours/", "Visit", "BasementTours", VISIT_CONTENTS),
    rule("Exhibit Gallery", "/things-to-do/exhibit-gallery/", "Visit", "ExhibitGallery", VISIT_CONTENTS),
    rule("Hiking & Walking Trails", "/things-to-do/hiking-walking-trails/", "Visit", "HikingWalkingTrails", VISIT_CONTENTS),
    rule("Shannon Pond & The Meadows", "/things-to-do/shannon-pond-the-meadows/", "Visit", "ShannonPondAndTheMeadows", VISIT_CONTENTS),
    rule("Gift Shop", "/things-to-do/gift-shop/", "Visit", "GiftShop", VISIT_CONTENTS),
    rule("Winter Activities", "/things-to-do/winter-activities/", "Visit", "WinterActivities", VISIT_CONTENTS),
    rule("Kids & Families", "/kids-families/", "Visit", "KidsAndFamilies", VISIT_CONTENTS),
    rule("Directions & Parking", "/directions-parking/", "Visit", "DirectionsAndParking", VISIT_CONTENTS),
    rule("Visitor Information", "/visitor-information/", "Visit", "VisitorInformation", VISIT_CONTENTS),
    rule("Area Information", "/area-information/", "Visit", "AreaInformation", VISIT_CONTENTS),
    rule("Virtual Library", "/virtual-library/", "Visit", "VirtualLibrary", VISIT_CONTENTS),
    rule("Visitor Feedback", "/visitor-feedback/", "Visit", "VisitorFeedback", (None,)),
    rule("Group Tours", "/group-tours/", "Visit", "GroupTours", VISIT_CONTENTS),

    rule("Upcoming Events", "/upcoming-events/", "ProgramsAndEvents", "UpcomingEvents", LEARN_CONTENTS),
    rule("Calendar of Events", "/calendar-of-events/", "ProgramsAndEvents", "CalendarOfEvents", LEARN_CONTENTS),
    rule("For Teachers", "/for-teachers/", "ProgramsAndEvents", "ForTeachers", LEARN_CONTENTS),
    rule("Christmas at the Castle", "/christmas-at-the-castle/", "ProgramsAndEvents", "ChristmasAtTheCastle", ("CATC", "Preview", "TwilightTours")),

    rule("Carriage House Restaurant", "/carriage-house-restaurant/", "Dine", "CarriageHouseRestaurant", VISIT_CONTENTS),
    rule("Cafe in the Clouds", "/things-to-do/cafe-in-the-clouds/", "Dine", "CafeInTheClouds", VISIT_CONTENTS),
    rule("Music Nights", "/calendar-of-events/category/music-nights/", "Dine", "MusicNights", ("Buy", "Learn", "Explore", None)),

    rule("Castle Weddings", "/weddings/", "WeddingsAndEvents", "CastleWeddings", LEARN_CONTENTS),
    rule("Private Events", "/private-events/", "WeddingsAndEvents", "PrivateEvents", LEARN_CONTENTS),
    rule("Corporate Meetings", "/corporate-meetings/", "WeddingsAndEvents", "CorporateMeetings", LEARN_CONTENTS),
    rule("Event Spaces", "/venue-locations/", "WeddingsAndEvents", "EventSpaces", LEARN_CONTENTS),

    rule("Donate", "/donate/", "Support", "Donate", SUPPORT_CONTENTS),
    rule("Become a Member", "/membership/", "Support", "BecomeAMember", ("Support", "Learn", "Join", None)),
    rule("Become a Sponsor", "/sponsor/", "Support", "BecomeASponsor", ("Support", "Learn", "Sponsor", None)),
    rule("Volunteer", "/volunteer/", "Support", "Volunteer", ("Support", "Learn", "Volunteer", None)),
    rule("C-TAG", "/c-tag/", "Support", "C-TAG", ("Support", "Learn", "Volunteer", None)),
    rule("Adopt an Artifact", "/adopt-an-artifact/", "Support", "AdoptAnArtifact", SUPPORT_CONTENTS),
    rule("Library Membership", "/library-membership/", "Support", "LibraryMembership", VISIT_CONTENTS),

    rule("History", "/history/", "About", "History", LEARN_CONTENTS),
    rule("National Historic Landmark", "/national-historic-landmark/", "About", "NationalHistoricLandmark", LEARN_CONTENTS),
    rule("Mission & Values", "/mission/", "About", "MissionAndValues", LEARN_CONTENTS),
    rule("Restoration", "/preservation/", "About", "Restoration", LEARN_CONTENTS),
    rule("Staff Leadership", "/staff/", "About", "StaffLeadership", LEARN_CONTENTS),
    rule("Board of Directors", "/board-of-directors/", "About", "BoardOfDirectors", LEARN_CONTENTS),
    rule("Partnerships", "/partnerships/", "About", "Partnerships", LEARN_CONTENTS),
    rule("Contact Us", "/contact-us/", "About", "ContactUs", ("Contact", None)),
)

EXPECTED_DESTINATION_COUNT = 43
EXPECTED_ROW_COUNT = 755


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
        raise ValueError(f"Destination is outside the approved CIC host: {url!r}")
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
                    "final_long_url": build_final_url(destination, source_medium.source,
                                                      source_medium.medium, item.campaign,
                                                      item.term, content),
                    "short_url": "", "qr_url": "", "request_count": 1,
                    "first_seen_at": timestamp, "last_seen_at": timestamp,
                    "original_message": (
                        f"CIC starter database | {item.label} | {source_medium.source} | "
                        f"{content if content is not None else '{null}'}"
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
    if len(DESTINATION_RULES) != EXPECTED_DESTINATION_COUNT:
        errors.append(f"Expected {EXPECTED_DESTINATION_COUNT} destinations but found {len(DESTINATION_RULES)}.")
    if len(rows) != EXPECTED_ROW_COUNT:
        errors.append(f"Expected {EXPECTED_ROW_COUNT} rows but generated {len(rows)}.")
    if len({str(row["final_long_url"]) for row in rows}) != len(rows):
        errors.append("Duplicate final URLs were generated.")
    if len({int(row["request_id"]) for row in rows}) != len(rows):
        errors.append("Duplicate request IDs were generated.")
    allowed_pairs = {(item.source, item.medium) for item in AUTOMATIC_SOURCE_MEDIUM_COMBINATIONS}
    excluded_sources = {item.source for item in MANUAL_SOURCE_MEDIUM_COMBINATIONS}
    for row in rows:
        destination = str(row["destination_url"])
        parsed = urlsplit(destination)
        query = dict(parse_qsl(urlsplit(str(row["final_long_url"])).query,
                               keep_blank_values=True))
        if row["client"] != CLIENT:
            errors.append(f"Invalid client in request {row['request_id']}.")
            break
        if parsed.scheme != "https" or (parsed.hostname or "").lower() != APPROVED_HOST:
            errors.append(f"Invalid destination in request {row['request_id']}.")
            break
        if (str(row["utm_source"]), str(row["utm_medium"])) not in allowed_pairs:
            errors.append(f"Invalid source/medium in request {row['request_id']}.")
            break
        if str(row["utm_source"]) in excluded_sources:
            errors.append(f"Manual source generated in request {row['request_id']}.")
            break
        expected = {"utm_source": str(row["utm_source"]),
                    "utm_medium": str(row["utm_medium"]),
                    "utm_campaign": str(row["utm_campaign"]),
                    "utm_term": str(row["utm_term"])}
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


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Generate the 755-row CIC starter UTM library.")
    parser.add_argument("--output", type=Path, default=Path("cic-starter-utm-import.csv"))
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--timestamp", type=validate_timestamp, default=None)
    parser.add_argument("--template", type=Path, default=None)
    args = parser.parse_args(argv)
    if args.start_id < 1:
        print("Error: --start-id must be 1 or greater.", file=sys.stderr)
        return 2
    try:
        if args.template is not None:
            validate_template_header(args.template)
        rows = generate_rows(args.start_id, args.timestamp or utc_timestamp())
        validate_rows(rows)
        write_csv(rows, args.output)
        campaigns = Counter(str(row["utm_campaign"]) for row in rows)
        print(f"Created: {args.output.resolve()}")
        print(f"Destinations: {len(DESTINATION_RULES)}")
        print(f"Rows: {len(rows)}")
        print(f"Blank utm_content rows: {sum(row['utm_content'] == '' for row in rows)}")
        for campaign, count in sorted(campaigns.items()):
            print(f"  {campaign}: {count}")
        print("Validation: PASSED")
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
