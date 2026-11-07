# Basira · بصيرة

**AI product content intelligence for MENA e-commerce.**

Basira finds what is costing a listing sales, learns from what buyers write in reviews (Gulf, Egyptian, Levantine Arabic, MSA and English), fixes the content on brand in Arabic and English, publishes the fix to Amazon, Noon, Salla, Zid and Shopify, and measures the result.

This repository holds the marketing site, the product app and the server that powers it.

Strategy, target pipeline and the status of every part: [`ROADMAP.md`](ROADMAP.md). Pipeline diagram: [`docs/pipeline.html`](docs/pipeline.html).

## Structure

| Path | What it is |
| --- | --- |
| `src/landing.html` | Landing page source (styles, markup, Arabic translations and scripts in one file) |
| `src/app.html` | Product app: overview, Brand DNA, live listing audit, catalog, bulk fixes and export, listing diagnosis, photo check and on-model photos, reviews, templates, slide studio, approvals, results, unit economics, settings |
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
| `server/brand-dna.mjs` | Brand DNA: evidence-weighted brand genome (traits used both to generate and to check, learning from edits, approvals and sales results), the record of which templates and fixes raised conversion, and the brand check in the listing audit; shared with the app |
| `server/brand-ai.mjs` | Claude: reads brand materials into proposed rules; writes listing copy with the brand brief |
| `server/brand-seed.mjs` | Sample client workspaces (Layali with a learning history, Noor as a new client) |
| `server/auth.mjs` | Accounts (one agency or one brand each), users, scrypt passwords, sessions, single-use team invites |
| `server/store.mjs` | File store per client workspace: genome, event log, export assets; account (plan, usage, invoices); data export and deletion |
| `server/copy-rules.mjs` | Applies the brand's checkable rules (avoided words, no "!", no emoji, digits, headline length) to existing copy without AI, shared with the app |
| `server/exports.mjs` | Upload files per channel: Amazon flat file (PartialUpdate, English and Arabic), Shopify product CSV, Noon, Salla and Zid CSVs, shared with the app |
| `server/zip.mjs` | Minimal ZIP writer, shared with the app |
| `server/results.mjs` | Reads marketplace sales reports, compares changed products with a control group, and judges each product's own result (z-test on its sessions), shared with the app |
| `server/report.mjs` | Before/after report for the client as an A4 HTML document under the agency's logo (PDF on the server, print in the browser), shared with the app |
| `server/billing.mjs` | Plans, monthly usage metering (fixes, renders, AI calls), plan expiry, shared with the app |
| `server/payments.mjs` | Moyasar Invoices API: hosted checkout in SAR (Mada, cards, Apple Pay) and invoice verification |
| `server/imagegen.mjs` | Image model adapters (OpenAI image edits, Gemini image generation, a generic JSON contract) for generated slides and on-model photos |
| `server/textcheck.mjs` | Which slides an image model may draw whole, the prompt, and the letter-by-letter comparison of approved and read-back text, shared with the app |
| `server/slidegen.mjs` | Generated slides with a guarantee: Claude reads the text back blind, digits and Arabic joining are checked, the product colour is compared; up to 3 tries, then the scene without text with the headline typeset over it |
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
| `GET /api/health` | | `{ ok, render, ai, model, imageGen, imageProvider, slideGen, billing, amazonPublish, publicUrl, auth }` |
| `POST /api/auth/signup` | `{ type: agency \| brand, name, company, email, password }` | `{ auth, user, account }` and the session cookie. An agency starts with the two sample clients, a brand with its own brand as the only workspace |
| `POST /api/auth/login` | `{ email, password }` | Same; 401 on a wrong password, 429 after 5 failures in 15 minutes |
| `POST /api/auth/logout` | | Ends the session and clears the cookie |
| `GET /api/auth/me` | | `{ auth, user, account{ id, type, name } }`; 401 when signed out. With accounts off: `{ auth: false, account }` |
| `GET /api/auth/invite?code=` | | `{ valid, account }` |
| `POST /api/auth/join` | `{ code, name, email, password }` | Joins the inviting account as a member; 410 if the invite was used or expired |
| `GET /api/team` | | `{ members[{ id, email, name, role }], canInvite }` |
| `POST /api/team/invite` | | `{ code, expires, url }`: a single-use link valid 7 days (owner only) |
| `DELETE /api/team/:userId` | | Removes a member and ends their sessions (owner only) |
| `PATCH /api/account` | `{ type: agency \| brand, name }` | Switches between agency and single-brand mode (owner only) |
| `POST /api/audit` | `{ listing: { channel, category, titleEn, titleAr, bulletsEn[], bulletsAr[], images[{ width, height, whiteBackground, arabicTextBroken }], attributes{}, sizeChart, reviewThemes[] }, ws? }` | `{ score, breakdown, issues[{ key, sev, area, detail }] }`. With `ws`, also `brand: { score, checked, issues[] }`: the copy checked against that workspace's brand rules |
| `POST /api/render` | `{ template, fields{}, image: data URL, language: ar \| en \| both, numerals: arabic \| western, kit{ bg, fg, accent }, brand, logo?: { src: data URL, pos }, fonts?: kufi \| naskh \| modern }` (the older `kind` + `headlineAr`… shape still works) | `image/png`, 1600 × 2000 |
| `POST /api/reviews/analyze` | `{ product, reviews: [string \| { text, rating }] }` (up to 200) | `{ total, dialects, themes[], reviews[], fixes[] }` |
| `POST /api/import` | `{ url, limit? }`: an Amazon, Noon, Shopify, Salla or Zid product or store link | `{ source, count, averageScore, items[{ sku, name, url, image, listing, audit }], warnings }` |
| `POST /api/import/csv` | `{ csv, channel?, category?, measure? }` | Same as above |
| `GET /api/connectors` | | Which marketplaces are connected and what they can import |
| `POST /api/reviews/reply` | `{ review, product, brand }` | `{ language, reply, replyEn, needsPerson, reason }` |
| `POST /api/keywords` | `{ listing }` | `{ category, items[{ ar, en, inAr, inEn }], covered, total }` |
| `POST /api/fetch-image` | `{ url }` | `{ dataUrl }` for a public PNG, JPEG or WebP |
| `POST /api/photos/review` | `{ photos: [data URL] (1-4), product, channel }` | `{ photos[{ index, scores, arabicText, strengths, problems }], winner, why }` |
| `GET /api/workspaces`, `POST /api/workspaces` | `{ name, nameAr }` | Client workspaces |
| `GET /api/brand/:ws`, `PUT /api/brand/:ws` | `{ genome, baseVersion }` | Brand DNA genome; PUT returns 409 if the stored version moved on |
| `GET /api/brand/:ws/events?product=`, `POST /api/brand/:ws/events` | `{ events[] }` | Feedback event log (Product Memory) |
| `POST /api/brand/analyze` | `{ name, url?, pdf?: data URL, images?: [data URL], texts?: [] }` | `{ proposals[], palette[], logoPos, sources }` |
| `POST /api/copy` | `{ product, channel, category, listing, issues[], missingKeywords[], brief }` | `{ titleEn, titleAr, bulletsEn[], bulletsAr[], changes[] }` |
| `POST /api/leads` | `{ name, whatsapp, store, lang }` | `{ ok }`, appended to `data/leads.jsonl` |
| `POST /api/export` | `{ ws, channel: noon \| amazon \| salla \| zid \| shopify, client, style{ language, numerals, brand, logo, fonts }, items[{ sku, name, copy{ titleEn, titleAr, bulletsEn[], bulletsAr[] }, image, slides[{ template, fields, kit }], extraImages[] }] }` (up to 50 products, 9 images each) | `{ batch, zipUrl, hosted, files[], items[{ sku, images[url] }], rendered }`. Slides are rendered, stored and served at `/assets/<account>/<ws>/<batch>/images/…`; the ZIP holds `images/`, the channel's upload files and a README |
| `GET /assets/<account>/<ws>/<batch>/<file>` | | Hosted export images (public, so marketplaces can fetch them; long random account and batch ids) and the ZIP |
| `POST /api/publish/amazon` | `{ ws, batch, marketplace: amazon.sa \| amazon.ae \| amazon.eg }` | `{ results[{ sku, status: ACCEPTED \| INVALID \| NOT_FOUND, submissionId, issues[] }], imagesIncluded }`: SP-API Listings PATCH of title, bullets (both languages) and image links |
| `POST /api/report/pdf` | `{ result (from compareResults), agency{ name, logo, colour }, client, period, lang }` | `application/pdf`, A4 |
| `GET /api/account` | | `{ plan, planName, limit, used, left, over, renders, ai, paidUntil, plans[], billing, agency, invoices[], type, accountName, role, auth }` |
| `PUT /api/account/agency` | `{ name, colour, logo }` | Agency profile for reports |
| `POST /api/billing/checkout` | `{ plan: seller \| agency }` | `{ id, url, amount }`: Moyasar hosted invoice (SAR, incl. 15% VAT) |
| `GET /api/billing/verify?id=` | | Checks an invoice this server created; a paid one switches the plan for a month |
| `PATCH /api/workspaces/:ws` | `{ consentTraining }` | Records the client's consent to anonymised use |
| `GET /api/workspaces/:ws/export` | | Everything stored for the client, as a JSON download (PDPL access request) |
| `DELETE /api/workspaces/:ws` | | Deletes the client with its genome, events and exports (PDPL erasure) |
| `POST /api/slides/generate` | `{ template, fields, image, kit, language, numerals, fonts, logo, brand, product, category, visual }` | `{ mode: generated \| scene \| typeset, reason, image: data URL, attempts[{ ok, reasons, readback, fidelity }] }`. Lists, tables and the main image are always typeset |
| `POST /api/imagegen/onmodel` | `{ image: data URL, product, category, look, cover, setting, count, visual }` | `{ images[data URL], prompt }` |

