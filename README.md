# Basira · بصيرة

**AI product content intelligence for MENA e-commerce.**

Basira finds what is costing a listing sales, learns from what buyers write in reviews (Gulf, Egyptian, Levantine Arabic, MSA and English), fixes the content on brand in Arabic and English, publishes the fix to Amazon, Noon, Salla, Zid and Shopify, and measures the result.

This repository holds the marketing site, the product app and the server that powers it.

## Structure

| Path | What it is |
| --- | --- |
| `src/landing.html` | Landing page source (styles, markup, Arabic translations and scripts in one file) |
| `src/app.html` | Product app: overview, live listing audit, catalog, listing diagnosis, reviews, slide studio, approvals |
| `server/audit.mjs` | Listing audit engine (pure functions, shared by the server and the app) |
| `server/render.mjs` | Slide renderer: Arabic and English typeset by Chromium over the product image, exported as 1600 × 2000 PNG |
| `server/reviews.mjs` | Review analysis with Claude: dialect, sentiment, aspects and suggested fixes |
| `server/index.mjs` | HTTP server for the pages and the API |
| `scripts/build.mjs` | Builds `index.html`, `app.html` and the `dist/` fragments |
| `test/` | Unit tests (`npm test`) |

## Run it

```bash
npm install
```

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Open http://localhost:8787 for the site and http://localhost:8787/app for the app. Without an API key everything works except review analysis.

Slide rendering needs Chromium. The server looks for `CHROMIUM_PATH`, then the browser Playwright installs:

```bash
npx playwright-core install chromium
```

Static hosting still works: `index.html` and `app.html` run without the server, and the app falls back to its demo behaviour.

## API

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /api/health` | | `{ ok, render, ai, model }` |
| `POST /api/audit` | `{ listing: { channel, category, titleEn, titleAr, bulletsEn[], bulletsAr[], images[{ width, height, whiteBackground, arabicTextBroken }], attributes{}, sizeChart, reviewThemes[] } }` | `{ score, breakdown, issues[{ key, sev, area, detail }] }` |
| `POST /api/render` | `{ kind: cover \| benefit \| details \| occasion, image: data URL, language: ar \| en \| both, numerals: arabic \| western, kit{ bg, fg, accent }, brand, headlineAr, headlineEn, bulletsAr, bulletsEn, occasionAr, occasionEn }` | `image/png`, 1600 × 2000 |
| `POST /api/reviews/analyze` | `{ product, reviews: [string \| { text, rating }] }` (up to 200) | `{ total, dialects, themes[], reviews[], fixes[] }` |
| `POST /api/leads` | `{ name, whatsapp, store, lang }` | `{ ok }`, appended to `data/leads.jsonl` |

Review analysis uses `claude-opus-5-5` (override with `BASIRA_MODEL`) at low effort, with structured output validated by Zod, and server-side fallback (`fallbacks: "default"`) if a request is declined.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `ANTHROPIC_API_KEY` | | Enables review analysis |
| `BASIRA_MODEL` | `claude-opus-5-5` | Model for review analysis |
| `CHROMIUM_PATH` | | Chromium binary for rendering |
| `BASIRA_DATA_DIR` | `./data` | Where leads are stored |

## Language

The page is fully bilingual. English text lives in the markup; Arabic lives in the `AR` dictionary at the bottom of `src/landing.html`, keyed by each element's `data-i18n` attribute. Switching to Arabic sets `dir="rtl"` on the document, and the layout uses logical CSS properties so it mirrors correctly. Visitors whose browser language is Arabic get Arabic by default.

## Lead forms

Both forms work in the browser but do not send data anywhere yet. To collect leads, define an endpoint before the page script runs:

```html
<script>window.BASIRA_LEAD_ENDPOINT = "https://your-backend.example/leads";</script>
```

The final form then POSTs `{ name, whatsapp, store, lang }` as JSON. When the page is served by the Basira server it posts to `/api/leads` automatically.

## Placeholder content to review

- Prices (399 / 1,490 SAR) and plan limits
- All figures in the demo, catalog table, chart and agency report are labelled as sample or example data
- "Layali Fragrances" and "Oud Al Layl" are fictional

## The app

The app works on sample data for a fictional client (Layali Fragrances, 8 listings). Views are routed by hash: `#overview`, `#audit`, `#catalog`, `#listing-<id>`, `#studio-<id>`, `#reviews`, `#approvals`.

What is real:
- **Audit** runs the real engine in the browser; the score updates as you type.
- **Studio**, when served by the Basira server, renders real 1600 × 2000 PNGs with correct Arabic shaping, from your uploaded product photo or the sample drawing. Without the server it shows the live preview and simulates generation.
- **Reviews → Analyse your reviews** calls Claude through the server.

Still simulated: the fidelity check, catalog data, approvals and publishing to marketplaces (no marketplace APIs are connected yet), and background removal (upload a PNG with a transparent background).
