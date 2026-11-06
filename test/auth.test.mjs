// Accounts on: sign-up, sign-in, isolation between accounts, teams, modes and cross-site protection.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword, verifyPassword } from "../server/auth.mjs";

let dir, server, base;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "basira-auth-"));
  process.env.BASIRA_DATA_DIR = dir;
  delete process.env.BASIRA_AUTH;
  ({ server } = await import("../server/index.mjs"));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
// /api/health starts Chromium to report the renderer; close it so the test process can exit.
after(async () => { server.closeAllConnections(); server.close(); const { closeRenderer } = await import("../server/render.mjs"); await closeRenderer(); await rm(dir, { recursive: true, force: true }); });

/** A tiny client that keeps its own session cookie. */
function client() {
  let cookie = "";
  return async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const type = r.headers.get("content-type") || "";
    return { status: r.status, setCookie: set, body: type.startsWith("application/json") ? await r.json() : await r.text() };
  };
}

test("passwords are stored as scrypt hashes", async () => {
  const h = await hashPassword("correct horse");
  assert.match(h, /^scrypt\$/);
  assert.equal(await verifyPassword("correct horse", h), true);
  assert.equal(await verifyPassword("wrong horse", h), false);
});

test("without a session the API answers 401; health and the pages stay public", async () => {
  const c = client();
  assert.equal((await c("GET", "/api/workspaces")).status, 401);
  assert.equal((await c("POST", "/api/render", {})).status, 401);
  const h = await c("GET", "/api/health");
  assert.equal(h.status, 200); assert.equal(h.body.auth, true);
  assert.equal((await c("GET", "/api/auth/me")).status, 401);
});

