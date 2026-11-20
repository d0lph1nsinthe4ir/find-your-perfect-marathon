# Repository guidance

Keep the site static and compatible with a GitHub Pages project subdirectory. Use relative asset URLs. Keep scoring independent of the browser, inputs in the criteria module, and race records in structured JSON. Maintain mobile and keyboard usability.

Demo labels must remain visible wherever fictional data appears. Keep missing, unverified, and unfavorable values distinct. Use official race sources first, followed by verifiable third-party sources. Never invent a route. Only redistribute a GPX file when its terms explicitly permit it, and retain its original source and race-year version. See docs/race-data.md.

Run node --test and smoke-test the form and hash-linked profiles from a local HTTP server before committing.
