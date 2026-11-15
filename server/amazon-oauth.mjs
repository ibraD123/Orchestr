import { randomBytes, createHash } from "node:crypto";
import { safeFetch } from "./connectors/net.mjs";
import { StoreError } from "./store.mjs";
import { sealCredentials } from "./marketplace-credentials.mjs";

// Pending authorizations expire after ten minutes and are bound to the browser session and workspace.
const pending = new Map();
const hosts = { "amazon.ae": "sellercentral.amazon.ae", "amazon.sa": "sellercentral.amazon.sa", "amazon.eg": "sellercentral.amazon.eg" };
const hash = (v) => createHash("sha256").update(String(v)).digest("hex");
const fail = (msg, status = 400) => { throw new StoreError(msg, status); };
const nonce = () => randomBytes(32).toString("base64url");
function settings() {
  const { SPAPI_APP_ID, SPAPI_CLIENT_ID, SPAPI_CLIENT_SECRET, PUBLIC_URL, BASIRA_CREDENTIALS_KEY } = process.env;
  if (!SPAPI_APP_ID || !SPAPI_CLIENT_ID || !SPAPI_CLIENT_SECRET || !/^https:\/\//.test(PUBLIC_URL || "") || !/^[a-fA-F0-9]{64}$/.test(BASIRA_CREDENTIALS_KEY || "")) fail("Amazon authorization requires SPAPI_APP_ID, SPAPI_CLIENT_ID, SPAPI_CLIENT_SECRET, PUBLIC_URL (HTTPS), and BASIRA_CREDENTIALS_KEY", 503);
  const base = new URL(PUBLIC_URL);
  if (base.username || base.password || base.pathname !== "/" || base.search || base.hash) fail("PUBLIC_URL must be an HTTPS origin", 503);
  return { appId: SPAPI_APP_ID, clientId: SPAPI_CLIENT_ID, secret: SPAPI_CLIENT_SECRET, redirect: `${base.origin}/api/amazon/oauth/callback` };
}
function current(id, ctx, session) {
  const tx = pending.get(hash(id || ""));
  if (!tx || tx.expires < Date.now() || tx.account !== ctx.key || tx.session !== hash(session || "")) fail("Amazon authorization expired; start again", 403);
  return tx;
}
export async function startAmazonOAuth(ctx, ws, market, session) {
  const s = settings();
  if (!hosts[market]) fail("Choose an Amazon marketplace");
  await ctx.store.getGenome(ws);
  for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
  const id = nonce(), state = nonce();
  pending.set(hash(id), { account: ctx.key, ws, market, session: hash(session || ""), state, expires: Date.now() + 10 * 60_000 });
  const u = new URL(`https://${hosts[market]}/apps/authorize/consent`);
  u.searchParams.set("application_id", s.appId); u.searchParams.set("state", state);
  if (process.env.SPAPI_APP_DRAFT === "true") u.searchParams.set("version", "beta");
  return { id, url: u.href };
}
export function continueAmazonOAuth(ctx, query, id, session) {
  const s = settings(), tx = current(id, ctx, session);
  const callback = new URL(String(query.get("amazon_callback_uri") || "https://invalid.invalid"));
  if (callback.protocol !== "https:" || ![hosts[tx.market], tx.market, "amazon.com"].includes(callback.hostname) || callback.port || callback.username || callback.password || callback.pathname !== `/apps/authorize/confirm/${s.appId}`) fail("Invalid Amazon authorization callback", 403);
  const sellerId = String(query.get("selling_partner_id") || ""), amazonState = String(query.get("amazon_state") || "");
  if (!/^[A-Za-z0-9]{5,40}$/.test(sellerId) || !amazonState || amazonState.length > 2048) fail("Invalid Amazon authorization response");
  tx.sellerId = sellerId; tx.state = nonce();
  callback.search = ""; callback.hash = "";
  callback.searchParams.set("amazon_state", amazonState); callback.searchParams.set("state", tx.state); callback.searchParams.set("redirect_uri", s.redirect);
  if (process.env.SPAPI_APP_DRAFT === "true") callback.searchParams.set("version", "beta");
  return callback.href;
}
export async function finishAmazonOAuth(ctx, query, id, session) {
  const s = settings(), tx = current(id, ctx, session);
  if (!tx.sellerId || query.get("state") !== tx.state || query.get("selling_partner_id") !== tx.sellerId) fail("Invalid Amazon authorization state", 403);
  const code = String(query.get("spapi_oauth_code") || "");
  if (!code || code.length > 4096) fail("Missing Amazon authorization code");
  pending.delete(hash(id)); // one use, including failed exchanges
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: s.redirect, client_id: s.clientId, client_secret: s.secret });
  const r = await safeFetch("https://api.amazon.com/auth/o2/token", { method: "POST", forbidRedirect: true, body: body.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  let reply; try { reply = JSON.parse(r.body.toString("utf8")); } catch { fail("Amazon returned an invalid authorization response", 502); }
  if (!reply.refresh_token) fail("Amazon did not return a refresh token", 502);
  const details = { sellerId: tx.sellerId, refreshToken: reply.refresh_token, marketplace: tx.market, connectedAt: new Date().toISOString() };
  await ctx.store.putMarketplaceSecret(tx.ws, "amazon", sealCredentials(details, ctx.key, tx.ws, "amazon"));
  return { ws: tx.ws, sellerId: tx.sellerId };
}
