// Wraps each page fragment in src/ into a full HTML document at the repo root.
import { readFileSync, writeFileSync } from "node:fs";

const pages = { "landing.html": "index.html", "app.html": "app.html" };
for (const [src, out] of Object.entries(pages)) {
  const body = readFileSync(new URL(`../src/${src}`, import.meta.url), "utf8");
  writeFileSync(new URL(`../${out}`, import.meta.url), `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`);
  console.log(`Built ${out}`);
}
