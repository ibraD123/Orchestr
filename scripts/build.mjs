// Builds the pages:
//   dist/<page>.html  page fragment with shared code inlined (what gets published as an artifact)
//   <root>.html       full HTML document for any static host or the Basira server
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// Shared modules (audit, templates, CSV import, keywords) run on the server and inline in the app.
// Each module runs in its own scope; only its exports become names in the page script.
const inline = (p, n) => {
  const src = read(p);
  const names = [...src.matchAll(/^export (?:const|let|function|async function|class) (\w+)/gm)].map((m) => m[1]);
  const v = `__shared${n}`;
  return `var ${v} = (function(){\n${src.replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };\n})();\nvar ${names.map((x) => `${x} = ${v}.${x}`).join(", ")};`;
};
const shared = ["server/audit.mjs", "server/templates.mjs", "server/catalog-csv.mjs", "server/keywords.mjs", "server/economics.mjs", "server/photo-metrics.mjs"].map((p, i) => inline(p, i)).join("\n");

const pages = { "landing.html": "index.html", "app.html": "app.html" };
mkdirSync(new URL("dist/", root), { recursive: true });
for (const [src, out] of Object.entries(pages)) {
  const body = read(`src/${src}`).replace("/*@AUDIT_ENGINE@*/", () => shared);
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
