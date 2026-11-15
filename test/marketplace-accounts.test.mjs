import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../server/store.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sealCredentials, openCredentials, loadCredentials } from "../server/marketplace-credentials.mjs";
import { startAmazonOAuth, continueAmazonOAuth, finishAmazonOAuth } from "../server/amazon-oauth.mjs";
import { fetchSallaReviews } from "../server/connectors/salla-reviews.mjs";
import { setNetwork } from "../server/connectors/net.mjs";

process.env.BASIRA_CREDENTIALS_KEY = "42".repeat(32);
process.env.SPAPI_APP_ID = "amzn1.sellerapps.app.test";
process.env.SPAPI_CLIENT_ID = "test-client";
process.env.SPAPI_CLIENT_SECRET = "test-secret";
process.env.PUBLIC_URL = "https://basira.example";

test("simultaneous first requests safely initialize the same workspace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "basira-seed-"));
  try {
    const store = createStore(dir);
    const values = await Promise.all(Array.from({ length: 20 }, (_, i) => i % 2 ? store.getGenome("layali") : store.listWorkspaces()));
    assert.equal(values.length, 20);
    assert.equal((await store.listWorkspaces()).length, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("encrypted seller credentials are isolated by account and workspace and deleted with a workspace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "basira-credentials-"));
  try {
    const store = createStore(dir, { seed: false });
    const a = await store.createWorkspace({ name: "Brand A" });
    const b = await store.createWorkspace({ name: "Brand B" });
    const secret = sealCredentials({ refreshToken: "private-token", sellerId: "A12345" }, "acct1", a.id, "amazon");
    await store.putMarketplaceSecret(a.id, "amazon", secret);
    assert.equal((await loadCredentials({ store, key: "acct1" }, a.id, "amazon")).refreshToken, "private-token");
    assert.equal(await loadCredentials({ store, key: "acct1" }, b.id, "amazon"), null);
    assert.throws(() => openCredentials(secret, "acct1", b.id, "amazon"));
    assert.throws(() => openCredentials(secret, "acct2", a.id, "amazon"));
    assert.ok(!(await readFile(join(dir, "ws", a.id, "integration-amazon.json"), "utf8")).includes("private-token"));
    assert.ok(!JSON.stringify(await store.exportWorkspace(a.id)).includes("private-token"));
    await store.deleteWorkspace(a.id);
    await assert.rejects(() => store.getMarketplaceSecret(a.id, "amazon"));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Amazon consent binds callback, session, seller and workspace; authorization code is single-use", async () => {
  let saved;
  const ctx = { key: "acct", store: { getGenome: async (id) => { assert.equal(id, "brand"); }, putMarketplaceSecret: async (ws, provider, data) => { saved = { ws, provider, data }; } } };
  setNetwork({ lookup: async () => [{ address: "93.184.216.34" }], fetch: async () => new Response(JSON.stringify({ refresh_token: "seller-token" }), { status: 200 }) });
  const started = await startAmazonOAuth(ctx, "brand", "amazon.ae", "browser-session");
  assert.equal(new URL(started.url).hostname, "sellercentral.amazon.ae");
  const login = new URLSearchParams({ amazon_callback_uri: "https://sellercentral.amazon.ae/apps/authorize/confirm/amzn1.sellerapps.app.test", amazon_state: "amazon-state", selling_partner_id: "A123456" });
  assert.throws(() => continueAmazonOAuth(ctx, login, started.id, "other-session"), /expired/);
  assert.throws(() => continueAmazonOAuth(ctx, new URLSearchParams({ ...Object.fromEntries(login), amazon_callback_uri: "https://attacker.example/apps/authorize/confirm/amzn1.sellerapps.app.test" }), started.id, "browser-session"), /Invalid/);
  const target = new URL(continueAmazonOAuth(ctx, login, started.id, "browser-session"));
  const result = new URLSearchParams({ state: target.searchParams.get("state"), selling_partner_id: "A123456", spapi_oauth_code: "code" });
  await assert.rejects(() => finishAmazonOAuth(ctx, new URLSearchParams({ ...Object.fromEntries(result), selling_partner_id: "A654321" }), started.id, "browser-session"), /state/);
  await finishAmazonOAuth(ctx, result, started.id, "browser-session");
  assert.equal(saved.ws, "brand");
  assert.equal(openCredentials(saved.data, "acct", "brand", "amazon").refreshToken, "seller-token");
  await assert.rejects(() => finishAmazonOAuth(ctx, result, started.id, "browser-session"), /expired/);
});

test("Salla fetches product reviews across pages without returning customer details", async () => {
  let calls = 0;
  setNetwork({ lookup: async () => [{ address: "93.184.216.34" }], fetch: async (url, opts) => {
    calls++; assert.equal(opts.headers.Authorization, "Bearer token");
    assert.equal(new URL(url).searchParams.get("products"), "123");
    return new Response(JSON.stringify({ data: calls === 1 ? [{ id: 1, type: "rating", content: "Good", rating: 5, customer: { email: "private@example.com" } }, { id: 2, type: "ask", content: "Question" }] : [{ id: 3, type: "rating", content: "Bad", rating: 2 }], pagination: { totalPages: 2 } }), { status: 200 });
  } });
  const r = await fetchSallaReviews("token", "123");
  assert.deepEqual(r.map((x) => x.text), ["Good", "Bad"]);
  assert.equal(calls, 2);
  assert.ok(!JSON.stringify(r).includes("private@example.com"));
  await assert.rejects(() => fetchSallaReviews("token", "../1"), /product ID/);
});
