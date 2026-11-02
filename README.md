# Basira · بصيرة

**AI product content intelligence for MENA e-commerce.**

Basira finds what is costing a listing sales, learns from what buyers write in reviews (Gulf, Egyptian, Levantine Arabic, MSA and English), fixes the content on brand in Arabic and English, publishes the fix to Amazon, Noon, Salla, Zid and Shopify, and measures the result.

This repository currently holds the marketing site.

## Structure

| Path | What it is |
| --- | --- |
| `src/landing.html` | The landing page source (styles, markup, Arabic translations and scripts in one file) |
| `scripts/build.mjs` | Wraps the source into a full HTML document |
| `index.html` | Built page, ready for any static host (GitHub Pages, Vercel, Netlify) |

## Build and preview

```bash
node scripts/build.mjs
```

```bash
npx serve .
```

## Language

The page is fully bilingual. English text lives in the markup; Arabic lives in the `AR` dictionary at the bottom of `src/landing.html`, keyed by each element's `data-i18n` attribute. Switching to Arabic sets `dir="rtl"` on the document, and the layout uses logical CSS properties so it mirrors correctly. Visitors whose browser language is Arabic get Arabic by default.

## Lead forms

Both forms work in the browser but do not send data anywhere yet. To collect leads, define an endpoint before the page script runs:

```html
<script>window.BASIRA_LEAD_ENDPOINT = "https://your-backend.example/leads";</script>
```

The final form then POSTs `{ name, whatsapp, store, lang }` as JSON.

## Placeholder content to review

- Prices (399 / 1,490 SAR) and plan limits
- All figures in the demo, catalog table, chart and agency report are labelled as sample or example data
- "Layali Fragrances" and "Oud Al Layl" are fictional
