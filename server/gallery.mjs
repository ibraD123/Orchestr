// Competitor galleries: find the listings a buyer sees next to ours, then read what each of
// their images shows (main photo, size chart, lifestyle, comparison…) so Creator can plan the
// slides they all have and the ones nobody shows (server/creator.mjs → galleryGaps, planSet).
import { z } from "zod";
import { messagesParse } from "./llm.mjs";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MODEL, aiConfigured } from "./reviews.mjs";
import { GALLERY_KINDS } from "./creator.mjs";
import { safeFetch, ConnectorError } from "./connectors/net.mjs";
import { importLink } from "./importer.mjs";

export const MAX_COMPETITORS = 8;
export const MAX_IMAGES = 7;

export const GalleryReading = z.object({
  images: z.array(z.object({
    index: z.number().int(),
    kind: z.enum(GALLERY_KINDS),
    text: z.enum(["none", "arabic", "english", "both"]),
    arabicBroken: z.boolean(),
    note: z.string()
  }))
});

const SYSTEM = `You classify product listing images from Amazon and Noon in the Gulf, so a seller can see what competitors show buyers.

For each image, in order, give:
kind: main (product alone, plain background), lifestyle (product in use or in a setting, no person in focus), model (worn or held by a person), benefit (one headline claim with the product), details (materials, ingredients, close-ups with callouts), sizechart (sizes or measurements table), dimensions (product size with arrows or a scale reference), notes (fragrance notes pyramid), howto (steps or instructions), inbox (what's in the box), compare (product vs others or vs "ordinary"), review (a buyer quote or star rating), trust (delivery, returns, cash on delivery, guarantees, authenticity badges), seasonal (Ramadan, Eid, National Day, sale event), other.
text: which languages appear in text added to the image (not text printed on the product itself).
arabicBroken: true if Arabic text on the image has disconnected or reversed letters, or invented glyphs.
note: five words or fewer on what the image says, in English.`;


/** Read what each image of one gallery shows. images: data URLs, in gallery order. */
export async function classifyGallery(images) {
  if (!aiConfigured()) { const e = new Error("Reading competitor galleries needs FAL_KEY or ANTHROPIC_API_KEY on the server"); e.status = 503; throw e; }
  const list = images.slice(0, MAX_IMAGES).map((src) => /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(src || ""))).filter(Boolean);
  if (!list.length) return { images: [] };
  const content = list.flatMap((m, i) => [{ type: "text", text: `Image ${i}:` }, { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }]);
  const response = await messagesParse({ schema: GalleryReading,
    model: MODEL,
    max_tokens: 3000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(GalleryReading) },
    system: SYSTEM,
    messages: [{ role: "user", content: content.concat([{ type: "text", text: "Classify every image." }]) }]
  });
  if (!response.parsed_output) { const e = new Error("The model returned an unreadable gallery reading"); e.status = 502; throw e; }
  return response.parsed_output;
}

/** One gallery reading → the summary galleryGaps needs. */
export function summariseGallery(reading) {
  const imgs = (reading && reading.images) || [];
  return {
    kinds: [...new Set(imgs.map((i) => i.kind))],
    arabic: imgs.some((i) => i.text === "arabic" || i.text === "both"),
    arabicBroken: imgs.some((i) => i.arabicBroken),
    images: imgs.map((i) => ({ kind: i.kind, text: i.text, arabicBroken: i.arabicBroken, note: i.note }))
  };
}

async function toDataUrl(src) {
  if (/^data:image\//.test(src)) return src;
  const r = await safeFetch(src, { maxBytes: 5_000_000, headers: { Accept: "image/png,image/jpeg,image/webp" } });
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) throw new ConnectorError("Not an image");
  return `data:${type};base64,${r.body.toString("base64")}`;
}

/**
 * Import each competitor listing, read its gallery and summarise it.
 * @param {{ links?: string[], items?: Array<{ url?, title?, images: string[] }> }} body
 * @param {{ classify?, load? }} deps injectable for tests
 */
export async function analyseCompetitors(body, deps = {}) {
  const classify = deps.classify || classifyGallery;
  const load = deps.load || toDataUrl;
  const items = [];
  for (const it of (body.items || []).slice(0, MAX_COMPETITORS)) items.push({ url: it.url || null, title: it.title || "", images: (it.images || []).slice(0, MAX_IMAGES) });
  for (const link of (body.links || []).slice(0, MAX_COMPETITORS - items.length)) {
    try {
      const r = await (deps.importLink || importLink)(link, { measure: false });
      const it = r.items[0];
      if (it) items.push({ url: link, title: it.name, images: it.listing.images.map((i) => i.src).filter(Boolean).slice(0, MAX_IMAGES) });
    } catch (e) { items.push({ url: link, title: "", images: [], error: e.message }); }
  }
  if (!items.length) throw new ConnectorError("Add competitor links or search results first");
  const out = [];
  for (const it of items) {
    if (!it.images.length) { out.push({ ...it, kinds: [], arabic: false, error: it.error || "No images found" }); continue; }
    const loaded = (await Promise.all(it.images.map((s) => load(s).catch(() => null)))).filter(Boolean);
    const reading = await classify(loaded);
    out.push({ url: it.url, title: it.title, image: it.images[0], ...summariseGallery(reading) });
  }
  return { competitors: out };
}
