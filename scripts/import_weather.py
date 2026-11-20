"""Populate race temperatures from archived local weather in batches."""
import argparse
from collections import defaultdict
import csv
from datetime import date, timedelta
import json
from hashlib import sha256
import math
from pathlib import Path
from statistics import mean, median
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
WEATHER = "https://open-meteo.com/en/docs/historical-weather-api"
YEARS = (2023, 2024, 2025)
WINDOW = timedelta(days=3)
BATCH_SIZE = 16


def archive(locations, start, end, cache):
    params = urlencode({
        "latitude": ",".join(row["latitude"] for row in locations),
        "longitude": ",".join(row["longitude"] for row in locations),
        "start_date": start.isoformat(), "end_date": end.isoformat(),
        "hourly": "temperature_2m", "timezone": "auto", "models": "era5_seamless",
    })
    cache_path = cache / (sha256(params.encode()).hexdigest() + ".json")
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))
    for attempt in range(5):
        try:
            with urlopen(ARCHIVE + "?" + params, timeout=40) as response:
                data = json.load(response)
                remaining = float(response.headers.get("x-ratelimit-remaining", "600"))
                reset = int(response.headers.get("x-ratelimit-reset", "0"))
                cost = float(response.headers.get("x-ratelimit-cost", "1"))
            if isinstance(data, dict):
                data = [data]
            if len(data) != len(locations):
                raise ValueError("Weather response has the wrong number of locations")
            cache_path.write_text(json.dumps(data), encoding="utf-8")
            if remaining < 2 * cost:
                time.sleep(max(1, reset - time.time() + 1))
            return data
        except (URLError, TimeoutError) as error:
            if isinstance(error, HTTPError) and error.code < 500 and error.code != 429:
                raise
            if attempt == 4:
                raise
            if isinstance(error, HTTPError) and error.code == 429:
                payload = error.read().decode(errors="replace")
                if "daily" in payload.lower() or "hourly" in payload.lower():
                    raise RuntimeError(payload) from error
                time.sleep(65)
            else:
                time.sleep(2 ** (attempt + 1))


def readings(response, start, end, hour):
    series = defaultdict(list)
    hourly = response["hourly"]
    for timestamp, value in zip(hourly["time"], hourly["temperature_2m"], strict=True):
        day = date.fromisoformat(timestamp[:10])
        if start <= day <= end and hour <= int(timestamp[11:13]) <= hour + 4:
            if isinstance(value, (int, float)) and math.isfinite(value):
                series[day].append(value)
    return [values for values in series.values() if len(values) == 5]


def load_batch(batch, cache):
    year, entries = batch
    centers = [date(year, day.month, 28 if (day.month, day.day) == (2, 29) else day.day)
               for _, day, _ in entries]
    responses = archive([location for _, _, location in entries],
                        min(centers) - WINDOW, max(centers) + WINDOW, cache)
    return [(race_id, readings(response, center - WINDOW, center + WINDOW, 7))
            for (race_id, _, _), center, response in zip(entries, centers, responses, strict=True)]


def archived_editions(editions, locations, cache):
    samples = defaultdict(list)
    for row in editions:
        race_id = row["id"]
        day = date.fromisoformat(row["date"])
        hour = int(row["startHour"])
        response, = archive([locations[race_id]], day, day, cache)
        daily = readings(response, day, day, hour)
        if len(daily) != 1:
            raise ValueError(f"Incomplete temperature history for {race_id} on {day}")
        values = daily[0]
        samples[race_id].append({
            "date": day.isoformat(), "startHour": hour,
            "low": round(min(values), 1), "high": round(max(values), 1),
            "mean": round(mean(values), 1), "dateSource": row["dateSource"],
        })
    return samples


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checked-on", required=True, type=date.fromisoformat)
    parser.add_argument("--cache", required=True, type=Path, help="directory for API response cache")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    catalog_path = Path("data/races.json")
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    with open("data/weather-locations.csv", encoding="utf-8", newline="") as stream:
        locations = {row["id"]: row for row in csv.DictReader(stream)}
    with open("data/weather-editions.csv", encoding="utf-8", newline="") as stream:
        editions = list(csv.DictReader(stream))

    groups = defaultdict(list)
    for race in catalog["races"]:
        if race["demo"] or race["id"] not in locations:
            continue
        day = date.fromisoformat(race["date"])
        groups[day.month, (day.day - 1) // 7].append((race["id"], day, locations[race["id"]]))
    batches = [(year, group[offset:offset + BATCH_SIZE])
               for group in groups.values() for year in YEARS
               for offset in range(0, len(group), BATCH_SIZE)]
    samples = defaultdict(list)
    editions_by_race = archived_editions(editions, locations, args.cache)
    for index, batch in enumerate(batches, 1):
        for race_id, days in load_batch(batch, args.cache):
            samples[race_id].extend(days)
        if index % 25 == 0:
            print(f"Fetched {index} of {len(batches)} weather batches.", flush=True)
    count = 0
    missing = []
    for race in catalog["races"]:
        if race["demo"]:
            continue
        race_id = race["id"]
        days = samples[race_id]
        edition_samples = editions_by_race[race_id]
        if len(days) < 14 and not edition_samples:
            missing.append(race_id)
            continue
        location = locations[race_id]
        if edition_samples:
            typical = median(row["mean"] for row in edition_samples)
        else:
            typical = median(mean(values) for values in days)
        race["attributes"]["temperature"] = {
            "value": round(typical), "status": "verified",
            "sourceUrl": WEATHER, "sourceTitle": "Open-Meteo · ERA5 historical reanalysis",
            "verifiedOn": args.checked_on.isoformat(),
            "basis": "past editions" if edition_samples else "seasonal estimate",
            "location": location["label"], "locationSource": location["locationSource"],
            "latitude": float(location["latitude"]), "longitude": float(location["longitude"]),
            "years": list(YEARS), "sampleDays": len(days), "editions": edition_samples,
        }
        count += 1
    if missing:
        print("Insufficient coverage:", ", ".join(missing))
    print(f"Prepared historical temperature data for {count} races.")
    output = catalog_path.with_suffix(".json.tmp")
    output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    output.replace(catalog_path)


if __name__ == "__main__":
    main()
