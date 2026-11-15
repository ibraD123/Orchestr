# Home and Catalog workflows · 2026-11-14

Home (`/app#overview`) replaces Dashboard as the start/continue page. Creator remains the working studio.

## Entry and scope

- Add PNG/JPEG/WebP or select an imported product owned by the active client. The optional instruction and original source enter the chosen workflow.
- Listing Sets receives product/category/destination, the reference and the instruction. Free editing receives the reference and optional Catalog binding. Try-on/runway retains the existing model selection and approved-try-on requirement.
- Intake state belongs to the account/client and clears when either changes. Upload and asynchronous navigation recheck that scope before applying results.
- Opening a scenario never starts AI review, saves a generated asset or reserves generation credits.

## Catalog actions

- **Review selected products:** one product opens its audit; multiple products open a free list of their checks and links. Full AI image reading remains a separately labelled action.
- **Prepare this repair:** an existing specific audit finding opens Creator with its task/source and the focused repair flow.
- **Create content for selected:** opens Creator Production and quotes the actual selected owned products. User chooses the set/languages, sees variants and credit reservation, then explicitly starts production.
- The former Catalog selection → Prepare fixes → legacy Bulk actions path is removed. Other legacy tools and previous work remain accessible.

## Photo-only review

`POST /api/home/photo-audit` validates client access, supported inline image bytes and known destination/category, then checks configuration and the existing AI allowance. It calls the image reader only on explicit review. Only findings for image index 0 are returned; listing-copy findings and non-image evidence are removed. It neither creates a SKU nor infers missing full-gallery/title/bullet data. Confirmed facts are still required where applicable before generating a repair.

## Continuing client work

Home derives attention rows from saved collaboration and agency operations: answered requests awaiting agency review, open edit tasks, stale selected facts, accepted unstarted proposals and direction decisions. Completed tasks are excluded and repeated projects/tasks are de-duplicated. Actions open the exact project/frame, request impact, proposal or direction form. Partial loading errors remain visible; empty data is not replaced with sample activity. Recent projects, batches and compact counts use the same saved workspace data.

## Verification and limits

238 automated tests passed. Added coverage includes source/brief transfer, account/client changes during async work, owned Catalog selection, explicit photo-only review, actionable task derivation, provider availability, allowance gating and image-evidence filtering. Isolated browser QA covered source upload, free editing, Listing Sets, the two-product production quote, typed client response impact, video entry, persistent banner collapse, English and mobile Arabic RTL without page overflow. No paid review/generation, marketplace API changes or external publication were performed. Provider output quality and marketplace acceptance still require their separate live checks.
