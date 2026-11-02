// Review intelligence: Claude reads buyer reviews in any Arabic dialect or English,
// tags dialect, sentiment and aspects, and proposes content fixes.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

export const MODEL = process.env.BASIRA_MODEL || "claude-opus-5-5";
export const ASPECTS = ["size_fit", "fabric_material", "colour_accuracy", "longevity", "scent_strength", "taste", "freshness", "quality", "packaging", "delivery", "price_value", "authenticity", "other"];
export const DIALECTS = ["gulf", "egyptian", "levantine", "maghrebi", "msa", "english", "other"];
const SENTIMENTS = ["positive", "negative", "mixed", "neutral"];
const SLIDES = ["cover", "benefit", "details", "occasion", "title", "bullets", "size_chart"];

export const ReviewAnalysis = z.object({
  reviews: z.array(z.object({
    index: z.number().int(),
    dialect: z.enum(DIALECTS),
    sentiment: z.enum(SENTIMENTS),
    aspects: z.array(z.object({
      aspect: z.enum(ASPECTS),
      sentiment: z.enum(SENTIMENTS),
      evidence: z.string()
    }))
  })),
  fixes: z.array(z.object({
    aspect: z.enum(ASPECTS),
    target: z.enum(SLIDES),
    en: z.string(),
    ar: z.string()
  }))
});

const SYSTEM = `You analyse marketplace product reviews for Basira, a content tool used by sellers on Amazon, Noon, Salla, Zid and Shopify in the Gulf and Egypt.

For every review, identify:
- dialect: the variety of Arabic it is written in (gulf, egyptian, levantine, maghrebi, msa), or english, or other. Arabizi (Arabic in Latin letters) counts as the dialect it represents.
- overall sentiment.
- every product aspect the buyer comments on, with the aspect's own sentiment and the shortest verbatim span from the review that shows it (copy it exactly, in the original language).

Delivery, courier and seller-service complaints are aspect "delivery"; they are not problems the product listing can fix.

Then propose up to 4 listing fixes for the negative aspects that listing content can address (size advice on a size chart, an honest longevity claim on a benefit slide, colour shown in daylight, clearer details). Each fix names where it goes and gives the wording a seller would publish: "en" in plain English and "ar" in natural Gulf-market Arabic, not a literal translation. Never propose medical or health claims, and never promise more than the reviews support.`;

/** Count dialects and aspect sentiment across analysed reviews. Pure, so it is unit tested. */
export function aggregate(analysis, total) {
  const dialects = {};
  const aspects = {};
  for (const r of analysis.reviews) {
    dialects[r.dialect] = (dialects[r.dialect] || 0) + 1;
    for (const a of r.aspects) {
      const row = aspects[a.aspect] || (aspects[a.aspect] = { aspect: a.aspect, positive: 0, negative: 0, mixed: 0, neutral: 0, mentions: 0 });
      row[a.sentiment] += 1;
      row.mentions += 1;
    }
  }
  const themes = Object.values(aspects)
    .map((t) => ({ ...t, negativeShare: total ? Math.round(((t.negative + t.mixed / 2) / total) * 100) / 100 : 0 }))
    .sort((a, b) => b.negative - a.negative || b.mentions - a.mentions);
  return { total, dialects, themes };
}

let client = null;
export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Analyse up to 200 reviews for one product.
 * @param {{ product?: string, reviews: Array<string | { text: string, rating?: number }> }} input
 */
export async function analyseReviews(input) {
  const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
  const list = (input?.reviews || []).map((r) => (typeof r === "string" ? { text: r } : r)).filter((r) => r && String(r.text || "").trim());
  if (!list.length) fail("Send at least one review");
  if (list.length > 200) fail("Send at most 200 reviews per request");
  if (!aiConfigured()) fail("Review analysis needs ANTHROPIC_API_KEY on the server", 503);
  client ||= new Anthropic();

  const numbered = list.map((r, i) => `[${i}]${r.rating ? ` (${r.rating}★)` : ""} ${String(r.text).trim().slice(0, 2000)}`).join("\n");
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ReviewAnalysis) },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `Product: ${String(input.product || "unknown").slice(0, 200)}\n\nReviews (index in brackets):\n${numbered}`
    }]
  });

  if (response.stop_reason === "refusal") fail("The model declined to analyse these reviews", 422);
  if (response.stop_reason === "max_tokens") fail("Too many reviews for one request; send fewer", 413);
  const analysis = response.parsed_output;
  if (!analysis) fail("The model returned an unreadable analysis", 502);
  analysis.reviews = analysis.reviews.filter((r) => r.index >= 0 && r.index < list.length);
  return { model: response.model, ...aggregate(analysis, list.length), reviews: analysis.reviews, fixes: analysis.fixes };
}
