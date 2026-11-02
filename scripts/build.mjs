// Builds the pages:
//   dist/<page>.html  page fragment with shared code inlined (what gets published as an artifact)
//   <root>.html       full HTML document for any static host or the Basira server
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// The audit engine is shared with the server; strip ESM exports so it runs inline.
const auditEngine = read("server/audit.mjs").replace(/^export /gm, "");

const pages = { "landing.html": "index.html", "app.html": "app.html" };
mkdirSync(new URL("dist/", root), { recursive: true });
for (const [src, out] of Object.entries(pages)) {
  const body = read(`src/${src}`).replace("/*@AUDIT_ENGINE@*/", () => auditEngine);
  writeFileSync(new URL(`dist/${src}`, root), body);
  writeFileSync(new URL(out, root), `<!doctype html>
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
  console.log(`Built ${out} and dist/${src}`);
}
