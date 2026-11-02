// Wraps src/landing.html (a page fragment) into a full HTML document at index.html.
import { readFileSync, writeFileSync } from "node:fs";

const body = readFileSync(new URL("../src/landing.html", import.meta.url), "utf8");
const page = `<!doctype html>
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
`;
writeFileSync(new URL("../index.html", import.meta.url), page);
console.log("Built index.html");
