// File-backed store: one folder per client workspace with its Brand DNA genome and event log.
// Writes are atomic (temp file + rename). Built for one server process; swap for a database
// when several instances run.
import { mkdir, readFile, writeFile, appendFile, rename, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sampleData } from "./brand-seed.mjs";
import { newGenome } from "./brand-dna.mjs";

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const BATCH = /^[a-z0-9-]{8,64}$/;
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** A file or folder name that is safe on disk and in a URL (SKUs can contain anything). */
export function safeName(s) { return String(s || "").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "").slice(0, 60) || "item"; }

export class StoreError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

/** @param {{ seed?: boolean }} opts  seed: add the two sample clients on first use (agencies); brands start with their own brand only */
export function createStore(dir, { seed = true } = {}) {
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
    if (!seed) { await writeJson(wsFile, []); return []; }
    const d = sampleData();
    for (const w of d.workspaces) {
      await writeJson(join(wsDir(w.id), "genome.json"), d.genomes[w.id]);
      if (d.events[w.id].length) await writeFile(join(wsDir(w.id), "events.jsonl"), d.events[w.id].map((e) => JSON.stringify(e)).join("\n") + "\n");
    }
    await writeJson(wsFile, d.workspaces);
    return d.workspaces;
  }

  const assetPath = (id, batch, rel) => {
    if (!BATCH.test(batch)) throw new StoreError("Not found", 404);
    const parts = String(rel || "").split("/");
    if (!parts.length || parts.some((p) => !SEGMENT.test(p))) throw new StoreError("Not found", 404);
    return join(wsDir(id), "assets", batch, ...parts);
  };
  const portalQueues = new Map();
  // Account writes go one at a time so two requests can't lose each other's usage counts.
  const accountFile = join(dir, "account.json");
  let accountQueue = Promise.resolve();

  return {
    async listWorkspaces() { return ensureSeeded(); },

    async updateWorkspace(id, patch) {
      const list = await ensureSeeded();
      const ws = list.find((w) => w.id === id);
      if (!ws) throw new StoreError("Unknown workspace", 404);
      if (patch && typeof patch.consentTraining === "boolean") { ws.consentTraining = patch.consentTraining; ws.consentAt = new Date().toISOString(); }
      if (patch && typeof patch.name === "string" && patch.name.trim()) ws.name = patch.name.trim().slice(0, 80);
      if (patch && typeof patch.nameAr === "string") ws.nameAr = patch.nameAr.trim().slice(0, 80);
      await writeJson(wsFile, list);
      return ws;
    },

    /** Everything stored for one client, for a data request (PDPL right of access). */
    async exportWorkspace(id) {
      const list = await ensureSeeded();
      const ws = list.find((w) => w.id === id);
      if (!ws) throw new StoreError("Unknown workspace", 404);
      const assets = [];
      try {
        for (const b of await readdir(join(wsDir(id), "assets"))) {
          const m = await readJson(join(wsDir(id), "assets", b, "manifest.json"), null);
          assets.push({ batch: b, createdAt: m && m.createdAt, channel: m && m.channel, products: m ? m.items.length : null });
        }
      } catch (e) { if (e.code !== "ENOENT") throw e; }
      return { exportedAt: new Date().toISOString(), workspace: ws, genome: await this.getGenome(id), events: await this.listEvents(id, { limit: 1e9 }), portal: await this.getPortal(id), assets };
    },

    /** Delete a client and everything stored for it (PDPL right of erasure). */
    async deleteWorkspace(id) {
      const list = await ensureSeeded();
      const i = list.findIndex((w) => w.id === id);
      if (i < 0) throw new StoreError("Unknown workspace", 404);
      await rm(wsDir(id), { recursive: true, force: true });
      list.splice(i, 1);
      await writeJson(wsFile, list);
      return { deleted: id };
    },

    async saveAsset(id, batch, rel, data) {
      const file = assetPath(id, batch, rel);
      await mkdir(join(file, ".."), { recursive: true });
      await writeFile(file, data);
      return rel;
    },
    async readAsset(id, batch, rel) {
      try { return await readFile(assetPath(id, batch, rel)); }
      catch (e) { if (e.code === "ENOENT") throw new StoreError("Not found", 404); throw e; }
    },
    async getManifest(id, batch) {
      const m = await readJson(assetPath(id, batch, "manifest.json"), null);
      if (!m) throw new StoreError("That export no longer exists", 404);
      return m;
    },

    async getAccount(make) { return readJson(accountFile, null).then((a) => a || make()); },
    /** Read-modify-write the account under a queue. fn returns the value to hand back. */
    updateAccount(make, fn) {
      const run = accountQueue.then(async () => {
        const a = (await readJson(accountFile, null)) || make();
        const out = await fn(a);
        await writeJson(accountFile, a);
        return out === undefined ? a : out;
      });
      accountQueue = run.catch(() => null);
      return run;
    },

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

    /** The client portal's data for one workspace (server/portal.mjs). */
    async getPortal(id) {
      await this.getGenome(id);
      return readJson(join(wsDir(id), "portal.json"), { reviews: [], requests: [], brief: null, events: [] });
    },
    /** Change the portal data one write at a time, so a client and the agency can't overwrite each other. */
    async updatePortal(id, fn) {
      const run = (portalQueues.get(id) || Promise.resolve()).then(async () => {
        const p = await this.getPortal(id);
        const out = await fn(p);
        await writeJson(join(wsDir(id), "portal.json"), p);
        return out;
      });
      portalQueues.set(id, run.catch(() => {}));
      return run;
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
