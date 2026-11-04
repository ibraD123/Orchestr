// Plans, usage metering and payments.
// Plans mirror the landing page. A "fix" is one product whose copy or slides were approved.
// Payments use Moyasar (Saudi Arabia: Mada, cards, Apple Pay) through its Invoices API:
// the server creates an invoice, the buyer pays on Moyasar's hosted page, and the server checks
// the invoice status before switching the plan. Needs MOYASAR_SECRET_KEY.

export const PLANS = {
  trial:      { name: ["Free trial", "تجربة مجانية"], priceSar: 0, fixes: 20, clients: 1 },
  seller:     { name: ["Seller", "بائع"], priceSar: 399, fixes: 50, clients: 2 },
  agency:     { name: ["Agency", "وكالة"], priceSar: 1490, fixes: 400, clients: 10 },
  enterprise: { name: ["Enterprise", "المؤسسات"], priceSar: null, fixes: null, clients: null }
};
export const VAT_SA = 0.15;

export const monthKey = (at) => new Date(at || Date.now()).toISOString().slice(0, 7);

export function newAccount() { return { plan: "trial", since: new Date().toISOString(), usage: {}, invoices: [] }; }

/** Count usage: kind is "fixes", "renders" or "ai". Mutates and returns the account. */
export function recordUsage(account, kind, n = 1, at) {
  const m = monthKey(at);
  const u = account.usage[m] || (account.usage[m] = { fixes: 0, renders: 0, ai: 0 });
  u[kind] = (u[kind] || 0) + n;
  return account;
}

/** A paid plan runs a month from payment, with three days' grace; then the account falls back to the trial limits. */
export function effectivePlan(account, at) {
  const id = PLANS[account.plan] ? account.plan : "trial";
  if (id === "trial" || id === "enterprise" || !account.paidUntil) return id;
  return new Date(at || Date.now()).getTime() <= new Date(account.paidUntil).getTime() + 3 * 86400000 ? id : "trial";
}

/** Extend a paid plan by a month from today or from the current end, whichever is later. */
export function applyPayment(account, planId, at) {
  const now = new Date(at || Date.now());
  const from = account.plan === planId && account.paidUntil && new Date(account.paidUntil) > now ? new Date(account.paidUntil) : now;
  const until = new Date(from); until.setUTCMonth(until.getUTCMonth() + 1);
  account.plan = planId; account.paidUntil = until.toISOString();
  return account;
}

export function usageStatus(account, at) {
  const planId = effectivePlan(account, at);
  const plan = PLANS[planId];
  const u = account.usage[monthKey(at)] || { fixes: 0, renders: 0, ai: 0 };
  const limit = plan.fixes;
  return { plan: planId, planName: plan.name, paidUntil: account.paidUntil || null, expired: planId !== account.plan, limit, used: u.fixes, renders: u.renders, ai: u.ai, left: limit == null ? null : Math.max(0, limit - u.fixes), over: limit != null && u.fixes >= limit, clients: plan.clients };
}

/** Amount in halalas including VAT. */
export function invoiceAmount(planId) {
  const p = PLANS[planId];
  if (!p || !p.priceSar) return null;
  return Math.round(p.priceSar * (1 + VAT_SA) * 100);
}

export function billingConfigured(env = process.env) { return Boolean(env.MOYASAR_SECRET_KEY); }
