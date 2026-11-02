// Outbound HTTP for connectors: HTTPS only, private networks blocked, size and time limits.
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

let impl = { fetch: (...a) => globalThis.fetch(...a), lookup: (host) => dnsLookup(host, { all: true }) };
/** Tests swap the network for fakes. */
export function setNetwork(next) { impl = { ...impl, ...next }; }

export class ConnectorError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function privateAddress(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? privateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new ConnectorError("That doesn't look like a link"); }
  if (url.protocol !== "https:") throw new ConnectorError("Only https links are supported");
  if (url.username || url.password) throw new ConnectorError("Links with credentials are not supported");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new ConnectorError("Private addresses are not allowed");
  const addrs = isIP(host) ? [{ address: host }] : await impl.lookup(host).catch(() => { throw new ConnectorError(`Couldn't find ${host}`); });
  if (!addrs.length || addrs.some((a) => privateAddress(a.address))) throw new ConnectorError("Private addresses are not allowed");
  return url;
}

/**
 * Fetch a public URL. Redirects are followed manually so every hop is checked.
 * @returns {Promise<{ status:number, url:string, headers:Headers, body:Buffer }>}
 */
export async function safeFetch(raw, { maxBytes = 3_000_000, timeoutMs = 12_000, headers = {}, method = "GET", body, allowStatus = [] } = {}) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await impl.fetch(url.href, {
        method, body, redirect: "manual", signal: ctrl.signal,
        headers: { "User-Agent": "BasiraBot/0.1 (+https://basira.ai/bot; listing audit on behalf of the seller)", "Accept-Language": "en,ar;q=0.8", ...headers }
      });
    } catch (e) {
      clearTimeout(timer);
      throw new ConnectorError(e.name === "AbortError" ? `${url.hostname} took too long to answer` : `Couldn't reach ${url.hostname}`, 502);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      url = await assertPublicUrl(new URL(res.headers.get("location"), url).href);
      continue;
    }
    try {
      const chunks = [];
      let size = 0;
      if (res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > maxBytes) { await reader.cancel(); throw new ConnectorError("The page is too large to read", 413); }
          chunks.push(Buffer.from(value));
        }
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > maxBytes) throw new ConnectorError("The page is too large to read", 413);
        chunks.push(buf);
      }
      if (!res.ok && !allowStatus.includes(res.status)) {
        throw new ConnectorError(res.status === 404 ? "That page doesn't exist" : res.status === 403 || res.status === 429 ? `${url.hostname} refused the request (${res.status})` : `${url.hostname} answered ${res.status}`, 502);
      }
      return { status: res.status, url: url.href, headers: res.headers, body: Buffer.concat(chunks) };
    } finally { clearTimeout(timer); }
  }
  throw new ConnectorError("Too many redirects", 502);
}

export async function fetchJson(raw, opts) {
  const r = await safeFetch(raw, { ...opts, headers: { Accept: "application/json", ...(opts && opts.headers) } });
  try { return JSON.parse(r.body.toString("utf8")); } catch { throw new ConnectorError("Expected JSON and got something else", 502); }
}
