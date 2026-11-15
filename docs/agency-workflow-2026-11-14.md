# Agency workflow additions · 14 November 2026

Four existing workflows are connected rather than duplicated in a new app.

## 1. Specific product-data requests

Creator → **Ask client for product data** selects a structured slot field (dimensions, volume, contents, compatibility, usage, ingredients, size rows) or a general question. A field request captures its slot, key, type and unit. The existing private client portal shows the question and unit. Numeric input accepts Arabic/Persian digits; a contradictory unit is rejected rather than silently converted. Array/table answers use lines or complete JSON rows as indicated. The response is immutable after submission; a correction requires another request.

The agency chooses **Review value & affected content**. A free impact preview normalizes the proposed value, shows linked variants, and requires the agency to confirm the source fact before changing plans. The original question/answer, timestamp, fact event ID and prior value remain traceable. Accepting a field answer does not generate an image, publish a listing or spend credits. If no batch contains the project, an information batch is created so the question is visible in the portal.

## 2. Direction approval before a batch

Client workspace → **Choose an approval sample** selects 1–3 exact, owned, agency-approved image revisions from that batch and describes the direction. The client approves or requests changes in the portal. Each submission is a new version; earlier direction decisions remain in history. Notes, image revisions, style, layout and aspect are captured.

Once this stage is enabled for a batch, automated production of its projects waits for a valid client approval. Quotes and queued work bind to the direction version; a pending/replaced direction stops queued work before a model call and unused reservation is refunded. An individual Creator edit remains available to prepare the sample itself. Approved images are passed to the image adapter as **style references**, with instructions not to copy their products, measurements or claims. Changing facts used by the sample, or its visual structure, requires a new direction approval.

## 3. Audit → agency service proposal → accepted work

A saved Catalog product (or selected products) → **Build service proposal from audit** creates an editable draft from supplied-data checks and the current saved AI findings. Category recommendations remain recommendations. No AI call is needed to assemble it. The agency chooses services, sets prices and currency (AED/SAR/USD), adds scope/delivery/tax notes, reviews the total and makes it available in the client portal. These prices are separate from Basira generation credits; this is not a payment processor or tax engine.

The client selects service lines, sees their total and confirms that exact proposal version. Sent/accepted scope is frozen; further commercial changes need another proposal. **Prepare accepted scope** creates only accepted service projects and a delivery batch, idempotently. It does not start paid generation. Confirmed known facts are inherited where valid; missing product facts and reference images must be supplied before production. Text-only services remain catalog-copy work and are excluded from image charges. If the catalog source changed since the offer, execution requires a current proposal.

## 4. One confirmed fact → impacted content

Catalog → **Product facts & affected content**, or Creator → **Product facts & changes** opens the product's field ledger. The group is the exact `catalogProductId` within the client workspace; projects without a catalog link have their own group. The system does not merge unrelated products just because their SKUs or names resemble each other.

Structured frame data and frame-specific confirmed fact lines are indexed. A free preview shows old/new values, affected projects, selected revisions, languages, agency approval and the image-update budget. A confirmed change updates linked plans, structured slot data, listing-set metadata and generation facts; it preserves original bytes, selections and approval history. The operator chooses which affected variants to produce next. Production uses the existing queue, exact quantity quote, credit reserve/refund, agency review and client reapproval. Models/video are marked as separate manual stages.

New revisions store a snapshot of their frame's supplied facts. A fact changed during an in-flight call leaves the saved candidate marked outdated rather than pretending it used the new value. Outdated revisions cannot be newly approved, released, sent as current, or included in current approved ZIP delivery. Already-approved obsolete files are separated from the current client library; their history remains.

### Coverage and limits

- Dependencies describe **supplied data**, not verified OCR of the rendered pixels. Outputs still require visual/factual review.
- Earlier generators received project-wide facts. Legacy revisions are conservatively marked as potentially affected across the project when one of those facts changes; the UI labels this uncertainty.
- Unstructured prose, manually written numbers and previously uploaded images cannot be semantically mapped with certainty. The system does not silently replace numbers inside arbitrary text or infer dimensions from a photograph.
- Source catalog text, original product packaging and marketplace publication are not automatically rewritten by a fact event. A physical packaging/variant change needs a true new product reference. Existing marketplace APIs remain separate.
- Changes across different catalog product IDs require explicit product linking; no fuzzy cross-channel identity matching is claimed.
- Existing file-backed stores and production remain single-process. No external messages or paid model calls are sent by these review/setup steps.

## Implementation

`fact-links.mjs` (field extraction, source snapshots, validation, conservative legacy coverage); `creator-projects.mjs` (ledger, impact/commit, immutable history, stale checks); `agency-direction.mjs` (approval gates); `agency-operations.mjs` (offers/directions/client actions); existing collaboration/production/image adapter; `agency-operations.js/css` and `portal-operations.js/css` (EN/AR interfaces).

Agency API: `POST /api/agency` actions `facts`, `fact_preview`, `fact_apply`, `fact_updates`, `data_preview`, `direction_submit`, `offer_prepare`, `offer_save`, `offer_send`, `offer_execute`, `list`. Client actions use the existing workspace-scoped capability URL: `POST /api/c/:token/agency` (`direction_decide`, `offer_accept`). Field requests/answers use the existing collaboration API. All mutation previews carry expected fingerprints or versions; fact events, accepted scope execution and production request IDs prevent accidental repetition.

## Verification

230 tests passed in the full suite; targeted agency tests also cover exact field acceptance, scope/version conflicts, legacy usage, a fact changing during generation, and a direction changing while a job is queued. Browser verification used isolated test data for direction approval → typed Arabic reply → agency impact acceptance → proposal selection → accepted batch, plus EN/AR and mobile width. Owned `.jpeg` references now have a regression test for their HTTP route. No paid model calls, external messages, payments or marketplace writes were made. Main local server uses the existing data directory; QA fixtures live under `/private/tmp`.