Usage metering: an `approve` event counts as one fix; `/api/render`, exports and generated photos count renders; Claude and image-model calls count AI. When the month's fixes are used, AI drafting and photo generation answer 402; approvals, exports and learning keep working.

## Accounts

Anyone can create an account in the app: an **agency** (several client brands) or a **brand** (its own products). Each account's workspaces, Brand DNA, events, plan and exports live in their own folder, `data/accounts/<account id>/`, and no request can reach another account's data. Every API route except health, leads, the sign-in routes and hosted export files needs a session.

- Passwords are hashed with scrypt; session tokens are random, stored only as SHA-256 hashes, and sent as an `HttpOnly`, `SameSite=Lax` cookie (`Secure` over https) that lasts 30 days.
- Requests that change something are refused when they come from another site's page (Origin check).
- Five wrong passwords for one email from one address, or 20 from any addresses, lock sign-in to that email for 15 minutes.
- The owner invites teammates with single-use links that expire in 7 days and can remove them; members work on the same brands but can't change the account type or invite.
- **Single-brand mode** hides the agency tools: no client switcher or "new client", brand wording on reports and data controls, and the Seller plan marked as the fit. The owner can switch modes in Settings.

Not built yet: email verification and password reset by email (the owner can invite a person again), and per-plan limits on the number of clients. Users and sessions are kept in one JSON file (`data/auth/auth.json`), which is fine for pilots on one server; move it to a database before running several instances.

