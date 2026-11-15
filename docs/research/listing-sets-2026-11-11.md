# Listing Sets: workflow and destination guidance

Implemented 2026-11-11. Reference interaction studied read-only in Damu/Fashley `src/pages/CardAlgorithm.jsx`: category → image sequence → frame-specific facts → generation → refinement. Basira uses its own UI, project storage and production queue. No reference backend, credentials or customer data were copied.

## Workflow

The job: **turn a real product reference into a coherent, reviewable product-page gallery without writing a prompt**.

1. Pick Amazon.ae, noon, Salla or Zid and one of eight product categories.
2. Upload a photo or link an owned catalog product; SKU is optional.
3. Shape the sequence, visual direction, gallery format and language versions. Main stays first and clean. Each frame explains its buyer question.
4. Supply at most two confirmed facts per frame. Dimensions, sizing, usage and contents require data assigned to that particular frame. Other frames can remain neutral visuals. Cosmetic results, certifications and unseen details are not inferred from a photo.
5. Preview the server-validated image count and credits for free. Save a project or explicitly confirm production. The existing durable queue handles reservations, revisions, progress and retries.
6. Refine in Creator, agency-review exact versions and send a frozen release through the existing client portal. Final client-approved delivery uses the existing workflow.

Agency templates supply generic layout/style only; destination main rules override their main styling. Model/video stages remain in their separate reviewed workflow. “Use for another product” copies plan choices and clears photo, SKU link, name, extra direction and facts. Generated media and approvals are never copied.

## Official sources and interpretation

Source links and review date appear in the builder. Profiles guide composition; they do not certify acceptance.

- [Amazon.ae image requirements](https://sellercentral.amazon.ae/help/hub/reference/external/G1881). Regional help required seller login during this research. The [official UAE Hardlines & Consumables guide](https://m.media-amazon.com/images/G/39/help/HardlinesConsumables_Styleguide_EN_AE._CB1198675309_.pdf) corroborates a clean white main image, but dates from December 2018. The [current general Amazon image guide](https://sellercentral.amazon.com/gp/help/external/G1881?language=en_US) explicitly covers the US: it supports the main/gallery baseline, not an assertion that all US category rules apply to UAE. Basira uses conservative white main imagery without added copy/graphics/props; category exceptions require seller review.
- [noon SKU image requirements](https://helpcenter.noon.partners/en/category/product-listing/image-requirements-and-rejection-reasons-for-the-seller-sku). Main: full front view on white; light grey recommended for fashion. Lifestyle belongs in additional images. The source specifies JPEG and technical limits, rejects unwanted text, and also discusses added text; it does not give blanket permission for elaborate infographics. Basira defaults to photo-only galleries; fact captions require an explicit choice and category-QC review. Square format is a Basira preset, not a universal noon mandate.
- [Salla product photos and video](https://help.salla.sa/article/إضافة-صور-وفيديوهات-المنتج/o67hdm4qs3h30gubvyfk7v9y). Documents main-photo selection and image ordering. Basira offers square or portrait composition as an editorial choice and asks users to check the theme’s mobile crop.
- [Zid product details](https://helpdesk.zid.sa/ar/products/product-details), [product variants](https://helpdesk.zid.sa/ar/products/variants). Document image management and ordering. Basira offers an own-store profile with theme-dependent cropping; no platform-wide promotional-image permission or fixed aspect is asserted.

## Practical limits

EN and AR are alternative gallery assets, not a promise that marketplaces expose independently localized galleries. Illustrations are labeled AI examples. After upload, the browser shows layout sketches using the original photo, not fake generated results. Main images are shared with no overlay. Chosen aspects drive actual generation requests.

Delivery currently packages reviewed source files. It does not convert every provider output into an upload-ready JPEG, certify dimensions/file size, submit a listing, guarantee display or add A+ modules. Category checks, formatting and publication are separate. AI images and Arabic/product checks still need human review.

## Verification

199 tests passed: category plans, destination prompts/ratios, language/shared-photo counts, frame-scoped facts, invalid plans, owned templates/projects, reload, free preview and exact agreement with production quotes. Browser checks cover upload, facts, preview/back, saved-project handoff, clean reuse and EN/AR mobile layouts. Test data is isolated; paid providers were not called.
