// Unit economics per sales channel. Pure functions with no imports: inlined into the app by scripts/build.mjs.
// Fee defaults are typical starting points, not quotes: every seller should enter the numbers from their own fee sheet.

export const COUNTRIES = {
  SA: { currency: "SAR", vat: 0.15, name: ["Saudi Arabia", "السعودية"] },
  AE: { currency: "AED", vat: 0.05, name: ["UAE", "الإمارات"] },
  EG: { currency: "EGP", vat: 0.14, name: ["Egypt", "مصر"] }
};

// referral: share of the price incl. VAT; fixed: per order; fulfilment: pick, pack and ship per unit;
// payment: card or wallet processing share; codFee: extra per cash-on-delivery order.
export const CHANNEL_DEFAULTS = {
  amazon:  { referral: 0.10, fixed: 0, fulfilment: 12, payment: 0, codFee: 0 },
  noon:    { referral: 0.10, fixed: 0, fulfilment: 10, payment: 0, codFee: 0 },
  salla:   { referral: 0, fixed: 1, fulfilment: 18, payment: 0.025, codFee: 10 },
  zid:     { referral: 0, fixed: 1, fulfilment: 18, payment: 0.025, codFee: 10 },
  shopify: { referral: 0.02, fixed: 1, fulfilment: 18, payment: 0.025, codFee: 10 }
};

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Profit per unit sold on one channel.
 * @param {object} i price (incl. VAT), cost, inbound (shipping to warehouse per unit), vat,
 *   referral, fixed, fulfilment, payment, codFee, codShare (share of orders paid on delivery),
 *   ads (ad spend as share of price), returns (share of units returned), returnCost (per return)
 */
export function unitEconomics(i) {
  const price = Math.max(0, num(i.price));
  const vat = Math.max(0, num(i.vat, 0.15));
  const net = price / (1 + vat);
  const lines = [
    ["vat", price - net],
    ["referral", price * num(i.referral)],
    ["fixed", num(i.fixed)],
    ["payment", price * num(i.payment) * (1 - num(i.codShare))],
    ["cod", num(i.codFee) * num(i.codShare)],
    ["fulfilment", num(i.fulfilment)],
    ["inbound", num(i.inbound)],
    ["ads", price * num(i.ads)],
    ["returns", num(i.returns) * num(i.returnCost)],
    ["cost", num(i.cost)]
  ].map(([k, v]) => ({ key: k, amount: round2(v) }));
  const costs = lines.reduce((s, l) => s + l.amount, 0);
  const profit = round2(price - costs);
  const adsAmount = lines.find((l) => l.key === "ads").amount;
  return {
    price: round2(price), net: round2(net), lines, profit,
    margin: net > 0 ? round2(profit / net) : 0,
    roi: num(i.cost) > 0 ? round2(profit / num(i.cost)) : null,
    // Ad spend (as share of price) at which profit reaches zero.
    breakEvenAds: price > 0 ? round2((profit + adsAmount) / price) : 0,
    // Lowest price (incl. VAT) that still breaks even with these costs.
    breakEvenPrice: breakEvenPrice(i)
  };
}

function breakEvenPrice(i) {
  const share = (1 - 1 / (1 + num(i.vat, 0.15))) + num(i.referral) + num(i.payment) * (1 - num(i.codShare)) + num(i.ads);
  const fixedCosts = num(i.fixed) + num(i.codFee) * num(i.codShare) + num(i.fulfilment) + num(i.inbound) + num(i.returns) * num(i.returnCost) + num(i.cost);
  const k = 1 - share;
  return k > 0 ? round2(fixedCosts / k) : null;
}

/** Compare channels with the same product inputs. */
export function compareChannels(product, channels) {
  return Object.keys(channels).map((ch) => ({ channel: ch, ...unitEconomics({ ...product, ...channels[ch] }) }))
    .sort((a, b) => b.profit - a.profit);
}
