import { test } from "node:test";
import assert from "node:assert/strict";
import { unitEconomics, compareChannels, CHANNEL_DEFAULTS } from "../server/economics.mjs";

test("profit per unit adds up", () => {
  const r = unitEconomics({ price: 230, vat: 0.15, cost: 60, inbound: 3, referral: 0.1, fulfilment: 12, ads: 0.1, returns: 0.05, returnCost: 20 });
  // 230 - 30 VAT - 23 referral - 12 fulfilment - 3 inbound - 23 ads - 1 returns - 60 cost = 78
  assert.equal(r.net, 200);
  assert.equal(r.profit, 78);
  assert.equal(r.margin, 0.39);
  assert.equal(r.roi, 1.3);
  assert.equal(r.breakEvenAds, 0.44);
});

test("break-even price really breaks even", () => {
  const inputs = { vat: 0.15, cost: 60, inbound: 3, referral: 0.1, fulfilment: 12, ads: 0.1, returns: 0.05, returnCost: 20 };
  const r = unitEconomics({ price: 100, ...inputs });
  assert.ok(Math.abs(unitEconomics({ price: r.breakEvenPrice, ...inputs }).profit) < 0.05);
});

test("cash on delivery costs only apply to COD orders", () => {
  const base = { price: 115, vat: 0.15, cost: 40, ...CHANNEL_DEFAULTS.salla };
  const card = unitEconomics({ ...base, codShare: 0 });
  const cod = unitEconomics({ ...base, codShare: 1 });
  assert.equal(card.lines.find((l) => l.key === "cod").amount, 0);
  assert.equal(cod.lines.find((l) => l.key === "payment").amount, 0);
  assert.ok(Math.abs((card.profit - cod.profit) - (10 - 115 * 0.025)) <= 0.011);
});
const round = (n) => Math.round(n * 100) / 100;

test("channels are ranked by profit", () => {
  const r = compareChannels({ price: 200, vat: 0.15, cost: 50 }, { noon: CHANNEL_DEFAULTS.noon, salla: CHANNEL_DEFAULTS.salla });
  assert.equal(r.length, 2);
  assert.ok(r[0].profit >= r[1].profit);
});
