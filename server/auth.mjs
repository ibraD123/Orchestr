// Accounts, sign-in and teams. One account is one agency or one brand; its people are users.
// Each account's data lives in its own folder (see server/index.mjs), so accounts never see each other.
//
// Passwords: scrypt with a random salt. Sessions: random tokens, stored only as SHA-256 hashes,
// sent as an HttpOnly cookie. Invites: single-use codes that expire in 7 days.
// Everything sits in one JSON file written atomically, which is enough for pilots on one server;
// move it to a database before running several instances.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

export const ACCOUNT_TYPES = ["agency", "brand"];
export const SESSION_DAYS = 30;
export const INVITE_DAYS = 7;
export const MAX_FAILURES = 5;
// The address comes from X-Forwarded-For, which a client can change, so one email also has a cap of its own.
export const MAX_EMAIL_FAILURES = 20;
const FAILURE_WINDOW_MS = 15 * 60_000;
const DAY = 86_400_000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export class AuthError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || "").split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await scrypt(String(password), Buffer.from(salt, "base64"), want.length, { N: +N, r: +r, p: +p });
  return got.length === want.length && timingSafeEqual(got, want);
}
const tokenHash = (t) => createHash("sha256").update(String(t)).digest("hex");
const newId = (prefix) => prefix + randomBytes(6).toString("hex");
const publicUser = (u) => (u ? { id: u.id, email: u.email, name: u.name, role: u.role } : null);
const publicAccount = (a) => (a ? { id: a.id, type: a.type, name: a.name } : null);

