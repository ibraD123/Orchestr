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
| `server/templates.mjs` | 17 slide templates (shared by the server renderer and the app preview) |
| `server/render.mjs` | Slide renderer: Arabic and English typeset by Chromium over the product image, exported as 1600 × 2000 PNG; also measures main images |
| `server/connectors/` | Marketplace connectors: Amazon SP-API, Shopify, product pages (Noon, Salla, Zid) and safe outbound HTTP |
| `server/importer.mjs` | Imports a catalog from a link or CSV, measures main images and audits every listing |
| `server/catalog-csv.mjs` | Catalog export parser (Noon Seller Lab, Amazon, Salla, Zid), shared with the app |
| `server/keywords.mjs` | Search-term coverage with Arabic spelling normalisation, shared with the app |
| `server/economics.mjs` | Unit economics per channel (VAT, commission, fulfilment, COD, ads, returns), shared with the app |
| `server/photo-metrics.mjs` | Photo checks (white background, product fill) and background removal on raw pixels, shared with the app |
| `server/photo.mjs` | Claude reviews main-image candidates and picks the one most likely to be clicked |
| `server/reviews.mjs` | Claude: review analysis (dialect, sentiment, aspects, fixes) and reply drafts |
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
| `POST /api/render` | `{ template, fields{}, image: data URL, language: ar \| en \| both, numerals: arabic \| western, kit{ bg, fg, accent }, brand }` (the older `kind` + `headlineAr`… shape still works) | `image/png`, 1600 × 2000 |
| `POST /api/reviews/analyze` | `{ product, reviews: [string \| { text, rating }] }` (up to 200) | `{ total, dialects, themes[], reviews[], fixes[] }` |
| `POST /api/import` | `{ url, limit? }`: an Amazon, Noon, Shopify, Salla or Zid product or store link | `{ source, count, averageScore, items[{ sku, name, url, image, listing, audit }], warnings }` |
| `POST /api/import/csv` | `{ csv, channel?, category?, measure? }` | Same as above |
| `GET /api/connectors` | | Which marketplaces are connected and what they can import |
| `POST /api/reviews/reply` | `{ review, product, brand }` | `{ language, reply, replyEn, needsPerson, reason }` |
| `POST /api/keywords` | `{ listing }` | `{ category, items[{ ar, en, inAr, inEn }], covered, total }` |
| `POST /api/fetch-image` | `{ url }` | `{ dataUrl }` for a public PNG, JPEG or WebP |
| `POST /api/photos/review` | `{ photos: [data URL] (1-4), product, channel }` | `{ photos[{ index, scores, arabicText, strengths, problems }], winner, why }` |
| `POST /api/leads` | `{ name, whatsapp, store, lang }` | `{ ok }`, appended to `data/leads.jsonl` |

Review analysis uses `claude-opus-5-5` (override with `BASIRA_MODEL`) at low effort, with structured output validated by Zod, and server-side fallback (`fallbacks: "default"`) if a request is declined.

## Deploy

The `Dockerfile` builds on the Playwright image, which already includes Chromium.

```bash
docker build -t basira .
```

```bash
docker run -p 8787:8787 -e ANTHROPIC_API_KEY=sk-ant-... -v basira-data:/data basira
```

On Render, create a Blueprint from this repository: `render.yaml` sets up the service, a disk for leads and the secret variables to fill in. Any host that runs a Docker image (Fly.io, Railway, a VPS) works the same way.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `ANTHROPIC_API_KEY` | | Enables review analysis |
| `BASIRA_MODEL` | `claude-opus-5-5` | Model for review analysis |
| `CHROMIUM_PATH` | | Chromium binary for rendering |
| `BASIRA_DATA_DIR` | `./data` | Where leads are stored |
| `SPAPI_CLIENT_ID`, `SPAPI_CLIENT_SECRET`, `SPAPI_REFRESH_TOKEN` | | Amazon Selling Partner API app credentials (Login with Amazon) |
| `SPAPI_SELLER_ID` | | The connected seller account, needed to import a whole Amazon store |
| `SPAPI_ENDPOINT` | `https://sellingpartnerapi-eu.amazon.com` | SP-API endpoint (Saudi Arabia, UAE and Egypt use the EU one) |

## Marketplace connectors

| Source | Product link | Whole store | How |
| --- | --- | --- | --- |
| Amazon (.sa, .ae, .eg) | Yes | Your own seller account | SP-API Catalog Items (English and Arabic locales) and Listings Items, including Amazon's own listing issues |
| Noon | Yes | Upload a Seller Lab export | The product page's schema.org data, plus its `-ar` twin for Arabic |
| Shopify | Yes | Yes | The public `/products.json` feed, plus `/ar/` translations |
| Salla, Zid | Yes | Upload an export | The product page's schema.org data and its Arabic `hreflang` alternate |
| Any CSV | | Yes | Column names are matched automatically (`title_ar`, `bullet_1`, `main_image`…) |

Outbound requests are HTTPS only, block private addresses at every redirect, and have size and time limits. Main images are downloaded and measured to check size and white background.

What isn't covered yet: Noon's partner API (not publicly available; store catalogs come from exports), reading reviews from marketplaces (paste or export them), and publishing changes back.

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

- **Catalog → Import** pulls listings from a link (server) or a CSV (works in the browser too, try the sample Noon export).
- **Templates** has 17 slide templates in four groups; add any of them to a product's slide set in **Studio**.
- **Search terms** in Audit and on each listing show which common Gulf searches the copy covers.
- **Reviews → Draft reply** writes a reply in the buyer's own dialect with Claude, and flags reviews that need a person.
- **Photo check** measures main-image candidates against Amazon and Noon rules, removes plain backgrounds, rebuilds a compliant 2000 × 2000 main image, and (with the server) asks Claude which photo is most likely to be clicked.
- **Unit economics** compares profit per unit across Noon, Amazon, Salla, Zid and Shopify after VAT, fees, delivery, cash on delivery, ads and returns. Fee defaults are starting values to replace with your own.

Still simulated: the fidelity check, sample catalog data, approvals and publishing back to marketplaces, and background removal (upload a PNG with a transparent background).
