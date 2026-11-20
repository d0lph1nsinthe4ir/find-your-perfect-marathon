# Bulk catalog import

Use an organizer export or a feed authorized for publication. Map rows to
[the CSV template](race-import-template.csv), with one row per in-person full
marathon edition. Keep a stable ID such as `organizer-race-2027` so updates to
the same edition merge. The source URL must substantiate the date, location and
distance. Omit the optional course URL if an edition-specific source is unavailable.

From the repository root, preview with `python3 scripts/import_races.py export.csv`.
Add `--apply` after review to write `data/races.json`. Malformed rows abort the
whole batch. The importer preserves existing race attributes and course versions.
It flags duplicate names in the same city and year under different IDs. Resolve
cross-feed aliases before importing. Once real editions exist, only those editions
appear in search, while demo records remain available for development tests.

This import sets a source, verification date, edition date, location, month and
region. Unavailable criteria stay missing. Course links are kept separate from
geometry and GPX permissions. Changes still go through a GitHub commit and Pages
deployment. An automated feed adapter can generate the same CSV and use the same
validation before opening a proposed catalog update.

RunSignup's [developer terms](https://runsignup.com/About-Us/APIDeveloper-Contract)
require registration and agreement. Its [affiliate program](https://runsignup.com/Affiliate)
describes access for race calendars. Set up the appropriate account and obtain
the necessary permission before connecting that feed.

The initial source-reviewed batch is in `data/imports/official-starter.csv`.

The `2027-regional.csv` batch includes confirmed single-day full-marathon listings
from the [AIMS calendar](https://aims-worldrunning.org/calendar.html) and independent
organizer sources for additional US races. Confirm dates with organizers before
making arrangements. A calendar listing alone does not establish Boston eligibility.
Country is stored separately so the matcher can restrict results to domestic races.