export function createAuth(dataDir) {
  const file = join(dataDir, "auth", "auth.json");
  let db = null;
  let queue = Promise.resolve();
  const failures = new Map();

  async function load() {
    if (db) return db;
    try { db = JSON.parse(await readFile(file, "utf8")); }
    catch (e) { if (e.code !== "ENOENT") throw e; db = { users: {}, accounts: {}, sessions: {}, invites: {} }; }
    return db;
  }
  async function save() {
    await mkdir(join(file, ".."), { recursive: true });
    const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
    await writeFile(tmp, JSON.stringify(db));
    await rename(tmp, file);
  }
  /** Read-modify-write under a queue, so two requests never lose each other's changes. */
  function tx(fn) {
    const run = queue.then(async () => {
      const d = await load();
      const now = Date.now();
      for (const [h, s] of Object.entries(d.sessions)) if (s.expires < now) delete d.sessions[h];
      const out = await fn(d);
      await save();
      return out;
    });
    queue = run.catch(() => null);
    return run;
  }
  const userByEmail = (d, email) => Object.values(d.users).find((u) => u.email === email);
  function startSession(d, userId) {
    const token = randomBytes(32).toString("base64url");
    d.sessions[tokenHash(token)] = { userId, expires: Date.now() + SESSION_DAYS * DAY };
    return token;
  }
  function checkNewUser(d, { email, password, name }) {
    const e = String(email || "").trim().toLowerCase();
    if (!EMAIL.test(e)) throw new AuthError("Enter a valid email");
    if (String(password || "").length < 8) throw new AuthError("Use a password of at least 8 characters");
    if (String(password).length > 200) throw new AuthError("That password is too long");
    if (!String(name || "").trim()) throw new AuthError("Enter your name");
    if (userByEmail(d, e)) throw new AuthError("An account with this email already exists. Sign in instead.", 409);
    return e;
  }
  function throttle(key, max = MAX_FAILURES) {
    const f = failures.get(key);
    if (f && f.n >= max && Date.now() - f.first < FAILURE_WINDOW_MS) throw new AuthError("Too many attempts. Try again in 15 minutes.", 429);
  }
  function noteFailure(key) {
    const f = failures.get(key);
    if (!f || Date.now() - f.first >= FAILURE_WINDOW_MS) failures.set(key, { n: 1, first: Date.now() });
    else f.n++;
  }

  return {
    /** New account and its owner. type: "agency" (several brands) or "brand" (its own products). */
    async signup({ email, password, name, company, type }) {
      if (!ACCOUNT_TYPES.includes(type)) throw new AuthError("Choose agency or brand");
      const companyName = String(company || "").trim().slice(0, 80);
      if (!companyName) throw new AuthError(type === "agency" ? "Enter your agency's name" : "Enter your brand's name");
      const hash = await hashPassword(password);
      return tx((d) => {
        const e = checkNewUser(d, { email, password, name });
        const account = { id: newId("a"), type, name: companyName, createdAt: new Date().toISOString() };
        const user = { id: newId("u"), email: e, name: String(name).trim().slice(0, 80), passHash: hash, accountId: account.id, role: "owner", createdAt: account.createdAt };
        account.ownerId = user.id;
        d.accounts[account.id] = account; d.users[user.id] = user;
        return { token: startSession(d, user.id), user: publicUser(user), account: publicAccount(account) };
      });
    },

    async login({ email, password }, ip = "") {
      const e = String(email || "").trim().toLowerCase();
      const key = e + "|" + ip, emailKey = e + "|*";
      throttle(key); throttle(emailKey, MAX_EMAIL_FAILURES);
      const d = await load();
      const u = userByEmail(d, e);
      const ok = u ? await verifyPassword(password, u.passHash) : (await hashPassword("timing"), false);
      if (!ok) { noteFailure(key); noteFailure(emailKey); throw new AuthError("Wrong email or password", 401); }
      failures.delete(key); failures.delete(emailKey);
      return tx((d2) => ({ token: startSession(d2, u.id), user: publicUser(d2.users[u.id]), account: publicAccount(d2.accounts[u.accountId]) }));
    },

    /** The signed-in user and account for a session token, or null. */
    async session(token) {
      if (!token) return null;
      const d = await load();
      const s = d.sessions[tokenHash(token)];
      if (!s || s.expires < Date.now()) return null;
      const u = d.users[s.userId];
      const a = u && d.accounts[u.accountId];
      return u && a ? { user: publicUser(u), account: publicAccount(a) } : null;
    },

    async logout(token) { if (token) await tx((d) => { delete d.sessions[tokenHash(token)]; }); return { ok: true }; },

    async accountExists(id) { const d = await load(); return Boolean(d.accounts[id]); },

    async updateAccount(accountId, actor, patch) {
      if (actor.role !== "owner") throw new AuthError("Only the account owner can change this", 403);
      return tx((d) => {
        const a = d.accounts[accountId];
        if (!a) throw new AuthError("Unknown account", 404);
        if (patch.type != null) { if (!ACCOUNT_TYPES.includes(patch.type)) throw new AuthError("Choose agency or brand"); a.type = patch.type; }
        if (patch.name != null && String(patch.name).trim()) a.name = String(patch.name).trim().slice(0, 80);
        return publicAccount(a);
      });
    },

    async createInvite(accountId, actor) {
      if (actor.role !== "owner") throw new AuthError("Only the account owner can invite people", 403);
      return tx((d) => {
        const code = randomBytes(12).toString("base64url");
        d.invites[code] = { accountId, by: actor.id, expires: Date.now() + INVITE_DAYS * DAY };
        return { code, expires: new Date(d.invites[code].expires).toISOString() };
      });
    },

    async inviteInfo(code) {
      const d = await load();
      const inv = d.invites[String(code || "")];
      if (!inv || inv.usedBy || inv.expires < Date.now()) return { valid: false };
      const a = d.accounts[inv.accountId];
      return { valid: Boolean(a), account: publicAccount(a) };
    },

    async join({ code, email, password, name }) {
      const hash = await hashPassword(password);
      return tx((d) => {
        const inv = d.invites[String(code || "")];
        if (!inv || inv.usedBy || inv.expires < Date.now()) throw new AuthError("This invite link has expired or was already used. Ask for a new one.", 410);
        const e = checkNewUser(d, { email, password, name });
        const user = { id: newId("u"), email: e, name: String(name).trim().slice(0, 80), passHash: hash, accountId: inv.accountId, role: "member", createdAt: new Date().toISOString() };
        d.users[user.id] = user;
        inv.usedBy = user.id;
        return { token: startSession(d, user.id), user: publicUser(user), account: publicAccount(d.accounts[inv.accountId]) };
      });
    },

    async members(accountId) {
      const d = await load();
      return Object.values(d.users).filter((u) => u.accountId === accountId).map(publicUser)
        .sort((x, y) => (x.role === "owner" ? -1 : y.role === "owner" ? 1 : x.name.localeCompare(y.name)));
    },

    async removeMember(accountId, actor, userId) {
      if (actor.role !== "owner") throw new AuthError("Only the account owner can remove people", 403);
      return tx((d) => {
        const u = d.users[userId];
        if (!u || u.accountId !== accountId) throw new AuthError("Not a member of this account", 404);
        if (u.role === "owner") throw new AuthError("The owner can't be removed");
        delete d.users[userId];
        for (const [h, s] of Object.entries(d.sessions)) if (s.userId === userId) delete d.sessions[h];
        return { removed: userId };
      });
    }
  };
}
