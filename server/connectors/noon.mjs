// Noon Partner API (Content API, opened to sellers and integrators in July 2026).
// Docs: https://noon-docs.noonpartners.dev/docs/content/content-api
//
// Sign-in: a service account key file (.json: key_id, private_key, project_code) signs an RS256 JWT
//   { sub: key_id, iat: now (seconds), jti: uuid }, sent to POST /identity/public/v1/api/login as
//   { token, default_project_code }. The answer sets session cookies used on every later call.
//   Every request carries a User-Agent naming the app.
// Content: POST /content/v1/product/upsert { skus[{ partner_sku, size }], brand, category,
//   images[{ url, sort }], attributes{ code: { values[{ value, language: LANGUAGE_EN|LANGUAGE_AR, sort }] } } }
//   → { sku_parent, variants[], status }. Images go by public URL.
//   POST /content/v1/product/content/get { sku_parent } → images[{ url, review_status, issues }],
//   statuses[{ language, content{ completeness, missing_attributes }, qc{ status, rejection_reasons, comment } }], overall_status.
//   POST /content/v1/categories/attributes/list { category_code } → attributes[{ attribute_code, is_localizable, is_multivalued, max_characters, … }].
// Which attribute holds the title, bullets and description differs by category; Basira finds them in
// the category's attributes by name (NOON_ATTR_TITLE, NOON_ATTR_BULLETS, NOON_ATTR_DESCRIPTION override).
// Not called live yet: there are no Noon credentials on this server.
import { createSign, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { safeFetch, ConnectorError } from "./net.mjs";

const UA = "Basira/0.1 (+https://basira.ai)";

export function noonConfig(env = process.env) {
  let c = {};
  if (env.NOON_CREDENTIALS) { try { c = JSON.parse(readFileSync(env.NOON_CREDENTIALS, "utf8")); } catch { c = {}; } }
  return {
    keyId: env.NOON_KEY_ID || c.key_id || null,
    privateKey: (env.NOON_PRIVATE_KEY || c.private_key || "").replace(/\\n/g, "\n") || null,
    project: env.NOON_PROJECT_CODE || c.project_code || null,
    base: env.NOON_API_URL || "https://noon-api-gateway.noon.partners"
  };
}
export const noonConfigured = (c = noonConfig()) => Boolean(c.keyId && c.privateKey);

const b64url = (b) => Buffer.from(b).toString("base64url");
/** RS256 JWT for the login call. */
export function noonJwt(c, now = Date.now()) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ sub: c.keyId, iat: Math.floor(now / 1000), jti: randomUUID() }));
  const sig = createSign("RSA-SHA256").update(head + "." + body).sign(c.privateKey);
  return head + "." + body + "." + b64url(sig);
}

let session = { cookie: null, at: 0, key: "" };
const cookieOf = (headers) => {
  const list = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : String(headers.get("set-cookie") || "").split(/,(?=\s*\w+=)/);
  return list.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
};
async function login(c, net) {
  const r = await net(c.base + "/identity/public/v1/api/login", { method: "POST", allowStatus: [400, 401, 403], body: JSON.stringify({ token: noonJwt(c), default_project_code: c.project || undefined }), headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA } });
  if (r.status >= 400) throw new ConnectorError(`Noon sign-in failed (${r.status}): ${r.body.toString("utf8").slice(0, 200)}. Check the service account key.`, 502);
  const cookie = cookieOf(r.headers);
  if (!cookie) throw new ConnectorError("Noon sign-in returned no session", 502);
  session = { cookie, at: Date.now(), key: c.keyId };
  return cookie;
}
/** One authenticated call; signs in again once if the session expired. */
export async function noonCall(path, body, { c = noonConfig(), net = safeFetch } = {}) {
  if (!noonConfigured(c)) throw new ConnectorError("Publishing to Noon needs a Noon service account (NOON_CREDENTIALS, or NOON_KEY_ID and NOON_PRIVATE_KEY)", 503);
  for (let attempt = 0; attempt < 2; attempt++) {
    const cookie = session.cookie && session.key === c.keyId && Date.now() - session.at < 25 * 60_000 && attempt === 0 ? session.cookie : await login(c, net);
    const r = await net(c.base + path, { method: "POST", timeoutMs: 30_000, allowStatus: [400, 401, 403, 404, 409, 422, 429, 500], body: JSON.stringify(body), headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA, Cookie: cookie } });
    if (r.status === 401 && attempt === 0) { session.cookie = null; continue; }
    const j = JSON.parse(r.body.toString("utf8") || "{}");
    if (r.status >= 400) throw new ConnectorError("Noon: " + (j.message || (j.status && j.status.message) || r.status), r.status === 429 ? 429 : 502);
    return j;
  }
  throw new ConnectorError("Noon sign-in keeps expiring", 502);
}

