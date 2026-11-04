// File-backed store: one folder per client workspace with its Brand DNA genome and event log.
// Writes are atomic (temp file + rename). Built for one server process; swap for a database
// when several instances run.
import { mkdir, readFile, writeFile, appendFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { sampleData } from "./brand-seed.mjs";
import { newGenome } from "./brand-dna.mjs";

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export class StoreError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

export function createStore(dir) {
  const wsFile = join(dir, "workspaces.json");
  const wsDir = (id) => {
    if (!ID.test(id)) throw new StoreError("Unknown workspace", 404);
    return join(dir, "ws", id);
  };
  async function readJson(file, fallback) {
    try { return JSON.parse(await readFile(file, "utf8")); } catch (e) { if (e.code === "ENOENT") return fallback; throw e; }
  }
  async function writeJson(file, data) {
    await mkdir(join(file, ".."), { recursive: true });
    const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, file);
  }

  /** First run: write the two sample client workspaces so the demo has a brand that has already learned something. */
  async function ensureSeeded() {
    const list = await readJson(wsFile, null);
    if (list) return list;
    const d = sampleData();
    for (const w of d.workspaces) {
      await writeJson(join(wsDir(w.id), "genome.json"), d.genomes[w.id]);
      if (d.events[w.id].length) await writeFile(join(wsDir(w.id), "events.jsonl"), d.events[w.id].map((e) => JSON.stringify(e)).join("\n") + "\n");
    }
    await writeJson(wsFile, d.workspaces);
    return d.workspaces;
  }

  return {
    async listWorkspaces() { return ensureSeeded(); },

    async createWorkspace({ name, nameAr }) {
      const clean = String(name || "").trim().slice(0, 80);
      if (!clean) throw new StoreError("Give the client a name");
      const list = await ensureSeeded();
      let id = clean.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "client";
      while (list.some((w) => w.id === id)) id = id.replace(/-\d+$/, "") + "-" + Math.floor(Math.random() * 900 + 100);
      const ws = { id, name: clean, nameAr: String(nameAr || "").trim().slice(0, 80) };
      await writeJson(join(wsDir(id), "genome.json"), newGenome(id, { name: ws.name, nameAr: ws.nameAr }));
      list.push(ws);
      await writeJson(wsFile, list);
      return ws;
    },

    async getGenome(id) {
      await ensureSeeded();
      const g = await readJson(join(wsDir(id), "genome.json"), null);
      if (!g) throw new StoreError("Unknown workspace", 404);
      return g;
    },

    /** Save a genome. baseVersion must match the stored one, so a stale tab can't overwrite newer learning. */
    async putGenome(id, genome, baseVersion) {
      const current = await this.getGenome(id);
      if (baseVersion != null && current.version !== baseVersion) throw new StoreError(`Brand DNA changed elsewhere (now v${current.version}). Reload and try again.`, 409);
      if (!genome || typeof genome !== "object" || !Array.isArray(genome.traits)) throw new StoreError("That isn't a Brand DNA profile");
      const out = Object.assign({}, genome, { ws: id });
      if (JSON.stringify(out).length > 8_000_000) throw new StoreError("Brand DNA profile is too large (logo over 5 MB?)", 413);
      await writeJson(join(wsDir(id), "genome.json"), out);
      return { version: out.version };
    },

    async appendEvents(id, events) {
      await this.getGenome(id);
      const list = (Array.isArray(events) ? events : [events]).slice(0, 200).map((e) => JSON.stringify(Object.assign({}, e, { ws: id })));
      if (list.some((l) => l.length > 50_000)) throw new StoreError("Event is too large");
      if (list.length) await appendFile(join(wsDir(id), "events.jsonl"), list.join("\n") + "\n");
      return { stored: list.length };
    },

    async listEvents(id, { product, limit = 500 } = {}) {
      await this.getGenome(id);
      let text = "";
      try { text = await readFile(join(wsDir(id), "events.jsonl"), "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
      let rows = text.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      if (product) rows = rows.filter((e) => e.product === product);
      return rows.slice(-limit);
    }
  };
}
