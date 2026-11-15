# Catalog audit → repair → exact-version recheck

Implemented 2026-11-13. Seller-facing job: find a concrete problem, explain its evidence and buyer consequence, offer a replacement, prepare it and inspect the resulting version.

## What the seller sees

Open a Catalog product to see an ordered repair plan: supplied-data errors, conflicting information, presentation improvements, then unanswered buying questions. Three findings are prominent; the rest expand. Every card has its basis, evidence/field or image number, reason, proposed change, required data and action.

The initial plan checks supplied catalog data without an AI call. Category suggestions explicitly ask the seller to check whether existing gallery images already answer the question. They are not presented as observed missing images. **AI review gallery & text** reads up to six catalog images and supplied text on demand. Failed images, reviewed indices and total/partial coverage are persisted and shown. AI observations remain marked for verification; no fabricated review statistics or predicted conversion rates are used.

Catalog selection supports sequential AI review of up to 20 selected products. Image reviews use the existing text-AI guard/meter, independently of image-generation credits. Imported catalogs and production remain compatible.

## Repairs

- A photo finding opens Listing Sets in a focused repair context carrying owned catalog/SKU, destination, finding, rationale and source. Main stays in the internal plan structure but only the target frame is created and quoted. The seller can supply a new real reference, confirm facts and save a draft or review the generation budget. No generation occurs when opening or saving.
- Dimensions distinguish exterior, interior and opening measurements. Units and user-confirmed values reach the saved slot and actual generation prompt. An unseen interior is not inferred from exterior dimensions; upload real evidence when needed.
- Repeated identical saves reuse the repair draft. A changed plan/reference creates a separate draft, preserving earlier revisions.
- Text findings open a reviewable replacement form. AI findings can include bounded replacement titles/bullets; an explicit AI wording action can propose text. Saving requires confirmation and keeps the previous changed fields in catalog repair history. It changes Basira's catalog, never publishes to a marketplace.
- Existing paid production handles image generation, credit reservations, progress and retries. Existing agency/client approvals and delivery remain exact-version operations.

## Recheck and states

The handoff records finding ID, source fingerprint, project and slot. Creator can recheck the exact selected raster revision against the original finding and confirmed repair facts. Results are `needs_review` or `no_issue_observed`, with the exact revision ID, language and time. Selecting a different revision makes an earlier check visibly inapplicable. A candidate check never declares the source catalog/live listing fixed or grants agency/client approval.

Changing imported listing data invalidates its previous AI report. Draft/preview/copy/recheck requests reject stale source fingerprints. Image findings cannot silently move to another image when loading fails. Catalog and project access are constrained to the authenticated account/client. External images use the existing bounded HTTPS fetcher with private-network protection; rechecks read owned assets via the account/client asset prefix.

## Scope and limits

AI findings and replacement copy require human review. Catalog attributes are supplied data, not verified truth. Automatic export formatting, marketplace acceptance/publication and measured commercial outcomes remain separate. Unsupported certainty is not added to audit scores. Existing legacy standalone Audit remains a rule-based scratchpad; the saved Catalog product page is the complete repair workflow.

Tests mock models and image loading. They cover persisted evidence/coverage, ownership, stale snapshots, one-frame budgets, confirmed structured facts, source selection/custom reference, idempotent draft saves, local copy history, role coverage and exact selected-version rechecks. Browser checks use isolated local data, without paid model calls.
