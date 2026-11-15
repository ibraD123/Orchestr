# Basira · بصيرة

**AI product content intelligence for MENA e-commerce.**

Basira finds what is costing a listing sales, learns from what buyers write in reviews (Gulf, Egyptian, Levantine Arabic, MSA and English), fixes the content on brand in Arabic and English, publishes the fix to Noon, Amazon, Salla and Zid, and measures the result.

This repository holds the marketing site, the product app and the server that powers it.

Strategy, target pipeline and the status of every part: [`ROADMAP.md`](ROADMAP.md). Pipeline diagram: [`docs/pipeline.html`](docs/pipeline.html).

## Structure

| Path | What it is |
| --- | --- |
| `src/landing.html` | Landing page source (styles, markup, Arabic translations and scripts in one file) |
| `src/app.html` | Product app: overview, Brand DNA, live listing audit, catalog, bulk fixes and export, listing diagnosis, photo check and on-model photos, reviews, templates, slide studio, approvals, results, settings |
| `src/creator-workspace.js`, `src/creator-workspace.css` | Creator workspace, inlined by the build: product projects, one preview with a frame strip, EN/AR versions, set/single templates, model library and quick try-on/runway actions |
| `server/creator-api.mjs`, `server/creator-projects.mjs` | Account/client-scoped project API and file-backed revisions, exact-revision agency approvals, sanitized reusable structures and immutable release snapshots |
| `server/creator-edit.mjs` | Raster generation/editing with the original product reference, exact-copy checks, Arabic readback, product comparison and actual aspect-ratio evidence. Every output is a new revision; no editable text layers |
| `server/creator-models.mjs` | Real model generation, product-on-model generation and runway animation of an approved try-on revision, using the configured image/video providers |
| `server/creator-portal.mjs` | Sends frozen approved releases into the existing client portal; client approval and pinned feedback remain bound to exact revision IDs, including mixed image/video sets |
| `server/collaboration.mjs` | Persistent client batches, current-version progress, comment-to-task workflow, information requests, exact bulk decisions and ready-product delivery |
| `src/agency-room.js`, `src/portal-room.js` | Agency batch workspace and client room with a frame strip, revision comparison, task replies and partial batch downloads |
| `src/workspace-design.js`, `src/workspace-design.css` | Studio visual system, grouped navigation, catalog action accordion, EN/AR and responsive light/dark layouts. Inlined by the build |
| `src/home-workspace.js/css`, `server/home-workflow.mjs` | Home replaces Dashboard: client-scoped photo/catalog entry, four visual workflows, saved actionable decisions and recent projects/batches. Source and optional brief enter the existing Creator without starting generation |
| `server/home-photo-audit.mjs` | Explicit image-only AI review for uploaded photos, with the existing AI allowance and no fabricated listing. Catalog products retain the full listing-audit path |
| `server/studio-flow.mjs`, `server/content-plan.mjs`, `src/creative-studio.js`, `src/canvas-studio.js`, `src/production-studio.js` | Photo/catalog/template entry into an independent creative project, optional SKU binding, canvas-first editing and separate source-delivery preparation |
| `server/audit.mjs` | Listing audit engine (pure functions, shared by the server and the app) |
| `server/templates.mjs` | 18 slide templates (shared by the server renderer and the app preview) |
| `server/render.mjs` | Slide renderer: Arabic and English typeset by Chromium over the product image, exported as 1600 × 2000 PNG; also measures main images |
| `server/connectors/` | Marketplace connectors: Amazon SP-API, product pages (Noon, Salla, Zid and stores on their own domain) and safe outbound HTTP; Amazon catalog search for Creator (`search.mjs`) |
| `server/importer.mjs` | Imports a catalog from a link or CSV, measures main images and audits every listing |
| `server/catalog-csv.mjs` | Catalog export parser (Noon Seller Lab, Amazon, Salla, Zid), shared with the app |
| `server/creative-direction.mjs`, `src/director-guide.js` | Visual first-run director: purpose, lighting, reorderable storyboard, language variants, optional confirmed facts and no-charge preview before queue confirmation |
| `server/listing-sets.mjs`, `src/listing-sets.js/css`, `src/listing-sequences.js/css` | Listing Sets replaces Templates: category-led image sequences, Amazon/noon/Salla/Zid profiles, frame-specific facts, illustrative mobile preview and existing production-budget confirmation |
| `server/listing-frame-data.mjs`, `src/listing-patterns.js/css` | Research-led frame templates: dimensions, size tables, volume/pack count, contents, compatibility, ingredients and usage; validated structured data enters saved slots and real prompts; bilingual single-image or separate EN/AR output |
| `server/production.mjs`, `server/generation-budget.mjs` | Durable image production queue, per-account atomic credit reservation, failed-only retry, restart reconciliation and reviewed partial ZIP |
| `server/catalog-workflow.mjs`, `src/catalog-workflow.js` | Persistent imported catalogs per client; SKU/channel upserts, selected catalog CSV export, batch Creator project preparation, client reviews and exact client-approved media ZIP |
| `server/keywords.mjs` | Search-term coverage with Arabic spelling normalisation, shared with the app |
| `server/photo-metrics.mjs` | Photo checks (white background, product fill) and background removal on raw pixels, shared with the app |
| `server/photo.mjs` | Claude reviews main-image candidates and picks the one most likely to be clicked |
| `server/brand-dna.mjs` | Brand DNA: evidence-weighted brand genome (traits used both to generate and to check, learning from edits, approvals and sales results), the record of which templates and fixes raised conversion, and the brand check in the listing audit; shared with the app |
| `server/brand-ai.mjs` | Claude: reads brand materials into proposed rules; writes listing copy with the brand brief |
| `server/brand-seed.mjs` | Sample client workspaces (Layali with a learning history, Noor as a new client) |
| `server/auth.mjs` | Accounts (one agency or one brand each), users, scrypt passwords, sessions, single-use team invites |
| `server/store.mjs` | File store per client workspace: genome, event log, export assets; account (plan, usage, invoices); data export and deletion |
| `server/copy-rules.mjs` | Applies the brand's checkable rules (avoided words, no "!", no emoji, digits, headline length) to existing copy without AI, shared with the app |
| `server/exports.mjs` | Upload files per channel: Amazon flat file (PartialUpdate, English and Arabic), Noon, Salla and Zid CSVs, shared with the app |
| `server/zip.mjs` | Minimal ZIP writer, shared with the app |
| `server/results.mjs` | Reads marketplace sales reports, compares changed products with a control group, and judges each product's own result (z-test on its sessions), shared with the app |
| `server/report.mjs` | Before/after report for the client as an A4 HTML document under the agency's logo (PDF on the server, print in the browser), shared with the app |
| `server/billing.mjs` | Plans, monthly usage metering (fixes, renders, AI calls), plan expiry, shared with the app |
| `server/payments.mjs` | Moyasar Invoices API: hosted checkout in SAR (Mada, cards, Apple Pay) and invoice verification |
| `server/imagegen.mjs` | Image model adapters (OpenAI image edits, Gemini image generation, a generic JSON contract). Several can be configured at once: text on images goes to Gemini first, scenes and people to OpenAI. The brand model photo is sent as a second reference |
| `server/textcheck.mjs` | Which slides an image model may draw whole, the prompt, and the letter-by-letter comparison of approved and read-back text, shared with the app |
| `server/llm.mjs` | One call for structured answers from the language model: the Anthropic API when `ANTHROPIC_API_KEY` is set, otherwise the same Claude model through fal (JSON Schema in the instructions, answer checked with zod, asked again once if it doesn't fit) |
| `server/slidegen.mjs` | Generated slides with a guarantee: Claude reads the text back blind, digits and Arabic joining are checked, the product colour is compared; up to 3 tries, then the scene without text with the headline typeset over it. Claude also compares the product's shape and logo with the photo and notes AI-generated people; with two image models each round asks both and keeps the better image that passes |
| `server/portal.mjs` | The client portal: a private link per client brand (no sign-in) where the client approves or asks for changes with comments pinned to a spot on an image, sends requests and fills in the brand questionnaire. Pure functions; the server stores it per workspace (`portal.json`), and only a hash of each link is kept in the server-wide index |
| `src/portal.html` | The client's page, served at `/c/<token>`: English and Arabic, the agency's logo and colour |
| `server/connectors/noon.mjs` | Noon Content API: service-account sign-in (RS256 JWT, then a session cookie), UpsertProduct, GetContent, category attributes |
| `server/videogen.mjs` | Gallery videos: one approved image animated through the fal queue (MiniMax Hailuo 2.3 Fast by default; other MiniMax models, Kling and Veo 3.1 also work), no text added and no audio; frames from the start, middle and end are read by Claude for added text and compared with the product photo; one retry |
| `server/creator.mjs` | Creator's planning, shared with the app: the slide set a product needs from reviews, audit, competitor galleries and sales results; what competitors' galleries cover; how much a main image stands out in search; season packs with roll-back |
| `server/gallery.mjs` | Reads competitor galleries image by image with Claude (main, lifestyle, size chart, comparison…, Arabic on the image, broken Arabic) |
| `server/ai-label.mjs` | Writes the IPTC "trainedAlgorithmicMedia" label into PNGs that show AI-generated people (Amazon asks for such images to be labelled) |
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

The committed `.env` contains shared configuration without API keys. Keep real credentials in `.env.local` (ignored by Git), for example `FAL_KEY=…` and `ANTHROPIC_API_KEY=…`. The server entry point loads `.env.local` first, then `.env` defaults. Variables already set in the environment win. Tests that import the server do not load either file.

Open http://localhost:8787 for the site and http://localhost:8787/app for the app. Project storage, uploads, templates, manual reviews and ZIP exports work without AI keys. Image generation, AI edits, try-on, video and AI analyses require their configured providers.

Slide rendering needs Chromium. The server looks for `CHROMIUM_PATH`, then the browser Playwright installs:

```bash
npx playwright-core install chromium
```

The landing can be hosted statically with `dist/assets/`. Catalog audit demo works without the server; Creator projects, generation and production require the Basira backend.

### Creator workspace

Creator stores `creator.json` and media assets per account/client workspace; reusable agency templates are saved separately as `creator-templates.json`. A creative project has its own ID, an optional catalog/SKU link, UAE destination and placement, verified product facts, original photos, slots, language-specific raster revisions and approved releases. EN and AR versions are separate assets; a shared clean main image uses `none`. A template shares only validated generic structure and style, excluding source photos, product facts and generation instructions.

Creator opens on a large reference canvas with a bottom instruction composer and a horizontally scrolling tool rail. Upload, paste, drag a photo or choose a saved client image from Gallery; catalog, language, preset and project name are optional settings. Save draft persists without generation; Generate explicitly starts the first frame (try-on first for runway). Focus mode hides navigation and Escape restores it. Saved projects keep frames, EN/AR selection and optional Details & history panels; preparation for placement remains separate. AI changes produce new revisions, preserving previous files and reviews. Agency approval applies to the selected revision ID. A release freezes the exact selected approved revisions; exporting it packages saved bytes and the frozen manifest without generating new content. Marketplace acceptance is a separate process. Release files require review against the target placement; this export does not claim that separate EN/AR galleries are supported by each marketplace or that the raw provider format is ready for every upload profile.

Models belong to the selected client. Generate a reference identity or upload one, choose a product project, then **Try on**. Product checks must pass before a try-on is saved. **Runway video** uses a server-owned approved try-on frame, with start/middle/end frame checks. Generation never approves the result automatically. With `FASHN_API_KEY` set, new models are made by FASHN `model-create` (an uploaded face reference goes in as `face_reference`); `FASHN_MODEL_MODE` (fast | balanced | quality, default balanced) and `FASHN_MODEL_RESOLUTION` (1k | 2k | 4k, default 2k) tune it. Without it, an image provider is required for models; image edits and try-on also require the LLM checker; runway needs `FAL_KEY` and Chromium. Existing provider settings apply; one `FAL_KEY` can supply the image and LLM lanes. No new secrets are stored in project documents.

The new Creator workflow uses full raster images and AI instructions, including text changes. It does not add text-layer editing. Browser drafts are cleared when switching clients; saved projects survive reloads. File storage is intended for one server process; a database/job queue is still needed for multiple server instances and long-running work across restarts. Paid live generations have not been validated as part of the automated test run.

An agency-approved release can be sent into the existing client portal. Image and MP4 items retain exact revision references; client decisions remain separate from agency approval. Refresh client feedback in Creator and use an original Arabic/English comment or image pin as the next AI edit instruction. The new revision starts with no client approval. This prepares a portal review and a shareable link; it does not send an email or WhatsApp message.

### Listing Sets (updated 2026-11-13)

**2026-11-13:** Three visual sequence starting points per category: essential story, buying answers, and a three-photo set. Buying-answer sets require actual category data (e.g. home dimensions/contents, tech compatibility, fashion sizing); no sample values become facts. Home/bag dimension templates also offer optional interior/opening measurements with live labels. Each frame has a buyer question and live data/confirmation status. Readiness links open the relevant form. Reordering supports drag, existing arrows and Alt+Left/Right (RTL-aware); main remains first. Switching sequences preserves the reference and entered facts with one-step Undo, while only selected frames enter the request. Language/style options and additional frame patterns are collapsed. The saved slot rationale includes its exact gallery position and buyer question. Catalog audit repairs keep their focused one-frame flow. 219 tests passed without paid providers.

**2026-11-12:** A visible template shelf now adapts observed gallery patterns to the selected category. Dimensions have numeric fields, units and product/package scope; size tables distinguish garment/body/foot measurements; contents preserve quantities; compatibility preserves exclusions. Other structured templates accept actual net amount, ingredients or ordered steps. Arabic/Persian numeric input is normalized without estimating missing measurements. Data requires confirmation, persists as `listingSet.frameData` and `slot.frameData`, and reaches the production/manual generation prompt. Reusable agency templates omit it; reuse clears it. `language: "bilingual"` is supported for Listing Sets only and counts one EN+AR image per text frame, while `both` produces separate variants. The field explanation now distinguishes source facts, AI-written copy and creative direction. See the [visual gallery research and sources](docs/research/marketplace-gallery-patterns-2026-11-12.md). Five inspected galleries are a qualitative sample, not conversion evidence; apparel size tables and volume templates are labeled recommendations rather than observed findings. 206 tests passed; paid providers were not called.

Creator → **Listing Sets** replaces the passive template library with a category-led gallery builder inspired by Damu. Choose Amazon.ae/noon/Salla/Zid, category, reference photo or owned catalog product, lighting, language and frame-specific confirmed facts. Main stays first and clean. Agency structures supply generic layout/style; destination rules override main styling. Eight categories tailor the buyer question, detail frame and actual brief. Photo-only galleries share images without duplicate EN/AR charges.

`POST /api/creator/studio` accepts `listingSet` on `preview`/`start`. Preview validates the same plan used by creation and quotes exact images/credits without saving, uploading or reserving. Start saves the listing spec, per-frame directions, confirmed facts and destination-aware brief. Explicit confirmation uses the existing production queue and credit reservations. Reuse clears product-specific data. Refinement and exact-version client approval remain in Creator/Client portal. Source files still need final destination formatting and category review; the builder does not publish or certify compliance. [Workflow, sources and limits](docs/research/listing-sets-2026-11-11.md).

## Home and clear Catalog actions (2026-11-14)

`/app#overview` is Home. A collapsible illustrative product story, photo upload or saved Catalog product, optional instruction and four visual workflows lead into audit, Listing Sets, free Creator editing and try-on/runway. Opening a workflow is free; review/generation requires an explicit action. Home preserves the source and brief within the current account/client; switching clients clears the intake. It shows real answered data requests, requested edits, stale facts, accepted unstarted proposals and pending direction decisions, with links to the exact saved work. Recent projects, batches and counts come from saved data; failed panels show an error rather than an all-clear claim.

Catalog selection now separates **Review selected products** from **Create content for selected**. Review opens one product or a free list of selected product audits. Creation opens the existing production quote with the selected owned products, image count and credit budget; it never starts the queue automatically. The former universal **Prepare fixes** button no longer sends Catalog selection into legacy Bulk actions. A specific audit finding still opens **Prepare this repair** in Creator. Uploaded-photo review checks one image only; complete listing checks require a Catalog product. [Workflow and verification](docs/home-workflow-2026-11-14.md). 238 tests pass; isolated browser checks cover EN/AR, mobile RTL, source transfer, the quote, a typed client reply and banner persistence without paid providers.

## Agency workflows (2026-11-14)

Creator can request a specific product field from the client. A portal reply becomes a proposed typed value; the agency reviews its impact and confirms it. Product facts are linked to structured slots and revision snapshots across projects for the same client/catalog product. Changes update plans, preserve approval history, mark obsolete variants, and quote selected corrections through the existing production queue. Old project-wide prompts receive conservative legacy coverage; pending updates can be reopened from fact history.

Client workspace also supports exact-image creative direction approval before automated batch production and audit-based service proposals in AED/SAR/USD. Clients approve selected proposal lines; the agency materializes only the accepted work in an idempotent batch. Service prices are separate from generation credits; payment and marketplace publication are outside these steps. New queue items bind to their fact/direction version, and stale source files cannot be delivered as current. [Workflow, API and coverage limits](docs/agency-workflow-2026-11-14.md). Verified with 230 tests and isolated EN/AR browser flows without paid providers.

## API

**Catalog repair audit (2026-11-13):** `server/audit-repairs.mjs` builds an evidence-aware baseline; `audit-vision.mjs` reads the actual available gallery/text on explicit request; `catalog-audit.mjs` persists findings, coverage and version-bound handoffs. `src/catalog-repairs.js/css` replaces generic issue buttons on saved Catalog product pages with actionable repair cards, focused one-frame Creator preparation, copy replacement review and exact-version recheck. Catalog AI batch review supports up to 20 products. [Workflow and limits](docs/catalog-repair-workflow.md).

Validation: 217 tests passed, plus focused tests after final UI refinements. Browser checks on isolated data covered Catalog → organizer measurements → one-frame budget → saved Creator draft, confirmed local Arabic copy replacement, and mobile RTL without overflow or JavaScript errors. Paid providers were mocked in tests; no live audit or paid generation was invoked for validation.

`POST /api/catalog/audit`: `{ws,productId,action:read|analyze|preview|draft|copy|recheck,source?,findingId?,listingSet?,language?,image?,patch?,confirm?,revisionId?}`. Read/preview are free and non-generating; analyze/recheck use the existing text-AI allowance. Draft creates a single target slot with confirmed facts/reference and no generation; existing Production handles explicitly budgeted generation. Copy requires confirmation and updates only the local catalog with prior-text history. Recheck is bound to an owned exact selected revision; it never certifies live publication or automatically closes an issue. Stale source fingerprints reject writes. Dimensions support separate interior/opening values.

| Endpoint | Input | Output |
| --- | --- | --- |
| `POST /api/creator/studio` | `{ws,action:start\|preview\|open\|bind\|prepare,listingSet?,direction?,projectId?,catalogProductId?,image?,task?,preset?,language?,brief?,name?,templateId?,channel?}` | Starts a draft without a SKU, links an owned catalog product, or returns read-only preparation checks and exact selected versions. Does not publish |
| `POST /api/collaboration` | `{ws,action:room\|create\|take\|start\|update\|submit\|close\|request_data\|export,...}` | Agency batch room and persistent revision tasks. `submit` requires a new selected, agency-approved descendant of the commented revision |
| `POST /api/c/:token/batches` | `{action:approve\|answer\|export,batchId,selections?,taskId?,answer?,projectIds?}` | Exact current-version client decisions, answers or ZIP of selected ready products; token confines all operations to its client |
| `POST /api/catalog` | `{ws,action:list\|upsert\|export\|projects\|review\|assets,items?,ids?}` | Client catalog, batch results, catalog CSV or client-approved media ZIP. Import up to 500 rows; select up to 200 products; catalog up to 5000 products per client |
| `POST /api/creator/workspace` | `{ws}` | Full projects, reusable templates and saved models for the selected client |
| `POST /api/creator/project` | `{ws, action: create\|update\|slot\|select\|review\|release\|template\|apply, projectId?, ...}` | Project operation; release checks the exact selected approved revisions and optional `expectedSelection` |
| `POST /api/creator/upload` | `{ws, kind: source\|revision\|model, image: dataURL, projectId?, slotId?, language?, name?}` | Saved source, revision or model reference |
| `POST /api/creator/edit` | `{ws, projectId, slotId, language, prompt, approvedTexts?:[{text,lang}]}` | New saved revision with readback/product/aspect evidence. Omitted exact copy remains for review; `[]` requests no overlay text |
| `POST /api/creator/models` | `{ws, action:create\|tryon\|runway, input?, image?, modelId?, projectId?, slotId?, language?}` | Saved model or revised project, using real configured providers; runway requires the selected approved try-on frame |
| `POST /api/creator/release/export` | `{ws,projectId,releaseId}` | ZIP of exact frozen approved media plus manifest |
| `POST /api/creator/release/review` | `{ws,projectId,releaseId}` | Idempotently creates a review in the existing client portal for the exact frozen release. Does not send messages to the client |
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
| `POST /api/import` | `{ url, limit? }`: an Amazon, Noon, Salla or Zid product or store link | `{ source, count, averageScore, items[{ sku, name, url, image, listing, audit }], warnings }` |
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
| `POST /api/export` | `{ ws, channel: noon \| amazon \| salla \| zid, client, style{ language, numerals, brand, logo, fonts }, items[{ sku, name, copy{ titleEn, titleAr, bulletsEn[], bulletsAr[] }, image, slides[{ template, fields, kit }], extraImages[] }] }` (up to 50 products, 9 images each) | `{ batch, zipUrl, hosted, files[], items[{ sku, images[url] }], rendered }`. Slides are rendered, stored and served at `/assets/<account>/<ws>/<batch>/images/…`; the ZIP holds `images/`, the channel's upload files and a README |
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
| `POST /api/slides/generate` | `{ template, fields, image, kit, language, numerals, fonts, logo, brand, product, category, visual, modelRef?, bestOf? }` | `{ mode: generated \| scene \| typeset, reason, image: data URL, attempts[{ ok, reasons, readback, fidelity }] }`. Lists, tables and the main image are always typeset |
| `POST /api/imagegen/onmodel` | `{ image: data URL, product, category, look, cover, setting, count, visual, modelRef? }` | `{ images[data URL], prompt }`. `modelRef` is the brand model photo, so every product is worn by the same person |
| `POST /api/portal/:ws/link` | | `{ url }`: a new client link; the old one stops working. `GET /api/portal/:ws` returns the current `url`, reviews, requests, the questionnaire and a summary |
| `POST /api/portal/:ws/reviews` | `{ title, items[{ key, name, before{ image, copy }, after{ images[], copy } }] }` | The stored review; images (data URLs) are saved with the client's assets. `PATCH …/reviews/:id/items/:i { synced, resolve }`, `PATCH …/requests/:id { status }`, `POST …/brief/applied`, `PUT …/settings { approvers[{ name, role }], remindAfterDays, monthlyFixes, allowMinor }`, `POST …/minor` (small fixes without approval, when allowed), `POST …/files` and `DELETE …/files/:id` (library), `PUT …/results` and `DELETE …/results` (sales results shown to the client) |
| `POST /api/amazon/status` | `{ ws, batch, marketplace }` | `{ products[{ sku, buyable, discoverable, errors, issues[] }] }`: Amazon's view of a published batch (Listings Items API) |
| `GET /api/c/:token` and `POST /api/c/:token/reviews/:id/items/:i`, `POST /api/c/:token/requests`, `PUT /api/c/:token/brief` | `{ decision: approve \| changes \| comment, comment, pins[{ image, x, y, text }], name }` | The client's side, public by link |
| `POST /api/video/generate` | `{ ws, image: data URL, product, category, visual?, seconds?, scene? }` | `{ ok, url: /assets/…/video.mp4, attempts[{ ok, reasons }], model }`; a video that fails the frame check isn't returned. Needs `FAL_KEY` and Chromium. Add `video: url` to an export item to put it in the ZIP under `videos/` |
| `POST /api/creator/search` | `{ channel: amazon, query, host? }` | `{ items[{ sku, title, image, url }] }` from the SP-API catalog search. Noon has no search API: paste competitor links |
| `POST /api/creator/gallery` | `{ links[] }` (up to 8 competitor product links) | `{ competitors[{ url, title, image, kinds[], arabic, arabicBroken, images[{ kind, text, arabicBroken, note }] }] }`. Needs `ANTHROPIC_API_KEY` |

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
| `NOON_CREDENTIALS` | | Path to the Noon service account key file (.json with `key_id`, `private_key`, `project_code`). Or `NOON_KEY_ID`, `NOON_PRIVATE_KEY`, `NOON_PROJECT_CODE`. Publishing to Noon also needs `PUBLIC_URL`: Noon fetches images by link. `NOON_ATTR_TITLE`, `NOON_ATTR_BULLETS`, `NOON_ATTR_DESCRIPTION` override which category attributes hold the copy |
| `SPAPI_CLIENT_ID`, `SPAPI_CLIENT_SECRET`, `SPAPI_APP_ID` | | Shared SP-API public application credentials and application ID; each client authorizes their own seller separately |
| `SPAPI_APP_DRAFT` | `false` | Set `true` for an Amazon application in draft status (`version=beta`) |
| `BASIRA_CREDENTIALS_KEY` | | 32 random bytes encoded as 64 hex characters, stored outside the data directory. Required to encrypt each client's Amazon and Salla tokens. Back up securely; losing or changing it makes stored connections unreadable |
| `SPAPI_ENDPOINT` | `https://sellingpartnerapi-eu.amazon.com` | SP-API endpoint (Saudi Arabia, UAE and Egypt use the EU one) |
| `PUBLIC_URL` | | The server's public HTTPS origin. Amazon OAuth requires it and the registered redirect URI `PUBLIC_URL/api/amazon/oauth/callback`; register `PUBLIC_URL/api/amazon/oauth/login` as the login URI. Hosted export image links also use it |
| `MOYASAR_SECRET_KEY` | | Moyasar secret key for online payments (Mada, cards, Apple Pay) |
| `MOYASAR_API` | `https://api.moyasar.com/v1` | Moyasar API base |
| `FAL_KEY` | | One fal.ai key for everything AI. Image models: text on slides → `FAL_TEXT_MODEL` (default `fal-ai/nano-banana-pro/edit`), scenes, people and on-model photos → `FAL_SCENE_MODEL` (default `openai/gpt-image-2.6/flare/edit`). Language model (text checks, product checks, competitor galleries, reviews, copy, Brand DNA) → Claude through fal's OpenRouter gateway, `FAL_LLM_MODEL` (default `anthropic/claude-opus-5.5`). A direct `ANTHROPIC_API_KEY`, `OPENAI_IMAGE_KEY` or `GEMINI_IMAGE_KEY` takes its part instead |
| `FAL_VIDEO_MODEL` | `fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video` | Video model on fal for gallery videos: MiniMax Hailuo 2.3 Fast, 768p, $0.19 for 6 s and $0.32 for 10 s. For 1080p: `fal-ai/minimax/hailuo-02/pro/image-to-video` ($0.08 a second). Kling (`fal-ai/kling-video/o3/standard/image-to-video`) and Veo 3.1 (`fal-ai/veo3.1/image-to-video`) also work |
| `OPENAI_IMAGE_KEY` | | OpenAI key for images (scenes, people, on-model photos). `OPENAI_IMAGE_MODEL` overrides the model (default `gpt-image-1`; set the newest you have, such as GPT Image 2.5) |
| `GEMINI_IMAGE_KEY` | | Gemini key for images (text on slides goes here first). `GEMINI_IMAGE_MODEL` overrides the model (default `gemini-3-pro-image-preview`) |
| `IMAGE_PROVIDER` | | One provider the older way: `openai`, `gemini` or `generic`, with `IMAGE_API_KEY`. Used alongside the two keys above. Generated slides also need `ANTHROPIC_API_KEY` for the checks |
| `IMAGE_API_KEY` | | Key for the image provider |
| `IMAGE_MODEL` | | Override the provider's model name (check it when the key arrives: these adapters have not been called live) |
| `IMAGE_API_URL` | | Endpoint for `generic` (`POST { prompt, negative_prompt, image, width, height, num_images }` → `{ images: [{ url } \| { b64_json }] }`); overrides the endpoint for the other two |

## Marketplace connectors

| Source | Product link | Whole store | How |
| --- | --- | --- | --- |
| Amazon (.sa, .ae, .eg) | Yes | Your own seller account | SP-API Catalog Items (English and Arabic locales) and Listings Items, including Amazon's own listing issues |
| Noon | Yes | Upload a Seller Lab export | The product page's schema.org data, plus its `-ar` twin for Arabic |
| Salla, Zid, a store on its own domain | Yes | Upload an export | The product page's schema.org data and its Arabic `hreflang` alternate. A store on its own domain is audited by Salla's rules |
| Any CSV | | Yes | Column names are matched automatically (`title_ar`, `bullet_1`, `main_image`…) |

Outbound requests are HTTPS only, block private addresses at every redirect, and have size and time limits. Main images are downloaded and measured to check size and white background.

Publishing back: Amazon listings use the seller account connected to the selected client workspace. Noon can be submitted through its Content API when configured; these live integrations still require validation. Export files are available for all channels and their templates should be checked against the current marketplace requirements.

Noon: `POST /api/publish/noon` creates or updates each product of an exported Noon batch through the Content API (titles, points and images in both languages), and `POST /api/noon/status` reads Noon's review back: each image accepted or rejected with the reason, completeness and QC per language, live or not. Written from Noon's documentation and tested against it, not yet called live (no Noon credentials).

What isn't covered yet: reading Noon store catalogs through the API, automatic review imports from Noon, Amazon AE/SA/EG or Zid, and direct publishing to Salla and Zid. Salla product reviews can be fetched with a merchant-authorized token as described below.

### Client connections and review collection

Register a public SP-API app in Amazon's Solution Provider Portal and configure its login URI as `PUBLIC_URL/api/amazon/oauth/login` and redirect URI as `PUBLIC_URL/api/amazon/oauth/callback`. Set `SPAPI_APP_ID`, `SPAPI_CLIENT_ID`, `SPAPI_CLIENT_SECRET`, `PUBLIC_URL`, and a persistent `BASIRA_CREDENTIALS_KEY` containing 64 hex characters (generate once with `openssl rand -hex 32`). Set `SPAPI_APP_DRAFT=true` only while the app is a draft. Configure the same HTTPS origin on the registered app. In Settings select the client workspace and marketplace, then connect that seller. The OAuth flow is tied to the signed-in session and workspace; seller tokens are encrypted with AES-256-GCM, excluded from workspace exports, and removed when the workspace is deleted. Disconnect removes Basira's local credentials; sellers should also revoke the app in Seller Central when appropriate. OAuth state is in memory, so restart or multiple server instances interrupt an in-flight authorization. The implementation is mock-tested; it has not been tested with a real approved Amazon application or seller account.

Salla reviews require a merchant-authorized Salla access token with the `reviews.read` scope. In Settings add the token for the selected workspace, then open Creator → Reviews and enter the numeric Salla product ID once. Basira fetches up to 200 reviews and remembers the product mapping; on later visits it fetches them again. The first fetch runs analysis if AI is configured; later automatic fetches do not incur an AI call until Analyse is selected. Tokens are encrypted per workspace but currently must be replaced manually on expiry. This is not scheduled background synchronization, and review history and imported catalog products are not persisted by this integration. API calls are mock-tested, not tested against a live Salla account.

Amazon's [Customer Feedback API](https://developer-docs.amazon/sp-api/lang-en_EN/reference/customer-feedback-v2024-06-01) provides aggregate topics and snippets in a limited set of marketplaces that does not include AE, SA or EG. It does not provide a general individual-review feed for those markets. Noon and Zid review API access requires separate confirmation. Do not interpret a missing review source as zero customer reviews.

## Language

The page is fully bilingual. English text lives in the markup; Arabic lives in the `AR` dictionary at the bottom of `src/landing.html`, keyed by each element's `data-i18n` attribute. Switching to Arabic sets `dir="rtl"` on the document, and the layout uses logical CSS properties so it mirrors correctly. Visitors whose browser language is Arabic get Arabic by default.

## Lead forms

The pilot form posts to `/api/leads` on the Basira server. For another host, define an endpoint before the page script runs:

```html
<script>window.BASIRA_LEAD_ENDPOINT = "https://your-backend.example/leads";</script>
```

The pilot form POSTs `{ name, whatsapp, store, lang }` as JSON. When the page is served by the Basira server it posts to `/api/leads` automatically.

## Placeholder content to review

- Prices (399 / 1,490 SAR) and plan limits
- All figures in the demo, catalog table, chart and agency report are labelled as sample or example data
- "Layali Fragrances" and "Oud Al Layl" are fictional

## The app

The primary workflow is **Catalog → Creator → Client portal → approved files**. Catalog issue links and old `#studio-<product>` links resolve to the same versioned Creator; product references, catalog identity and the issue instruction are passed in. More than one campaign for a product requires an explicit project choice. A demo product opens a photo-first draft and asks for a real reference. Existing legacy data and files are retained; browser-only legacy slide drafts are not automatically reinterpreted as revision history.

Creator has Studio, Projects, Templates, Models and Production. Upload/paste/drop a photo, review an editable suggested frame plan, choose languages and direct changes with AI instructions. Template examples show fictional source products and five illustrative frames (main/detail/EN/AR/lifestyle), explicitly not client work or a promise of matching output. They are built-in imagegen assets; prompts and paths are in `src/assets/README.md`. The template defines structure; each new generation uses the user's own source and brand direction.

Imported catalogs persist per client. Brand DNA guides content and audit; Score and Brand remain in Catalog. Models and try-on are per client. New image revisions preserve older files and exact agency/client decisions. Production does not auto-approve anything. Client batches provide comments, revision tasks, exact reapproval and client-approved file delivery. Image/model checks are review evidence, not a guarantee of text accuracy, product fidelity or marketplace acceptance.

The landing now describes this workflow and its actual credit rates. The pilot form posts to `/api/leads` on the Basira server (or `BASIRA_LEAD_ENDPOINT` on another host). It never reports success without a successful response. Store APIs and direct publishing remain separate from Creator's file delivery.

The former `/api/slides/generate`, `/api/imagegen/onmodel` and `/api/video/generate` generators no longer launch paid work: they direct callers to the versioned Creator (410 when configured, 503 when unavailable). Existing saved exports and the file-rendering fallback remain accessible. Free image checks, listing audit and text tools retain their existing endpoints.

### Production and credits (2026-11-11)

`POST /api/creator/production` supports `list`, `quote`, `start`, `cancel`, `retry`, `download`. Select 1–50 owned catalog products or explicit project IDs. Choose a saved set and EN/AR; the server computes a fingerprint, image variant count and exact Basira credit reservation. A changed plan must be quoted again. Shared no-text images count once; language variants count separately. Existing project revisions are preserved and only empty variants are queued. Model/try-on/video stages are explicitly excluded from bulk image quotes; choose a model and approve try-on separately before runway video.

Starting reserves the whole budget atomically, creates projects and a client batch, and saves `production.json` per workspace. A single-process worker saves item progress, continues without the browser and processes other client workspaces between frames. Files are kept as immutable Creator revisions. Imported external reference bytes are frozen into local assets on the first edit. Queued work survives server restarts. Recovery checks `generationId` on saved revisions before resuming: an interrupted paid call with no saved revision is marked failed for an explicit retry, never blindly repeated. Orphaned reservations are reconciled before the production server starts accepting requests.

Failed-only retry creates a linked batch with a fresh reservation for failed frames. Changed current revisions are rejected before generating. Cancellation stops queued frames; the active frame finishes, then unused credits are returned. The production ZIP includes only exact agency-approved generated revisions and is explicitly not a final client-approved delivery. Final approved-product delivery remains in Client portal. Files are never regenerated for a download. Production history participates in client export/deletion; deleting a client with active work is blocked until cancellation has finished.

Generation credits: trial 40/month, Seller 600/month, Agency 6,000/month, Enterprise 30,000/month. Image/edit/model = 4, try-on = 6, runway = 24. Basira credits are subscription product units, **not** USD provider estimates. Creator image/model/video calls reserve atomically with an operation ID; duplicate IDs cannot start another operation. No saved result means a credit refund; a saved candidate with QA warnings still consumes credits. Approvals, source uploads and downloads consume no generation credits. A monthly attempt ceiling of three times the plan's credit allowance pauses repeated unsuccessful attempts for support review; failed calls still refund customer credits. Legacy `fixes`, `renders` and `ai` counters remain for compatibility; new Creator gates on generation credits rather than fixes. Text AI endpoints keep their existing guards.

Limits: one server process, 100 production batches/client, up to 500 image variants per batch, 100 MB reviewed ZIP source bytes. There is no distributed worker/database, automatic approval, notification service or automatic marketplace acceptance. Paid live generations were not run for this implementation; workers and credit handling are exercised with mock models. Prices remain 399/1,490 SAR before applicable tax; configured hosted checkout supplies the final payment amount.

### Catalog batches (2026-11-10)

Imported catalog products now persist in each client's `catalog.json` and are included in workspace data export/deletion. Reimporting the same SKU and channel updates the existing entry with a stable ID. CSV exports preserve the supported EN/AR bullet fields, image URLs, attributes JSON and source channel; formula-leading cells receive an apostrophe for spreadsheet safety. Export is a Basira catalog file, not a guaranteed platform bulk-upload template. CSV is supported; XLSX and local media-folder matching are not implemented.

Select imported products in Catalog to prepare Creator projects without paid generation, prepare client reviews from each project's latest frozen approved release, or download a combined media ZIP. The media ZIP requires client approval of every exact revision in each selected release; it never regenerates files. Batch source files are limited to 100 MB. Mixed-channel products with the same SKU require manual destination review when a Creator project already exists. Batch operations report per-product failures; there is no durable background queue yet. Product source facts must be confirmed in Creator before generation.

### Client batches and revision tasks (2026-11-10)

Catalog → **Create client batch** prepares projects and a persistent batch; Creator → **Client batches** also groups existing projects. Batches and tasks live inside the client's `portal.json`, so they survive reloads and participate in client data export/deletion. The client portal now groups current product versions by batch and displays a frame strip, per-product readiness, previous/current imagery and public agency replies. Old reviews remain as history; superseded versions cannot receive current decisions through an old link.

A client **Ask for changes** decision automatically creates an idempotent task containing the original comment, pins, language and exact source revision. Video comments can include a timestamp. The agency assigns a display name and due date, opens the task in Creator, prepares and agency-approves a new descendant revision, then submits it for client review. Assignments are descriptive fields, not additional access-control roles. A task becomes accepted when the client approves its candidate; a new rejection reopens it. Image and video creation continue to use existing providers; this change does not add frame-accurate video editing.

Sending a new release preserves client approval only for unchanged exact revision IDs; a new revision always starts pending. Task submission currently requires a complete agency-approved project release. Missing-information requests have their own answer/acceptance workflow and block delivery until the agency accepts the answer. Batch approval validates selected revision IDs and review states before applying any decisions; configured legal approval rules remain in effect. Ready-product ZIP downloads include only current client-approved frozen releases and never regenerate content. Other products can stay in progress.

The build also writes `portal.html` and `dist/portal.html` from `src/portal.html` with the room script inlined. The server serves this built portal. Limits: 100 batches and 2000 tasks per client, 200 products per batch, 100 MB source files per download. Updates are request-driven with explicit refresh; no email/WhatsApp notifications or background reminders are sent by the new batch workflow.

### Creator studio workflow (2026-11-10)

Creator now starts with a photo, an optional owned catalog product or a template, a creative task and a brief. Studio drafts do not require a SKU. Multiple projects may share the same catalog product/SKU (for example, listing images and a Ramadan campaign); existing projects and revision/release history are preserved. Starting saves a project and reference media without running a paid generation. Presets guide composition; they do not certify marketplace acceptance. Catalog facts remain to be confirmed before they are used in creative claims.

The canvas shows the original reference immediately. AI instructions and frames are primary; factual context, review tools and history remain available in expandable panels. **Prepare for placement** separately links the catalog product, selects a destination and checks selected frames, client decisions and the current release. Exported files are source assets. Direct studio publication, destination-specific attribute editing and dynamic marketplace schema validation are not yet connected; the response explicitly reports publication as unavailable/not_sent.

Client batches live in Client portal, with legacy portal settings below. Creator's primary tabs are Studio, Projects, Listing Sets, Models and Production. Catalog batch actions refuse ambiguous SKUs when several creative projects exist; choose explicit project IDs in a named batch rather than letting the system guess.

Validation for 2026-11-11: 187 automated tests pass. Browser review covered catalog issue → new Creator, selecting template examples, source upload → suggested plan → saved project → quantity/budget, simulated queue start/reload/failed-only retry, and mobile RTL without horizontal overflow. Paid-provider calls were not used for validation. Template illustrations were generated separately with the built-in imagegen tool.


### Visual Creative Director (2026-11-11)

Creator starts with a visual photo-first invitation and an optional free-canvas escape. After a source photo or owned catalog image, the guide proposes a four-frame listing story without requiring a prompt. Users can change the goal (listing, vertical social story, one creative), choose Brand DNA / daylight / studio lighting, include/remove/reorder frames and select EN/AR. Composition sketches use the original photo and are explicitly not generated results. Suggested plans are deterministic; product type is selected by the user or comes from the owned catalog, not inferred by a hidden AI call.

The no-template listing defaults to main + benefit + details + shared lifestyle: 4 frames, 6 EN/AR image variants, 24 credits. A neutral introduction replaces unsupported benefit claims. Optional sizing frames require confirmed facts; facts are never inferred from the photo. User-supplied facts require confirmation and are saved in the project and subsequent revision snapshots. Extra instructions are optional, capped at 2,500 characters so the assembled prompt stays within generation limits. Source/client changes clear unconfirmed product details; drafts remain client scoped.

`POST /api/creator/studio` now accepts `action:preview` plus `{direction:{goal,look,category,frames,facts,factsConfirmed},templateId?,language,brief?}`. The server validates owned templates and the selected frame keys, builds the actual slots/brief and returns image quantity, credit budget and availability. Preview creates no project/media/reservation and never runs a model. Users can return to adjust the story without accumulating drafts. Only **Create my collection** saves the project, re-quotes its exact image count and starts the existing durable production queue after explicit confirmation. Network retries reuse the production request ID. **Save the plan** creates a draft without generating. Lighting, purpose, roles, confirmed facts and the composed brief persist in the project; these choices affect generation prompts and layout, not just the UI.

Model/video template stages remain explicit separate reviewed steps and are excluded from image budgets. Free canvas and existing saved-project editing remain available. Validation: 193 automated tests plus a browser pass for no-prompt setup, frame order, language counts, facts gating, zero-draft preview/back navigation, simulated production confirmation, mobile RTL and free-canvas return. No paid-provider calls were used for validation.

Free canvas: the optional content plan lives behind a compact **Content plan** button in the top toolbar. It starts closed, never opens after a photo upload, and can be dismissed with its close button, Escape or a click outside. Opening it does not resize the source photo or occupy the center of the canvas.