const attrCache = new Map();
export async function categoryAttributes(category, opts) {
  if (attrCache.has(category)) return attrCache.get(category);
  const j = await noonCall("/content/v1/categories/attributes/list", { category_code: category }, opts);
  attrCache.set(category, j.attributes || []);
  return j.attributes || [];
}

/** The attribute codes for title, bullets and description in a category's attribute list. Pure. */
export function copyAttributes(attrs, env = process.env) {
  const text = (attrs || []).filter((a) => a.attribute_type === "ATTRIBUTE_TYPE_TEXT" || !a.attribute_type);
  const find = (re, multi) => (text.find((a) => re.test(a.attribute_code) && (multi == null || Boolean(a.is_multivalued) === multi)) || {}).attribute_code || null;
  return {
    title: env.NOON_ATTR_TITLE || find(/^(product_)?(title|name)$/) || find(/title/),
    bullets: env.NOON_ATTR_BULLETS || find(/feature|bullet|highlight/, true) || find(/feature|bullet|highlight/),
    description: env.NOON_ATTR_DESCRIPTION || find(/^(long_)?description$/) || find(/description/)
  };
}

/** The UpsertProduct body for one product. Pure. */
export function upsertBody({ partnerSku, size, brand, category, images, copy }, codes) {
  if (!partnerSku || !brand || !category) throw new ConnectorError("Noon needs the partner SKU, brand and category for each product", 400);
  const loc = (en, ar) => [en && { value: en, language: "LANGUAGE_EN" }, ar && { value: ar, language: "LANGUAGE_AR" }].filter(Boolean);
  const multi = (en, ar) => [...(en || []).map((v, i) => ({ value: v, language: "LANGUAGE_EN", sort: i + 1 })), ...(ar || []).map((v, i) => ({ value: v, language: "LANGUAGE_AR", sort: i + 1 }))];
  const attributes = {};
  const c = copy || {};
  if (codes.title && (c.titleEn || c.titleAr)) attributes[codes.title] = { values: loc(c.titleEn, c.titleAr) };
  if (codes.bullets && ((c.bulletsEn || []).length || (c.bulletsAr || []).length)) attributes[codes.bullets] = { values: multi(c.bulletsEn, c.bulletsAr) };
  if (codes.description && (c.descriptionEn || c.descriptionAr)) attributes[codes.description] = { values: loc(c.descriptionEn, c.descriptionAr) };
  return { skus: [{ partner_sku: String(partnerSku), size: size || null }], brand: String(brand), category: String(category), images: (images || []).slice(0, 9).map((url, i) => ({ url, sort: i + 1 })), attributes };
}

/** Create or update one product on Noon. */
export async function noonPublish(item, opts = {}) {
  const codes = copyAttributes(await categoryAttributes(item.category, opts));
  const j = await noonCall("/content/v1/product/upsert", upsertBody(item, codes), opts);
  return { sku: item.partnerSku, skuParent: j.sku_parent || null, variants: j.variants || [], status: j.status || null, attributes: codes };
}

/** Noon's review of one product: each image, each language's completeness and QC, and whether it can go live. Pure. */
export function contentSummary(j) {
  const images = (j.images || []).map((im) => ({ url: im.url, sort: im.sort, visible: im.visibility === "VISIBILITY_STATUS_VISIBLE", review: String(im.review_status || "").replace("REVIEW_STATUS_", "").toLowerCase(), issues: (im.issues || []).map((x) => x.message || x.code) }));
  const langs = (j.statuses || []).map((s) => ({
    language: String(s.language || "").replace("LANGUAGE_", "").toLowerCase(),
    completeness: Number(s.content && s.content.completeness) || 0,
    missing: (s.content && s.content.missing_attributes) || [],
    qc: String((s.qc && s.qc.status) || "").replace("QC_STATUS_", "").toLowerCase(),
    reasons: (s.qc && s.qc.rejection_reasons) || [], comment: (s.qc && s.qc.comment) || "",
    live: s.overall_status === "OVERALL_STATUS_ACTIVE"
  }));
  return { skuParent: j.sku_parent, images, languages: langs, rejectedImages: images.filter((i) => i.review === "invalid").length, live: langs.length > 0 && langs.every((l) => l.live) };
}
export async function noonContent(skuParent, opts) { return contentSummary(await noonCall("/content/v1/product/content/get", { sku_parent: skuParent }, opts)); }
