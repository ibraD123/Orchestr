// Builds the pages:
//   dist/<page>.html  page fragment with shared code inlined (what gets published as an artifact)
//   <root>.html       full HTML document for any static host or the Basira server
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// Shared modules (audit, templates, CSV import, keywords, Brand DNA, copy rules, results, plans,
// export files, ZIP, report) run on the server and inline in the app.
// Each module runs in its own scope; only its exports become names in the page script.
const inline = (p, n) => {
  // Shared modules import each other only by relative path; inline, those names are already in scope.
  const src = read(p).replace(/^import .* from "\.\/[\w-]+\.mjs";$/gm, "");
  const names = [...src.matchAll(/^export (?:const|let|function|async function|class) (\w+)/gm)].map((m) => m[1]);
  const v = `__shared${n}`;
  return `var ${v} = (function(){\n${src.replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };\n})();\nvar ${names.map((x) => `${x} = ${v}.${x}`).join(", ")};`;
};
const shared = ["server/home-workflow.mjs", "server/audit.mjs", "server/audit-repairs.mjs", "server/templates.mjs", "server/textcheck.mjs", "server/catalog-csv.mjs", "server/keywords.mjs", "server/photo-metrics.mjs", "server/creator.mjs", "server/listing-frame-data.mjs", "server/content-plan.mjs", "server/creative-direction.mjs", "server/listing-sets.mjs", "server/brand-dna.mjs", "server/brand-seed.mjs", "server/copy-rules.mjs", "server/results.mjs", "server/billing.mjs", "server/exports.mjs", "server/zip.mjs", "server/report.mjs"].map((p, i) => inline(p, i)).join("\n");

const pages = { "landing.html": "index.html", "app.html": "app.html" };
mkdirSync(new URL("dist/", root), { recursive: true });
for (const [src, out] of Object.entries(pages)) {
  const body = read(`src/${src}`).replace("/*@AUDIT_ENGINE@*/", () => shared)
    .replace("/*@CREATOR_WORKSPACE@*/", () => read("src/creator-workspace.js") + "\n" + read("src/catalog-workflow.js") + "\n" + read("src/agency-room.js") + "\n" + read("src/workspace-design.js") + "\n" + read("src/creative-studio.js") + "\n" + read("src/canvas-studio.js") + "\n" + read("src/production-studio.js") + "\n" + read("src/director-guide.js") + "\n" + read("src/listing-sets.js") + "\n" + read("src/listing-patterns.js") + "\n" + read("src/listing-sequences.js") + "\n" + read("src/catalog-repairs.js") + "\n" + read("src/agency-operations.js") + "\n" + read("src/home-workspace.js") + "\n" + read("src/model-studio.js"))
    .replace("/*@CREATOR_STYLES@*/", () => read("src/creator-workspace.css"))
    .replace("/*@WORKSPACE_DESIGN@*/", () => read("src/workspace-design.css") + "\n" + read("src/listing-sets.css") + "\n" + read("src/listing-patterns.css") + "\n" + read("src/listing-sequences.css") + "\n" + read("src/catalog-repairs.css") + "\n" + read("src/agency-operations.css") + "\n" + read("src/home-workspace.css") + "\n" + read("src/model-studio.css"));
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

const portal = read("src/portal.html").replace("/*@PORTAL_ROOM@*/", () => read("src/portal-room.js")+"\n"+read("src/portal-operations.js")).replace("</style>",()=>read("src/portal-operations.css")+"\n</style>");
writeFileSync(new URL("portal.html", root), portal);
writeFileSync(new URL("dist/portal.html", root), portal);

mkdirSync(new URL("dist/assets/", root), { recursive: true });
copyFileSync(new URL("src/assets/content-sets.png", root), new URL("dist/assets/content-sets.png", root));
copyFileSync(new URL("src/assets/content-set-frames.png", root), new URL("dist/assets/content-set-frames.png", root));

mkdirSync(new URL("dist/assets/home/", root), { recursive: true });
copyFileSync(new URL("src/assets/home/model-example.webp", root), new URL("dist/assets/home/model-example.webp", root));
mkdirSync(new URL("dist/assets/models/", root), { recursive: true });
for (const f of readdirSync(new URL("src/assets/models/", root))) copyFileSync(new URL(`src/assets/models/${f}`, root), new URL(`dist/assets/models/${f}`, root));
