"""Validate and merge a batch of sourced marathon editions into the site catalog."""
import argparse
import csv
from datetime import date
import json
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit

COLUMNS = ("id", "name", "date", "city", "country", "region", "source_url",
           "source_title", "verified_on", "distance_km", "format", "course_url")
REGIONS = {"Africa", "Asia", "Europe", "North America", "Oceania", "South America"}
MONTHS = ("January February March April May June July August September October "
          "November December").split()


def https_url(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or any(c.isspace() for c in value):
        raise ValueError("expected an HTTPS source URL")
    return value


def iso_day(value):
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError("expected a date in YYYY-MM-DD format")
    return parsed


def import_batch(rows, catalog):
    races = {race["id"]: race for race in catalog["races"]}
    seen_ids = set()
    editions = {(race["name"].casefold(), race["setting"].casefold(), race["date"][:4]): race["id"]
                for race in races.values() if not race["demo"] and race.get("date")}
    for line, raw in enumerate(rows, 2):
        try:
            if None in raw or any(raw[key] is None for key in COLUMNS):
                raise ValueError("row has an incorrect number of columns")
            row = {key: raw[key].strip() for key in COLUMNS}
            if any(not row[key] for key in COLUMNS if key != "course_url"):
                raise ValueError("all fields except course_url are required")
            race_id = row["id"]
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", race_id) or race_id in seen_ids:
                raise ValueError("invalid or repeated edition ID")
            previous = races.get(race_id, {})
            if previous.get("demo"):
                raise ValueError("edition ID belongs to a demo race")
            day = iso_day(row["date"])
            if previous.get("date", row["date"])[:4] != row["date"][:4]:
                raise ValueError("use a new ID for a different edition year")
            if iso_day(row["verified_on"]) > date.today():
                raise ValueError("verification date is in the future")
            if row["distance_km"] != "42.195" or row["format"].lower() != "in-person":
                raise ValueError("only confirmed in-person, 42.195 km marathons are accepted")
            if row["region"] not in REGIONS:
                raise ValueError("region must match the matcher vocabulary")
            setting = f'{row["city"]}, {row["country"]}'
            key = (row["name"].casefold(), setting.casefold(), str(day.year))
            if key in editions and editions[key] != race_id:
                raise ValueError("possible duplicate edition with a different ID")
            source = {"sourceUrl": https_url(row["source_url"]), "sourceTitle": row["source_title"],
                      "verifiedOn": row["verified_on"]}
            attributes = {**previous.get("attributes", {}),
                          "month": {"value": MONTHS[day.month - 1], "status": "verified", **source},
                          "region": {"value": row["region"], "status": "verified", **source}}
            race = {**previous, "id": race_id, "name": row["name"], "setting": setting,
                    "date": row["date"], "country": row["country"], "demo": False, "source": source, "attributes": attributes,
                    "courseVersions": previous.get("courseVersions", [])}
            if row["course_url"]:
                race["courseSource"] = {"sourceUrl": https_url(row["course_url"]),
                                        "verifiedOn": row["verified_on"]}
            races[race_id] = race
            seen_ids.add(race_id)
            editions[key] = race_id
        except ValueError as error:
            raise ValueError(f"CSV row {line}: {error}") from error
    return {**catalog, "races": list(races.values())}, len(seen_ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path)
    parser.add_argument("--catalog", type=Path, default=Path("data/races.json"))
    parser.add_argument("--apply", action="store_true", help="write the validated batch")
    args = parser.parse_args()
    try:
        catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
        with args.csv_file.open(encoding="utf-8-sig", newline="") as stream:
            rows = csv.DictReader(stream)
            if tuple(rows.fieldnames or ()) != COLUMNS:
                raise ValueError("headers must match docs/race-import-template.csv")
            merged, count = import_batch(rows, catalog)
        if args.apply and count:
            with tempfile.NamedTemporaryFile(mode="w", dir=args.catalog.parent,
                                             encoding="utf-8", delete=False) as stream:
                json.dump(merged, stream, indent=2, ensure_ascii=False)
                stream.write("\n")
            Path(stream.name).replace(args.catalog)
        print(f"{count} editions validated. " + ("Catalog updated." if args.apply and count else "No files written."))
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