Set `BASIRA_AUTH=off` to run without accounts, as one shared workspace (the data stays at the root of `BASIRA_DATA_DIR`); only do that on a private network.

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
| `BASIRA_DATA_DIR` | `./data` | Leads, accounts, client workspaces, Brand DNA genomes and event logs |
| `BASIRA_AUTH` | on | `off` runs without sign-in, as one shared workspace (private networks only) |
| `SPAPI_CLIENT_ID`, `SPAPI_CLIENT_SECRET`, `SPAPI_REFRESH_TOKEN` | | Amazon Selling Partner API app credentials (Login with Amazon) |
| `SPAPI_SELLER_ID` | | The connected seller account, needed to import a whole Amazon store |
| `SPAPI_ENDPOINT` | `https://sellingpartnerapi-eu.amazon.com` | SP-API endpoint (Saudi Arabia, UAE and Egypt use the EU one) |
| `PUBLIC_URL` | | The server's public https address. Export image links use it, so marketplaces can fetch the images; without it the links in upload files stay empty |
| `MOYASAR_SECRET_KEY` | | Moyasar secret key for online payments (Mada, cards, Apple Pay) |
| `MOYASAR_API` | `https://api.moyasar.com/v1` | Moyasar API base |
| `IMAGE_PROVIDER` | | `openai` (image edits, default model `gpt-image-1`), `gemini` (default model `gemini-3-pro-image-preview`) or `generic`. Generated slides also need `ANTHROPIC_API_KEY` for the text check |
| `IMAGE_API_KEY` | | Key for the image provider |
| `IMAGE_MODEL` | | Override the provider's model name (check it when the key arrives: these adapters have not been called live) |
| `IMAGE_API_URL` | | Endpoint for `generic` (`POST { prompt, negative_prompt, image, width, height, num_images }` → `{ images: [{ url } \| { b64_json }] }`); overrides the endpoint for the other two |

