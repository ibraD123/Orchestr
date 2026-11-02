// Photo review with Claude: critique main-image candidates and pick the one most likely to earn the click.
// This is a model's judgement before launch, not a measured click-through rate.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MODEL, aiConfigured } from "./reviews.mjs";

const Score = z.number().int().min(1).max(10);
export const PhotoReview = z.object({
  photos: z.array(z.object({
    index: z.number().int(),
    scores: z.object({ clarity: Score, lighting: Score, focus: Score, thumbnail: Score, trust: Score }),
    arabicText: z.enum(["none", "correct", "broken"]),
    strengths: z.array(z.object({ en: z.string(), ar: z.string() })),
    problems: z.array(z.object({ en: z.string(), ar: z.string() }))
  })),
  winner: z.number().int(),
  why: z.object({ en: z.string(), ar: z.string() })
});

const SYSTEM = `You review product photos for marketplace listings on Amazon, Noon, Salla and Zid in the Gulf and Egypt, before the seller publishes them.

For each photo score 1-10:
- clarity: sharpness and resolution of the product
- lighting: even, natural colour, no harsh shadows or colour cast
- focus: the product is the obvious subject and fills the frame; no clutter
- thumbnail: still readable and recognisable at the small size shown in search results on a phone
- trust: looks like a real, well-made product a buyer would trust; no misleading props

arabicText: "none" if the photo has no Arabic text, "correct" if Arabic letters are properly joined and read right to left, "broken" if letters are disconnected, reversed or malformed (a common fault of AI image generators).

List up to 3 strengths and up to 3 problems, each in plain English and natural Gulf-market Arabic, concrete enough to act on ("product fills only half the frame; crop tighter").

Then pick the winner: the photo most likely to be clicked in search results as a main image, and say why in one or two sentences. If there is only one photo, it is the winner. Judge only what you can see.`;

let client = null;

/** @param {{ photos: string[], product?: string, channel?: string }} input  photos are base64 data URLs */
export async function reviewPhotos(input) {
  const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
  const photos = Array.isArray(input?.photos) ? input.photos : [];
  if (!photos.length) fail("Send at least one photo");
  if (photos.length > 4) fail("Send at most 4 photos");
  const blocks = photos.map((p, i) => {
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(p));
    if (!m) fail(`Photo ${i + 1} must be a PNG, JPEG, WebP or GIF data URL`);
    if (m[2].length > 6_500_000) fail(`Photo ${i + 1} is larger than 5 MB; resize it first`);
    return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  });
  if (!aiConfigured()) fail("Photo review needs ANTHROPIC_API_KEY on the server", 503);
  client ||= new Anthropic();
  const content = [];
  blocks.forEach((b, i) => { content.push({ type: "text", text: `Photo ${i} (index ${i}):` }); content.push(b); });
  content.push({ type: "text", text: `Product: ${String(input.product || "unknown").slice(0, 200)}. Channel: ${String(input.channel || "noon").slice(0, 20)}. Review every photo and pick the winner.` });
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(PhotoReview) },
    system: SYSTEM,
    messages: [{ role: "user", content }]
  });
  if (response.stop_reason === "refusal") fail("The model declined to review these photos", 422);
  const out = response.parsed_output;
  if (!out) fail("The model returned an unreadable review", 502);
  out.photos = out.photos.filter((p) => p.index >= 0 && p.index < photos.length);
  if (out.winner < 0 || out.winner >= photos.length) out.winner = 0;
  return { model: response.model, ...out };
}
