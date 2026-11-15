import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setNetwork } from "../server/connectors/net.mjs";

test("seller connections and review sync stay inside the selected client workspace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "basira-market-api-"));
  process.env.BASIRA_AUTH = "off"; process.env.BASIRA_DATA_DIR = dir;
  process.env.BASIRA_CREDENTIALS_KEY = "42".repeat(32);
  process.env.SPAPI_APP_ID = "amzn1.sellerapps.app.test";
  process.env.SPAPI_CLIENT_ID = "app-client"; process.env.SPAPI_CLIENT_SECRET = "app-secret";
  process.env.PUBLIC_URL = "https://basira.example";
  setNetwork({ lookup: async () => [{ address: "93.184.216.34" }], fetch: async (url) => {
    if (String(url).includes("api.amazon.com")) return new Response(JSON.stringify({ refresh_token: "secret-refresh" }));
    return new Response(JSON.stringify({ data: [{ id: 1, type: "rating", content: "Great", rating: 5, customer: { email: "private@example.com" } }], pagination: { totalPages: 1 } }));
  } });
  const { server } = await import("../server/index.mjs");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, body, opts = {}) {
    const res = await fetch(base + path, { method: body ? "POST" : "GET", headers: { ...(body ? { "content-type": "application/json" } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    return res;
  }
  try {
    await request("/api/workspaces");
    const salla = await request("/api/salla/connect", { ws: "layali", accessToken: "token" });
    assert.equal(salla.status, 200);
    const review = await request("/api/reviews/salla", { ws: "layali", productKey: "sku1", productId: "123" });
    assert.deepEqual((await review.json()).reviews.map((r) => r.text), ["Great"]);
    const repeated = await request("/api/reviews/salla", { ws: "layali", productKey: "sku1" });
    assert.deepEqual((await repeated.json()).reviews.map((r) => r.text), ["Great"]);
    const other = await request("/api/reviews/salla", { ws: "noor", productKey: "sku1" });
    assert.notEqual(other.status, 200);
    const start = await request("/api/amazon/oauth/start", { ws: "layali", marketplace: "amazon.ae" });
    assert.equal(start.status, 200);
    const cookie = start.headers.get("set-cookie").split(";")[0];
    const query = new URLSearchParams({ amazon_callback_uri: "https://sellercentral.amazon.ae/apps/authorize/confirm/amzn1.sellerapps.app.test", amazon_state: "amz", selling_partner_id: "A123456" });
    const login = await request("/api/amazon/oauth/login?" + query, null, { cookie });
    assert.equal(login.status, 303);
    const callbackState = new URL(login.headers.get("location")).searchParams.get("state");
    const callback = await request("/api/amazon/oauth/callback?" + new URLSearchParams({ state: callbackState, selling_partner_id: "A123456", spapi_oauth_code: "code" }), null, { cookie });
    assert.equal(callback.status, 303);
    const connection = await (await request("/api/amazon/connection?ws=layali")).json();
    assert.equal(connection.sellerId, "A123456");
    assert.ok(!JSON.stringify(connection).includes("secret-refresh"));
    const different = await (await request("/api/amazon/connection?ws=noor")).json();
    assert.equal(different.connected, false);
  } finally { await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
