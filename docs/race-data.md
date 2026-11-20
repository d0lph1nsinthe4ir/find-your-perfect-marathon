# Race data schema and scoring

The catalog object contains `schemaVersion` (currently 1) and a `races` array. Each record has a stable, URL-safe `id`, a `name`, a display `setting`, a boolean `demo`, an `attributes` object, and a `courseVersions` array.

Each attribute is an object with `value` and `status`. Use `demo` for fictional values, `verified` for sourced values, `missing` when no value is available, and `unverified` for claims awaiting a reliable source. Use null for missing values. The demo catalog also uses null for its unverified example. Verified fields should include `sourceUrl` (absolute URL), `sourceTitle`, and `verifiedOn` (ISO date). Record the relevant edition before using real race data, especially for registration and qualifying eligibility.

| Attribute | Representation |
| --- | --- |
| month, season, region | English month, local season, continent |
| temperature | Typical whole-degree Celsius race-day value |
| gain, loss | Nonnegative meters, stored independently |
| surface | Road, Trail, Mixed |
| boston | eligible or ineligible for the specified edition |
| field | Nonnegative integer runner count |
| scenery | Array of category strings |
| cost | Nonnegative USD prototype estimate |
| travel | Airport and transit, Airport nearby, Car recommended |
| configuration | Loop, Point-to-point, Out-and-back, Multiple loops |
| registration | Open, Upcoming, Waitlist, Closed |

The option vocabulary is defined in `assets/criteria.mjs`. Demo and verified values are usable in scoring. Missing or unverified values earn no evaluated points and are omitted from the possible points used for fit. Coverage is evaluated weight divided by total selected weight. With no evaluated weight, the race is unscored. The weighted preference multipliers are 1, 2, and 4. An exact fit earns all available points. A range, month, or travel preference can earn partial points based on distance using criterion-specific scales. Required criteria use exact fits (or values in the chosen band) and carry no points. An unknown requirement needs confirmation and a known miss excludes the race from the eligible shortlist. Eligible results sort by displayed fit, coverage, then name.

## Course version fields planned for verified profiles

Each version should hold the race year, version ID, source title and URL, verification date, configuration, terrain, and optional geographic geometry with its coordinate reference system and provenance. A GPX source record should hold the original URL, verification date, license or permission evidence, and an optional hosted file URL when authorized. Record elevation source and processing method alongside any derived metrics. The demo catalog has empty version arrays and the profile intentionally displays availability placeholders.

Imported real editions also have a local calendar `date` (ISO date), a top-level
`source` with attribution and verification date, and, when available, a
`courseSource` for an organizer's edition-specific course information page.
A course information link does not imply that the site holds verified geometry
or has permission to distribute files. Attributes that lack information may be
omitted.

Real records include `country`, a country or territory display name used for the
exact country filter. Where the organizer publishes a marathon-specific entry cap
as field-size evidence, set `basis` to `registration cap` and link its source.

### Historical temperature

The temperature attribute can contain a `basis` of `seasonal estimate` or
`past editions`. Both use modeled hourly air temperatures from
[Open-Meteo historical reanalysis](https://open-meteo.com/en/docs/historical-weather-api)
(CC BY 4.0). They estimate local conditions and do not predict future race-day
weather. Coordinates in `data/weather-locations.csv` represent the race city or a
nearby named location, with GeoNames links where available. They do not represent
course geometry.

The seasonal estimator takes the median of morning averages from 2023–2025,
using the seven calendar days centered on the scheduled month and day. Each
daily average uses five hourly values from 7 through 11 a.m. local time. Race
dates in `data/weather-editions.csv` also have sourced historical editions.
For those, the matcher uses the median of the past edition morning averages
and the profiles show each edition's low and high across its sampled hours.
The historical start hour is rounded to the nearest whole hour. The matcher
uses rounded Celsius values. Source and sample metadata travel with each estimate.

Run `python3 scripts/import_weather.py --checked-on YYYY-MM-DD --cache /tmp/marathon-weather-cache` from the
repository root to refresh the catalog from the input sheets. Use an API access
plan appropriate to the project's use and keep the source attribution visible.

Course configuration can also be Mostly loop, Mostly out-and-back, or Multiple
out-and-backs. A mostly variant gets partial credit for the corresponding exact
shape when used as a weighted preference. Required course types use exact
matches. Course type sources are linked from race profiles. A directory's
course classification describes its published listing. Check the organizer
for changes to the upcoming edition, especially before booking.