test("an agency signs up, gets two sample clients and an HttpOnly session", async () => {
  const c = client();
  const r = await c("POST", "/api/auth/signup", { type: "agency", name: "Sara", company: "Dar Agency", email: "sara@dar.test", password: "s3cret-pass" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.setCookie, /basira_session=.+; HttpOnly; Path=\/; SameSite=Lax/);
  assert.equal(r.body.account.type, "agency");
  assert.equal(r.body.user.role, "owner");
  const me = await c("GET", "/api/auth/me");
  assert.equal(me.body.user.email, "sara@dar.test");
  const ws = await c("GET", "/api/workspaces");
  assert.deepEqual(ws.body.map((w) => w.id), ["layali", "noor"]);
  const acc = await c("GET", "/api/account");
  assert.equal(acc.body.type, "agency");
  assert.equal(acc.body.agency.name, "Dar Agency");
  const raw = await readFile(join(dir, "auth", "auth.json"), "utf8");
  assert.ok(!raw.includes("s3cret-pass"), "no plain password on disk");
  assert.ok(!raw.includes(r.setCookie.split(";")[0].split("=")[1]), "no raw session token on disk");
});

test("a brand signs up with its own brand as the only workspace; accounts never see each other", async () => {
  const brand = client();
  const r = await brand("POST", "/api/auth/signup", { type: "brand", name: "Omar", company: "Sidr Honey Co", email: "omar@sidr.test", password: "honey-honey" });
  assert.equal(r.body.account.type, "brand");
  const ws = await brand("GET", "/api/workspaces");
  assert.deepEqual(ws.body.map((w) => w.name), ["Sidr Honey Co"]);
  const own = ws.body[0].id;
  await brand("POST", `/api/brand/${own}/events`, { events: [{ type: "approve", product: "p1" }] });

  const agency = client();
  await agency("POST", "/api/auth/login", { email: "sara@dar.test", password: "s3cret-pass" });
  assert.equal((await agency("GET", `/api/brand/${own}`)).status, 404, "another account's workspace is invisible");
  assert.ok(!(await agency("GET", "/api/workspaces")).body.some((w) => w.id === own));
  assert.equal((await agency("GET", "/api/account")).body.used, 0, "usage is per account");
  assert.equal((await brand("GET", "/api/account")).body.used, 1);
});

test("wrong passwords are refused and throttled; sign-out ends the session", async () => {
  const c = client();
  for (let i = 0; i < 5; i++) assert.equal((await c("POST", "/api/auth/login", { email: "omar@sidr.test", password: "nope-nope" })).status, 401);
  assert.equal((await c("POST", "/api/auth/login", { email: "omar@sidr.test", password: "honey-honey" })).status, 429, "locked for 15 minutes after 5 failures");
  // A changed X-Forwarded-For starts a new per-address count, but the email's own cap still holds.
  let last;
  for (let i = 0; i < 20; i++) last = (await c("POST", "/api/auth/login", { email: "omar@sidr.test", password: "nope-nope" }, { "X-Forwarded-For": "203.0.113." + i })).status;
  assert.equal(last, 429, "20 failures for one email lock it from any address");
  const d = client();
  assert.equal((await d("POST", "/api/auth/signup", { type: "brand", name: "X", company: "Y", email: "sara@dar.test", password: "whatever1" })).status, 409, "email already used");
  assert.equal((await d("POST", "/api/auth/signup", { type: "brand", name: "X", company: "Y", email: "x@y.test", password: "short" })).status, 400);
  const e = client();
  await e("POST", "/api/auth/login", { email: "sara@dar.test", password: "s3cret-pass" });
  assert.equal((await e("GET", "/api/workspaces")).status, 200);
  await e("POST", "/api/auth/logout");
  assert.equal((await e("GET", "/api/workspaces")).status, 401);
});

test("the owner invites a teammate who joins the same account; members can't invite or remove", async () => {
  const owner = client();
  await owner("POST", "/api/auth/login", { email: "sara@dar.test", password: "s3cret-pass" });
  const inv = await owner("POST", "/api/team/invite");
  assert.equal(inv.status, 200);
  assert.match(inv.body.url, /\/app\?invite=/);
  const info = await client()("GET", "/api/auth/invite?code=" + encodeURIComponent(inv.body.code));
  assert.deepEqual([info.body.valid, info.body.account.name], [true, "Dar Agency"]);

  const member = client();
  const j = await member("POST", "/api/auth/join", { code: inv.body.code, name: "Omar Designer", email: "omar@dar.test", password: "design-123" });
  assert.equal(j.status, 200, JSON.stringify(j.body));
  assert.equal(j.body.user.role, "member");
  assert.deepEqual((await member("GET", "/api/workspaces")).body.map((w) => w.id), ["layali", "noor"], "same account data");
  assert.equal((await member("POST", "/api/team/invite")).status, 403);
  assert.equal((await member("PATCH", "/api/account", { type: "brand" })).status, 403);
  assert.equal((await client()("POST", "/api/auth/join", { code: inv.body.code, name: "Z", email: "z@z.test", password: "zzzzzzzz" })).status, 410, "invites are single-use");

  const team = await owner("GET", "/api/team");
  assert.deepEqual(team.body.members.map((m) => m.role), ["owner", "member"]);
  const memberId = team.body.members.find((m) => m.role === "member").id;
  assert.equal((await owner("DELETE", "/api/team/" + memberId)).status, 200);
  assert.equal((await member("GET", "/api/workspaces")).status, 401, "a removed member is signed out");
});

test("the owner switches the account between agency and single brand", async () => {
  const owner = client();
  await owner("POST", "/api/auth/login", { email: "sara@dar.test", password: "s3cret-pass" });
  assert.equal((await owner("PATCH", "/api/account", { type: "brand" })).body.type, "brand");
  assert.equal((await owner("GET", "/api/auth/me")).body.account.type, "brand");
  assert.equal((await owner("PATCH", "/api/account", { type: "shop" })).status, 400);
  await owner("PATCH", "/api/account", { type: "agency" });
});

test("cross-site requests are refused, and hosted export files stay public under the account id", async () => {
  const owner = client();
  await owner("POST", "/api/auth/login", { email: "sara@dar.test", password: "s3cret-pass" });
  assert.equal((await owner("POST", "/api/workspaces", { name: "Evil" }, { Origin: "https://evil.test" })).status, 403);
  assert.equal((await owner("POST", "/api/workspaces", { name: "Fine Client" }, { Origin: base })).status, 200);
  assert.equal((await client()("GET", "/assets/a000000000000/layali/2026-01-01-abcdef0123456789/x.zip")).status, 404, "unknown account");
});
