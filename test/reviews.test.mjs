import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, ReviewAnalysis } from "../server/reviews.mjs";

const sample = {
  reviews: [
    { index: 0, dialect: "gulf", sentiment: "negative", aspects: [{ aspect: "longevity", sentiment: "negative", evidence: "ما تثبت" }] },
    { index: 1, dialect: "egyptian", sentiment: "mixed", aspects: [{ aspect: "longevity", sentiment: "mixed", evidence: "بتروح بسرعة" }, { aspect: "packaging", sentiment: "positive", evidence: "العلبة حلوة" }] },
    { index: 2, dialect: "msa", sentiment: "positive", aspects: [{ aspect: "packaging", sentiment: "positive", evidence: "تغليف فاخر" }] }
  ],
  fixes: [{ aspect: "longevity", target: "benefit", en: "Lasts 6 to 8 hours on skin", ar: "يثبت من ٦ إلى ٨ ساعات على البشرة" }]
};

test("schema accepts a well-formed analysis", () => {
  assert.ok(ReviewAnalysis.safeParse(sample).success);
  assert.ok(!ReviewAnalysis.safeParse({ ...sample, reviews: [{ ...sample.reviews[0], dialect: "klingon" }] }).success);
});

test("aggregates dialects and ranks negative themes first", () => {
  const a = aggregate(sample, 3);
  assert.deepEqual(a.dialects, { gulf: 1, egyptian: 1, msa: 1 });
  assert.equal(a.themes[0].aspect, "longevity");
  assert.equal(a.themes[0].negativeShare, 0.5);
  assert.equal(a.themes[1].positive, 2);
});