## Marketplace connectors

| Source | Product link | Whole store | How |
| --- | --- | --- | --- |
| Amazon (.sa, .ae, .eg) | Yes | Your own seller account | SP-API Catalog Items (English and Arabic locales) and Listings Items, including Amazon's own listing issues |
| Noon | Yes | Upload a Seller Lab export | The product page's schema.org data, plus its `-ar` twin for Arabic |
| Shopify | Yes | Yes | The public `/products.json` feed, plus `/ar/` translations |
| Salla, Zid | Yes | Upload an export | The product page's schema.org data and its Arabic `hreflang` alternate |
| Any CSV | | Yes | Column names are matched automatically (`title_ar`, `bullet_1`, `main_image`…) |

Outbound requests are HTTPS only, block private addresses at every redirect, and have size and time limits. Main images are downloaded and measured to check size and white background.

Publishing back: Amazon listings are updated directly through SP-API (`POST /api/publish/amazon`) for the connected seller account. Noon, Salla, Zid and Shopify get upload files in the export ZIP; their column names are Basira's generic ones except Shopify's and Amazon's, so check them against the channel's current bulk template.

What isn't covered yet: Noon's partner API (not publicly available; store catalogs come from exports), reading reviews from marketplaces (paste or export them), and direct publishing to Noon, Salla, Zid and Shopify.

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

The app works on sample data for a fictional client (Layali Fragrances, 8 listings). Views are routed by hash: `#overview`, `#brand`, `#audit`, `#catalog`, `#batch`, `#listing-<id>`, `#studio-<id>`, `#photos`, `#reviews`, `#templates`, `#approvals`, `#results`, `#profit`, `#settings`.

What is real:
- **Audit** runs the real engine in the browser; the score updates as you type. It also checks the copy against the client's brand rules, as do the Catalog (Brand column) and each listing.
- **Studio**, when served by the Basira server, renders real 1600 × 2000 PNGs with correct Arabic shaping, from your uploaded product photo or the sample drawing. Without the server it shows the live preview and simulates generation.
- **Reviews → Analyse your reviews** calls Claude through the server.

- **Catalog → Import** pulls listings from a link (server) or a CSV (works in the browser too, try the sample Noon export).
- **Templates** has 17 slide templates in four groups; add any of them to a product's slide set in **Studio**.
- **Search terms** in Audit and on each listing show which common Gulf searches the copy covers.
- **Reviews → Draft reply** writes a reply in the buyer's own dialect with Claude, and flags reviews that need a person.
- **Photo check** measures main-image candidates against Amazon and Noon rules, removes plain backgrounds, rebuilds a compliant 2000 × 2000 main image, and (with the server) asks Claude which photo is most likely to be clicked.
- **Unit economics** compares profit per unit across Noon, Amazon, Salla, Zid and Shopify after VAT, fees, delivery, cash on delivery, ads and returns. Fee defaults are starting values to replace with your own.
- **Bulk fixes**: select products in the Catalog, and the brand's rules are applied to all of them at once (with Claude drafts when a key is set). Review, approve one by one or all, then export a ZIP for the channel: upload files, README and, with the server, every slide as a PNG. Amazon can be updated directly when a seller account is connected.
- **Results**: upload sales reports from before and after the fixes (Amazon Business Reports, Noon and other exports). Products that weren't changed are the control group, and the uplift is the changed products' gain minus theirs. The client report carries the agency's logo and colour; PDF on the server, print from the browser. **Teach Brand DNA** turns each fixed product's result into evidence: a product that beat the control group strengthens the brand rules its approved content followed, a worse one weakens only rules learned from edits, and slide templates and kinds of fix keep a record of what raised conversion. The brief, the Brand DNA screen, Templates and the audit's "Fix first" order read that record.
- **Sign-in** (server with accounts on): create an agency or brand account, sign in, join a team from an invite link. A brand gets the simpler single-brand app.
- **Settings**: account type (agency or single brand), team and invites, agency or brand profile for reports, plan and real usage (from the server, or counted in the browser), Moyasar checkout, and per-client data download, deletion and consent to anonymised use.
- **On-model photos** (Photo check): generate the garment worn by a model with modest styling through an image model, or check a photo made elsewhere. Every result is checked for colour against the product photo before it can go into an export.

Sample data: the catalog, reviews and the approval queue start with sample content; sample results reports are labelled. Approval no longer pretends to publish: it marks the fix ready to export.
