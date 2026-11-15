// Secrets are isolated by account and client workspace. The deployment key is not stored with data.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { StoreError } from "./store.mjs";

function encryptionKey() {
  const raw = String(process.env.BASIRA_CREDENTIALS_KEY || "");
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) throw new StoreError("Set BASIRA_CREDENTIALS_KEY to a 32-byte hex encryption key", 503);
  return Buffer.from(raw, "hex");
}

export function sealCredentials(value, account, ws, provider) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(JSON.stringify([account, ws, provider])));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function openCredentials(value, account, ws, provider) {
  if (!value) return null;
  if (value.version !== 1) throw new StoreError("Unsupported credential format", 503);
  try {
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
    cipher.setAAD(Buffer.from(JSON.stringify([account, ws, provider])));
    cipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, "base64")), cipher.final()]).toString("utf8"));
  } catch (e) {
    if (e instanceof StoreError) throw e;
    throw new StoreError("Could not decrypt marketplace credentials; check the server key", 503);
  }
}

export async function loadCredentials(ctx, ws, provider) {
  if (!ws) throw new StoreError("Choose a client workspace", 400);
  const encrypted = await ctx.store.getMarketplaceSecret(ws, provider);
  return openCredentials(encrypted, ctx.key, ws, provider);
}
