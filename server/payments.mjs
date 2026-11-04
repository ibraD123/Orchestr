// Moyasar Invoices API client. https://docs.moyasar.com (Invoices).
import { safeFetch, ConnectorError } from "./connectors/net.mjs";
import { PLANS, invoiceAmount, billingConfigured } from "./billing.mjs";

const API = process.env.MOYASAR_API || "https://api.moyasar.com/v1";
const auth = () => "Basic " + Buffer.from(process.env.MOYASAR_SECRET_KEY + ":").toString("base64");

async function call(path, method, body) {
  if (!billingConfigured()) throw new ConnectorError("Payments need MOYASAR_SECRET_KEY on the server", 503);
  const r = await safeFetch(API + path, {
    method, body: body ? JSON.stringify(body) : undefined, allowStatus: [400, 401, 404, 422],
    headers: { Authorization: auth(), "Content-Type": "application/json", Accept: "application/json" }
  });
  const j = JSON.parse(r.body.toString("utf8") || "{}");
  if (r.status >= 400) throw new ConnectorError("Payment provider: " + (j.message || j.type || r.status), 502);
  return j;
}

/** Create a hosted invoice for a plan; returns { id, url }. */
export async function createCheckout(planId, { callbackUrl, account }) {
  const amount = invoiceAmount(planId);
  if (!amount) throw new ConnectorError("That plan is arranged with sales, not paid online", 400);
  const plan = PLANS[planId];
  const inv = await call("/invoices", "POST", {
    amount, currency: "SAR",
    description: `Basira ${plan.name[0]} plan, 1 month (incl. 15% VAT)`,
    callback_url: callbackUrl,
    metadata: { plan: planId, account: account || "default" }
  });
  return { id: inv.id, url: inv.url, amount, status: inv.status };
}

/** Look up an invoice; paid invoices switch the plan. */
export async function verifyCheckout(id) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(String(id || ""))) throw new ConnectorError("That isn't an invoice id", 400);
  const inv = await call("/invoices/" + encodeURIComponent(id), "GET");
  return { id: inv.id, status: inv.status, paid: inv.status === "paid", plan: inv.metadata && inv.metadata.plan, amount: inv.amount };
}
