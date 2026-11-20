# Find Your Perfect Marathon

A static marathon recommendation prototype. Choose race preferences and importance levels, review ranked results, and open an individual profile. All six sample races and their attributes are fictional.

## Run locally

Serve the repository with `python3 -m http.server 8000` and open http://localhost:8000/. Run the scoring tests with `node --test` from the repository root (Node.js 20+).

## Publish with GitHub Pages

In **Settings → Pages**, select **Deploy from a branch**, choose **main** and **/ (root)**, and save. The expected project URL is https://d0lph1nsinthe4ir.github.io/find-your-perfect-marathon/. The project uses relative paths and requires no build step. Check the Pages deployment in the repository's Actions tab.

## Project structure

- `index.html` and `assets/style.css` contain the page structure and responsive styles.
- `assets/criteria.mjs` defines matching inputs and icon geometry.
- `assets/matcher.mjs` contains pure scoring and sorting logic.
- `assets/app.mjs` renders the form, results, and linkable race profiles.
- `data/races.json` contains structured sample records.

See [race data and scoring](docs/race-data.md) and the [development roadmap](docs/roadmap.md).

## Import race editions in bulk

See [bulk catalog import](docs/bulk-import.md) for the spreadsheet format, validation and update commands.
