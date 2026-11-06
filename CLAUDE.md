# Basira

AI product content intelligence for e-commerce agencies selling on Amazon, Noon, Salla, Zid and Shopify (Arabic and English). The user writes in Russian; answer in Russian.

## Project status and plan

`ROADMAP.md` holds the strategy, the target pipeline (5 stages + Brand DNA + learning loop, diagram in `docs/pipeline.html`), a status table for every element, the build order, v2 items and landing-page promises that aren't built yet.

- Whenever the user asks what stage the project is at, what's missing, what to do next, or how far along a pipeline stage is: read `ROADMAP.md`, check the statuses against the code, and answer from it.
- When a feature lands or changes, update its row in `ROADMAP.md` (and the "Обновлено" date) in the same commit.
- When the user asks what was saved or postponed for later, answer from the «Отложено на потом» section of `ROADMAP.md`. When the user asks to save an idea for later, add a row there (and a document in `docs/` if it needs detail).

## Working on the code

- Structure, API and environment variables: `README.md`.
- Build pages: `node scripts/build.mjs` (writes `index.html`, `app.html`, `dist/`). Shared modules in `server/` are inlined into the app by the build.
- Tests: `npm test`.
- Run: `npm start` (needs Chromium for rendering; `CHROMIUM_PATH` or the Playwright browser).
- Artifacts: the app is published from `dist/app.html`, the landing from `src/landing.html` (with `app.html` as a file), the pipeline diagram from `docs/pipeline.html`.
