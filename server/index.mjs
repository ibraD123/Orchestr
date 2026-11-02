// Basira HTTP server: serves the site and app, plus the JSON/PNG API.
import { createServer } from "node:http";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";
import { auditListing } from "./audit.mjs";
import { renderSlide, rendererAvailable } from "./render.mjs";
import { analyseReviews, aiConfigured, MODEL } from "./reviews.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = process.env.BASIRA_DATA_DIR || join(ROOT, "data");
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 15 * 1024 * 1024;
const STATIC = { "/": "index.html", "/index.html": "index.html", "/app": "app.html", "/app.html": "app.html" };
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json" };

function send(res, status, body, type = "application/json") {
  const data = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(data);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) { const e = new Error("Request body is too large"); e.status = 413; throw e; }
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { const e = new Error("Body must be JSON"); e.status = 400; throw e; }
}

const routes = {
  "GET /api/health": async () => ({ ok: true, render: await rendererAvailable(), ai: aiConfigured(), model: aiConfigured() ? MODEL : null }),
  "POST /api/audit": async (body) => auditListing(body.listing || body),
  "POST /api/reviews/analyze": async (body) => analyseReviews(body),
  "POST /api/leads": async (body) => {
    const lead = {
      name: String(body.name || "").slice(0, 120), whatsapp: String(body.whatsapp || "").slice(0, 40),
      store: String(body.store || "").slice(0, 300), lang: body.lang === "ar" ? "ar" : "en", at: new Date().toISOString()
    };
    if (!lead.name || !lead.whatsapp || !lead.store) { const e = new Error("name, whatsapp and store are required"); e.status = 400; throw e; }
    await mkdir(DATA, { recursive: true });
    await appendFile(join(DATA, "leads.jsonl"), JSON.stringify(lead) + "\n");
    return { ok: true };
  }
};

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "POST" && url.pathname === "/api/render") {
      const png = await renderSlide(await readJson(req));
      return send(res, 200, png, "image/png");
    }
    const handler = routes[`${req.method} ${url.pathname}`];
    if (handler) return send(res, 200, await handler(req.method === "POST" ? await readJson(req) : {}));
    if (req.method === "GET" && STATIC[url.pathname]) {
      const file = normalize(join(ROOT, STATIC[url.pathname]));
      return send(res, 200, await readFile(file), TYPES[extname(file)] || "application/octet-stream");
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    send(res, status, { error: status >= 500 && !err.status ? "Something went wrong on the server" : err.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`Basira running at http://localhost:${PORT}  (app: /app)`));
}
