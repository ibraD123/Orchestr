// Theme lab: a proxy over the running Basira server that adds the theme switcher to every HTML page.
// Touches no project files. Run: TARGET=http://localhost:8788 PORT=8799 node tmp/theme-lab/server.mjs
import http from "node:http";
import { readFileSync } from "node:fs";

const TARGET = new URL(process.env.TARGET || "http://localhost:8788");
const PORT = Number(process.env.PORT || 8799);
const LAB = new URL("./lab.js", import.meta.url);

http.createServer((req, res) => {
  if (req.url.startsWith("/__lab/lab.js")) {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    return res.end(readFileSync(LAB));
  }
  const headers = { ...req.headers, host: TARGET.host };
  delete headers["accept-encoding"];
  const up = http.request({ hostname: TARGET.hostname, port: TARGET.port, path: req.url, method: req.method, headers }, (r) => {
    const type = r.headers["content-type"] || "";
    if (!type.includes("text/html")) { res.writeHead(r.statusCode, r.headers); return r.pipe(res); }
    const chunks = [];
    r.on("data", (c) => chunks.push(c));
    r.on("end", () => {
      let html = Buffer.concat(chunks).toString("utf8");
      const tag = '<script src="/__lab/lab.js"></script>';
      html = html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, tag + "</body>") : html + tag;
      const h = { ...r.headers };
      delete h["content-length"];
      delete h["content-security-policy"];
      res.writeHead(r.statusCode, h);
      res.end(html);
    });
  });
  up.on("error", (e) => { res.writeHead(502); res.end("Theme lab: Basira server is not reachable at " + TARGET + " (" + e.message + ")"); });
  req.pipe(up);
}).listen(PORT, () => console.log(`Theme lab on http://localhost:${PORT} -> ${TARGET}`));
