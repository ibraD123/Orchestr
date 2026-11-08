// Creator: slide plans from data, competitor galleries, search preview score, season packs,
// image model routing, product checks and the AI-people label.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planSet, galleryGaps, standout, seasonPack, withoutSeason, normaliseThemes, TEMPLATE_KIND } from "../server/creator.mjs";
import { TEMPLATES } from "../server/templates.mjs";
import { analyseCompetitors, summariseGallery } from "../server/gallery.mjs";
import { searchMarketplace } from "../server/connectors/search.mjs";
import { labelPng, hasAiLabel, AI_SOURCE_TYPE } from "../server/ai-label.mjs";
import { crc32 } from "../server/zip.mjs";
import { exportReadme } from "../server/exports.mjs";
import { generateSlide, judgeImage } from "../server/slidegen.mjs";
import { generateImages, routeProviders, imageProviders, onModelPrompt } from "../server/imagegen.mjs";
import { setNetwork } from "../server/connectors/net.mjs";

const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=";

test("the plan answers what buyers complain about, what the audit found and what competitors miss", () => {
  const gaps = galleryGaps([{ kinds: ["main", "lifestyle"] }, { kinds: ["main", "lifestyle", "benefit"] }, { kinds: ["main", "lifestyle"] }, { kinds: ["main"] }], ["main"]);
  const plan = planSet({
    category: "fragrance", templates: TEMPLATES,
    themes: [["longevity", 62, 0], ["packaging", 14, 1]],
    issues: ["arabicBroken", "noArabicTitle"], gaps,
    performance: [{ id: "compare", verdict: "works", wins: 3, losses: 0, avgPts: 1.2 }]
  });
  assert.equal(plan[0].tpl, "cover", "the main image comes first");
  assert.ok(plan.length <= 7);
  const benefit = plan.find((x) => x.tpl === "benefit");
  assert.ok(benefit.reasons.some((r) => r.source === "review" && r.key === "longevity" && r.share === 0.62));
  assert.ok(plan.find((x) => x.tpl === "occasion").reasons.some((r) => r.source === "competitors" && r.mustHave), "3 of 4 competitors show lifestyle");
  assert.ok(plan.find((x) => x.tpl === "compare").reasons.some((r) => r.source === "sales"), "a slide that raised conversion is planned");
  assert.ok(plan.find((x) => x.tpl === "review").reasons.some((r) => r.positive), "what buyers love becomes a quote slide");
  assert.ok(!plan.some((x) => x.tpl === "sizechart"), "a size chart never goes on a perfume");
  assert.ok(plan.findIndex((x) => x.tpl === "benefit") < plan.findIndex((x) => x.tpl === "details"), "the complaint outranks the default");
});

test("fashion complaints about size bring the size chart; slides that hurt sales drop", () => {
  const plan = planSet({ category: "fashion", templates: TEMPLATES, themes: [{ aspect: "size_fit", pct: 48, sentiment: "negative" }], issues: ["noSizeChart"], performance: [{ id: "occasion", verdict: "hurts", wins: 0, losses: 2, avgPts: -0.8 }] });
  const sc = plan.find((x) => x.tpl === "sizechart");
  assert.ok(sc.reasons.some((r) => r.source === "review") && sc.reasons.some((r) => r.source === "audit"));
  assert.equal(plan[1].tpl, "sizechart");
  const occ = plan.find((x) => x.tpl === "occasion");
  assert.ok(!occ || occ.reasons.some((r) => r.hurts));
  assert.deepEqual(normaliseThemes([["size", 20, 0], { key: "colour", share: 0.1 }, ["x", 0, 0]]).map((t) => t.key), ["size", "colour"]);
});

test("gallery gaps: what most competitors show and what nobody does", () => {
  const comp = [
    { kinds: ["main", "lifestyle", "details"], arabic: true },
    { kinds: ["main", "lifestyle"], arabic: false },
    { kinds: ["main", "lifestyle", "details"], arabic: false },
    { kinds: ["main", "benefit"], arabic: false },
    { kinds: ["main", "lifestyle"], arabic: true }
  ];
  const g = galleryGaps(comp, ["main", "details"]);
  assert.equal(g.n, 5);
  assert.deepEqual(g.mustHave.map((k) => k.kind), ["lifestyle"]);
  assert.ok(g.whitespace.some((k) => k.kind === "sizechart") && g.whitespace.some((k) => k.kind === "review"));
  assert.ok(!g.whitespace.some((k) => k.kind === "details"), "we already have details");
  assert.equal(g.arabicShare, 0.4);
  assert.equal(galleryGaps([{ kinds: ["main"] }], []).whitespace.length, 0, "too few competitors to call anything whitespace");
  assert.equal(TEMPLATE_KIND.sizechart, "sizechart");
  assert.equal(TEMPLATE_KIND.ramadan, "seasonal");
});

test("standout: a distinct colour that fills the frame beats a look-alike", () => {
  const others = [{ colours: [[20, 20, 20]], fill: 0.7 }, { colours: [[30, 25, 20]], fill: 0.75 }, { colours: [[25, 25, 30]], fill: 0.72 }];
  const bold = standout({ colours: [[200, 160, 40]], fill: 0.9 }, others);
  const same = standout({ colours: [[24, 22, 22]], fill: 0.6 }, others);
  assert.ok(bold.score > 70, bold.score);
  assert.ok(same.score < 40, same.score);
  assert.ok(bold.notes.includes("distinctColour") && bold.notes.includes("fillsFrame"));
  assert.ok(same.notes.includes("sameColours") && same.notes.includes("smallerThanOthers"));
  assert.deepEqual(standout({ colours: [] }, others).notes, ["noData"]);
});

test("a season pack goes after the main image, replaces another season and rolls back", () => {
  const set = [{ tpl: "cover", fields: {} }, { tpl: "benefit", fields: { headEn: "Lasts" } }, { tpl: "eid", fields: {} }];
  const r = seasonPack(set, "ramadan");
  assert.deepEqual(r.set.map((s) => s.tpl), ["cover", "ramadan", "benefit"]);
  assert.deepEqual(r.backup.map((s) => s.tpl), ["cover", "benefit", "eid"]);
  r.backup[1].fields.headEn = "changed";
  assert.equal(set[1].fields.headEn, "Lasts", "the backup is a copy");
  assert.deepEqual(withoutSeason(r.set).map((s) => s.tpl), ["cover", "benefit"]);
  assert.throws(() => seasonPack(set, "christmas"));
});

test("competitor galleries are read image by image and summarised", async () => {
  const seen = [];
  const r = await analyseCompetitors({ links: ["https://www.noon.com/saudi-en/x/N1/p/", "https://bad.test/p"] }, {
    importLink: async (link) => { if (link.includes("bad")) throw new Error("refused"); return { items: [{ name: "Rival oud", listing: { images: [{ src: "https://cdn.test/1.jpg" }, { src: "https://cdn.test/2.jpg" }] } }] }; },
    load: async (src) => { seen.push(src); return PX; },
    classify: async (imgs) => ({ images: imgs.map((_, i) => ({ index: i, kind: i ? "sizechart" : "main", text: i ? "arabic" : "none", arabicBroken: i === 1, note: "" })) })
  });
  assert.equal(r.competitors.length, 2);
  assert.deepEqual(r.competitors[0].kinds, ["main", "sizechart"]);
  assert.equal(r.competitors[0].arabic, true);
  assert.equal(r.competitors[0].arabicBroken, true);
  assert.equal(r.competitors[0].image, "https://cdn.test/1.jpg");
  assert.match(r.competitors[1].error, /refused/);
  assert.deepEqual(seen, ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"]);
  assert.deepEqual(summariseGallery(null).kinds, []);
});

test("search: Amazon through SP-API only, Noon asks for links", async () => {
  await assert.rejects(searchMarketplace({ channel: "noon", query: "oud" }), (e) => e.status === 422 && /Paste the links/.test(e.message));
  await assert.rejects(searchMarketplace({ channel: "amazon", query: "oud" }, {}), (e) => e.status === 503);
  await assert.rejects(searchMarketplace({ channel: "amazon", query: " " }, {}), /Type what buyers search/);
  const urls = [];
  setNetwork({
    lookup: async () => [{ address: "93.184.216.34" }],
    fetch: async (url) => {
      urls.push(url);
      if (url.includes("/auth/o2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ items: [{ asin: "B0AAAAAAA1", summaries: [{ itemName: "Oud 100ml" }], images: [{ marketplaceId: "A17E79C6D8DWNP", images: [{ variant: "MAIN", link: "https://m.media-amazon.com/1.jpg", width: 1000, height: 1000 }] }] }, { asin: "B0AAAAAAA2", summaries: [], images: [] }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const c = { clientId: "id", clientSecret: "s", refreshToken: "r", endpoint: "https://sellingpartnerapi-eu.amazon.com", tokenUrl: "https://api.amazon.com/auth/o2/token" };
  const r = await searchMarketplace({ channel: "amazon", query: "oud perfume", host: "amazon.sa" }, c);
  assert.equal(r.items.length, 1, "results without an image are left out");
  assert.deepEqual(r.items[0], { sku: "B0AAAAAAA1", title: "Oud 100ml", image: "https://m.media-amazon.com/1.jpg", price: null, url: "https://www.amazon.sa/dp/B0AAAAAAA1" });
  assert.ok(urls.some((u) => u.includes("/catalog/2022-04-01/items?keywords=oud+perfume")));
});

test("images with AI-generated people carry the IPTC label and are listed in the README", () => {
  const png = Buffer.from(PX.split(",")[1], "base64");
  const out = labelPng(png);
  assert.ok(hasAiLabel(out) && !hasAiLabel(png));
  assert.ok(out.includes(Buffer.from(AI_SOURCE_TYPE)));
  // The new chunk sits right after IHDR and its CRC is valid.
  const at = 8 + 25, len = out.readUInt32BE(at), type = out.subarray(at + 4, at + 8).toString("latin1");
  assert.equal(type, "iTXt");
  assert.equal(out.readUInt32BE(at + 8 + len), crc32(out.subarray(at + 4, at + 8 + len)) >>> 0);
  assert.equal(out.subarray(at + 12 + len).toString("latin1").slice(4, 8), "IDAT");
  assert.deepEqual(labelPng(Buffer.from("not a png")), Buffer.from("not a png"));
  assert.match(exportReadme("amazon", 1, { aiPeople: ["images/oud/03.png"] }), /trainedAlgorithmicMedia[\s\S]*images\/oud\/03\.png/);
  assert.doesNotMatch(exportReadme("noon", 1, {}), /trainedAlgorithmicMedia/);
});

test("image models: text goes to Gemini first, scenes and people to OpenAI, with the brand model as a reference", async () => {
  const env = { OPENAI_IMAGE_KEY: "o", GEMINI_IMAGE_KEY: "g", GEMINI_IMAGE_MODEL: "nano" };
  assert.deepEqual(routeProviders("text", env).map((p) => p.name), ["gemini", "openai"]);
  assert.deepEqual(routeProviders("people", env).map((p) => p.name), ["openai", "gemini"]);
  assert.deepEqual(imageProviders({ IMAGE_PROVIDER: "openai", IMAGE_API_KEY: "k", GEMINI_IMAGE_KEY: "g" }).map((p) => p.name), ["gemini", "openai"]);
  const calls = [];
  setNetwork({
    lookup: async () => [{ address: "93.184.216.34" }],
    fetch: async (url, init) => { calls.push({ url, init }); const body = url.includes("openai") ? { data: [{ b64_json: "AAA" }] } : { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "BBB" } }] } }] }; return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }); }
  });
  assert.deepEqual(await generateImages({ prompt: "p", image: PX, refs: [PX], task: "people" }, env), ["data:image/png;base64,AAA"]);
  const form = calls[0].init.body;
  assert.equal(form.getAll("image[]").length, 2, "product and brand model");
  assert.equal(form.get("image"), null);
  assert.deepEqual(await generateImages({ prompt: "p", image: PX, refs: [PX], task: "text" }, env), ["data:image/png;base64,BBB"]);
  const g = JSON.parse(calls[1].init.body);
  assert.ok(calls[1].url.includes("/models/nano:generateContent"));
  assert.equal(g.contents[0].parts.length, 3);
  assert.equal(calls[1].init.headers["x-goog-api-key"], "g");
  await generateImages({ prompt: "p", image: PX, provider: "gemini", task: "people" }, env);
  assert.ok(calls[2].url.includes("generativelanguage"), "an explicit provider wins");
  assert.match(onModelPrompt({ sameModel: true }).prompt, /same person/);
  assert.doesNotMatch(onModelPrompt({}).prompt, /same person/);
});

test("best of two: each round asks both models and keeps the better image that passes", async () => {
  const GOOD = { overlayTexts: ["ثبات حتى ١٢ ساعة", "Lasts up to 12 hours"], arabicRendering: "correct", photorealPeople: true, problems: [] };
  const gens = [];
  const deps = {
    providers: () => ["gemini", "openai"],
    generate: async (req) => { gens.push(req); return ["data:image/png;base64," + req.provider]; },
    readBack: async () => GOOD,
    fidelity: async (a, img) => ({ ok: true, score: img.endsWith("gemini") ? 0.86 : 0.95 }),
    checkProduct: async () => ({ sameProduct: true, shape: "same", logo: "intact", problems: [] }),
    fit: async (img) => "fit:" + img, typeset: async () => "typeset", scene: async () => "scene"
  };
  const input = { template: "benefit", fields: { headAr: "ثبات حتى 12 ساعة", headEn: "Lasts up to 12 hours" }, image: PX, numerals: "arabic", language: "both", modelRef: PX };
  const r = await generateSlide(input, deps);
  assert.equal(r.image, "fit:data:image/png;base64,openai", "the closer colours win");
  assert.equal(r.provider, "openai");
  assert.equal(r.aiPeople, true);
  assert.deepEqual(gens.map((g) => g.provider), ["gemini", "openai"]);
  assert.ok(gens.every((g) => g.task === "text" && g.refs.length === 1 && /brand's model/.test(g.prompt)));

  // A product whose logo changed never passes, whatever its text.
  const changed = { ...deps, providers: () => ["openai"], checkProduct: async () => ({ sameProduct: true, shape: "same", logo: "changed", problems: ["logo misspelled"] }), readBack: async (img) => (gens.push(1), { ...GOOD, overlayTexts: img === "x" ? [] : GOOD.overlayTexts }) };
  const r2 = await generateSlide({ ...input, modelRef: undefined }, changed);
  assert.equal(r2.mode, "typeset");
  assert.ok(r2.attempts.some((a) => a.reasons.includes("logo changed")));
  const v = judgeImage({ expected: [{ text: "ثبات", lang: "ar" }], readback: { overlayTexts: ["ثبات"], arabicRendering: "correct" }, fidelity: { ok: true, score: 0.9 }, product: { sameProduct: false, shape: "changed", logo: "missing" } });
  assert.deepEqual(v.reasons, ["not the same product", "product shape changed", "logo missing"]);
});

test("fal.ai: one key runs both lanes, with the product and brand model as data URIs", async () => {
  const env = { FAL_KEY: "id:secret" };
  assert.deepEqual(routeProviders("text", env).map((p) => p.model), ["fal-ai/nano-banana-pro/edit", "openai/gpt-image-2.6/flare/edit"]);
  assert.deepEqual(routeProviders("text", { ...env, GEMINI_IMAGE_KEY: "g" }).map((p) => p.via || "direct"), ["direct", "fal"], "a direct key takes its lane");
  const calls = [];
  setNetwork({
    lookup: async () => [{ address: "93.184.216.34" }],
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("v3.fal.media")) return new Response(Buffer.from("PNGDATA"), { status: 200, headers: { "content-type": "image/png" } });
      const body = url.includes("nano") ? { images: [{ url: "data:image/png;base64,NANO" }], description: "" } : { images: [{ url: "https://v3.fal.media/files/x.png", content_type: "image/png" }] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  assert.deepEqual(await generateImages({ prompt: "p", image: PX, refs: [PX], task: "text", aspect: "4:5" }, env), ["data:image/png;base64,NANO"]);
  assert.equal(calls[0].url, "https://fal.run/fal-ai/nano-banana-pro/edit");
  assert.equal(calls[0].init.headers.Authorization, "Key id:secret");
  const b = JSON.parse(calls[0].init.body);
  assert.deepEqual([b.image_urls.length, b.aspect_ratio, b.sync_mode, b.output_format], [2, "4:5", true, "png"]);
  const people = await generateImages({ prompt: "p", image: PX, task: "people" }, env);
  assert.equal(calls[1].url, "https://fal.run/openai/gpt-image-2.6/flare/edit");
  assert.equal(JSON.parse(calls[1].init.body).aspect_ratio, undefined, "GPT Image sizes itself from the input");
  assert.deepEqual(people, ["data:image/png;base64," + Buffer.from("PNGDATA").toString("base64")], "a hosted result is downloaded");
  setNetwork({ lookup: async () => [{ address: "93.184.216.34" }], fetch: async () => new Response(JSON.stringify({ detail: [{ msg: "image_urls: invalid" }] }), { status: 422, headers: { "content-type": "application/json" } }) });
  await assert.rejects(generateImages({ prompt: "p", image: PX }, env), /image_urls: invalid/);
});

test("the language model goes through fal when there is no Anthropic key, and its JSON is checked", async () => {
  const { messagesParse, extractJson, toGateway, llmProvider } = await import("../server/llm.mjs");
  const { z } = await import("zod");
  assert.equal(llmProvider({ FAL_KEY: "k" }), "fal");
  assert.equal(llmProvider({ FAL_KEY: "k", ANTHROPIC_API_KEY: "a" }), "anthropic", "a direct key wins");
  assert.equal(llmProvider({}), null);
  assert.deepEqual(extractJson('Sure:\n```json\n{"a": "x {y}", "b": [1]}\n``` done'), { a: "x {y}", b: [1] });
  assert.equal(extractJson("no json"), null);
  const { jsonObjects } = await import("../server/llm.mjs");
  assert.deepEqual(jsonObjects('thinking: maybe {"kind":"x"} … final {"kind":"main","n":1}').length, 2, "reasoning before the answer is kept apart");
  const g = toGateway([{ role: "user", content: [{ type: "text", text: "Real product:" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } }, { type: "text", text: "Compare." }] }]);
  assert.equal(g.prompt, "Real product:\n[attached image 1]\nCompare.");
  assert.deepEqual(g.images, ["data:image/png;base64,AAA"]);

  const schema = z.object({ kind: z.enum(["main", "other"]), n: z.number() });
  const saved = { a: process.env.ANTHROPIC_API_KEY, t: process.env.ANTHROPIC_AUTH_TOKEN, f: process.env.FAL_KEY };
  delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN; process.env.FAL_KEY = "id:secret";
  try {
    const sent = [];
    const answers = ['{"kind": "banner", "n": 1}', 'Here you go: {"kind": "main", "n": 2}'];
    const net = async (url, opts) => { sent.push({ url, opts, body: JSON.parse(opts.body) }); return { status: 200, body: Buffer.from(JSON.stringify({ output: answers[sent.length - 1], usage: { cost: 0.001 } })) }; };
    const r = await messagesParse({ schema, model: "x", max_tokens: 500, system: "Classify.", messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } }, { type: "text", text: "What is it?" }] }] }, { net });
    assert.deepEqual(r.parsed_output, { kind: "main", n: 2 }, "an answer that breaks the schema is asked for again");
    assert.equal(sent.length, 2);
    assert.equal(sent[0].url, "https://fal.run/openrouter/router/vision");
    assert.equal(sent[0].opts.headers.Authorization, "Key id:secret");
    assert.equal(sent[0].body.model, "anthropic/claude-opus-5.5");
    assert.deepEqual(sent[0].body.image_urls, ["data:image/png;base64,AAA"]);
    assert.match(sent[0].body.system_prompt, /^Classify\.[\s\S]*JSON Schema[\s\S]*"enum":\["main","other"\]/);
    assert.match(sent[1].body.prompt, /not valid JSON for the schema \(kind:/);
    assert.equal(sent[0].body.reasoning, true, "the gateway needs reasoning on");
    const bad = await messagesParse({ schema, messages: [{ role: "user", content: "x" }] }, { net: async () => ({ status: 200, body: Buffer.from('{"output":"nope"}') }) });
    assert.equal(bad.parsed_output, null);
    await assert.rejects(messagesParse({ schema, messages: [] }, { net: async () => ({ status: 429, body: Buffer.from('{"detail":"rate limited"}') }) }), (e) => e.status === 429 && /rate limited/.test(e.message));
  } finally {
    for (const [k, v] of [["ANTHROPIC_API_KEY", saved.a], ["ANTHROPIC_AUTH_TOKEN", saved.t], ["FAL_KEY", saved.f]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test("Noon: JPEG exports, a search card on white, its rules as a risk, and the AI label in JPEGs", async () => {
  const { templateHTML, templateById } = await import("../server/templates.mjs");
  const { planSlide, slidePrompt } = await import("../server/textcheck.mjs");
  const { auditListing } = await import("../server/audit.mjs");
  const { mainImageChecks } = await import("../server/photo-metrics.mjs");
  const { labelJpeg, labelImage } = await import("../server/ai-label.mjs");
  assert.equal(templateById("searchcard").risk, "noonMain");
  const html = templateHTML("searchcard", { headAr: "ثبات 12 ساعة", headEn: "Lasts 12 hours", badgeAr: "عود", badgeEn: "Oud" }, { image: PX, language: "both", numerals: "arabic" });
  assert.ok(html.includes("#FFFFFF") && html.includes("ثبات ١٢ ساعة") && html.includes("Oud"));
  assert.equal(planSlide("searchcard", { headAr: "ثبات حتى 12 ساعة", headEn: "Lasts" }).mode, "generate");
  assert.match(slidePrompt({ templateId: "searchcard", texts: [] }), /pure white background[\s\S]*No border, no price/);
  assert.equal(TEMPLATE_KIND.searchcard, "main");

  const listing = { channel: "noon", category: "fragrance", titleEn: "Oud Al Layl Eau de Parfum 100ml for men and women", titleAr: "عطر عود الليل ١٠٠ مل", bulletsEn: ["a", "b", "c", "d"], bulletsAr: ["أ"], images: [{ whiteBackground: false, width: 1600, height: 2000, fill: 0.75 }, {}, {}, {}] };
  const noon = auditListing(listing).issues.find((i) => i.key === "mainRule");
  assert.equal(noon.sev, "low", "on Noon a designed main image is a risk, not a sure rejection");
  assert.equal(auditListing({ ...listing, channel: "amazon" }).issues.find((i) => i.key === "mainRule").sev, "med");
  assert.ok(!auditListing(listing).issues.some((i) => i.key === "productSmall"), "75% of the frame is enough on Noon");
  const checks = Object.fromEntries(mainImageChecks({ width: 800, height: 1000, whiteShare: 0.95, fill: 0.72, transparent: false }, "noon").map((c) => [c.key, c.ok]));
  assert.deepEqual(checks, { size: true, white: true, fill: true, square: true }, "4:5 at 800 px passes Noon");
  assert.equal(mainImageChecks({ width: 800, height: 1000, whiteShare: 0.95, fill: 0.72 }, "amazon").find((c) => c.key === "square").ok, false);

  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xd9]);
  const out = labelJpeg(jpg);
  assert.deepEqual([...out.subarray(0, 4)], [0xff, 0xd8, 0xff, 0xe1]);
  assert.equal(out.readUInt16BE(4) + 2, out.length - jpg.length, "the APP1 length covers the segment after its marker");
  assert.ok(hasAiLabel(out));
  assert.ok(hasAiLabel(labelImage(Buffer.from(PX.split(",")[1], "base64"))), "PNG goes the PNG way");
  assert.match(exportReadme("noon", 1, {}), /JPEG/);
});

test("gallery video: Kling or Veo input, the fal queue, and frames checked for added text and a changed product", async () => {
  const { videoPrompt, videoInput, falVideo, generateVideo, VIDEO_MODEL } = await import("../server/videogen.mjs");
  assert.match(videoPrompt({ product: "Oud 100ml" }), /Do not add any text[\s\S]*No cuts/);
  assert.match(videoPrompt({ scene: true }), /Animate this scene/);
  assert.deepEqual(videoInput("fal-ai/kling-video/o3/standard/image-to-video", { image: PX, prompt: "p", seconds: 6 }), { image_url: PX, prompt: "p", duration: "6", generate_audio: false });
  const veo = videoInput("fal-ai/veo3.1/image-to-video", { image: PX, prompt: "p", seconds: 5 });
  assert.deepEqual([veo.duration, veo.aspect_ratio, veo.generate_audio, veo.resolution], ["6s", "9:16", false, "1080p"]);
  assert.equal(VIDEO_MODEL(), "fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video", "the cheapest model is the default");
  assert.deepEqual(videoInput("fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video", { image: PX, prompt: "p", seconds: 8 }), { image_url: PX, prompt: "p", duration: "10", prompt_optimizer: false });
  assert.equal(videoInput("fal-ai/minimax/hailuo-02/pro/image-to-video", { image: PX, prompt: "p", seconds: 6 }).duration, "6");

  const saved = process.env.FAL_KEY; process.env.FAL_KEY = "id:s";
  try {
    const calls = []; let polls = 0;
    const net = async (url, opts = {}) => {
      calls.push({ url, method: opts.method || "GET" });
      const res = (o) => ({ status: 200, body: Buffer.from(JSON.stringify(o)) });
      if (url === "https://queue.fal.run/fal-ai/kling-video/o3/standard/image-to-video") return res({ request_id: "r1", status_url: "https://queue.fal.run/fal-ai/kling-video/requests/r1/status", response_url: "https://queue.fal.run/fal-ai/kling-video/requests/r1" });
      if (url.endsWith("/status")) return res({ status: ++polls < 2 ? "IN_PROGRESS" : "COMPLETED" });
      if (url.endsWith("/requests/r1")) return res({ video: { url: "https://v3.fal.media/files/v.mp4" } });
      return { status: 200, body: Buffer.from("MP4DATA") };
    };
    const r = await falVideo({ image_url: PX, prompt: "p" }, { net, wait: async () => {}, model: "fal-ai/kling-video/o3/standard/image-to-video" });
    assert.equal(r.video.toString(), "MP4DATA");
    assert.deepEqual(calls.map((c) => c.method + " " + c.url.replace(/^https:\/\/[^/]+\//, "")), ["POST fal-ai/kling-video/o3/standard/image-to-video", "GET fal-ai/kling-video/requests/r1/status", "GET fal-ai/kling-video/requests/r1/status", "GET fal-ai/kling-video/requests/r1", "GET files/v.mp4"]);
  } finally { if (saved === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = saved; }

  // Checks: text added on a frame fails the first try; the second passes.
  let n = 0;
  const deps = {
    generate: async () => ({ video: Buffer.from("V" + (++n)), model: "kling" }),
    frames: async (v) => [v.toString() + "a", v.toString() + "b", v.toString() + "c"],
    readBack: async (f) => ({ overlayTexts: f.startsWith("V1") && f.endsWith("b") ? ["SALE 50%"] : [], productTexts: ["LAYALI"], arabicRendering: "none", photorealPeople: false }),
    checkProduct: async () => ({ sameProduct: true, shape: "same", logo: "intact", problems: [] })
  };
  const ok = await generateVideo({ image: PX, product: "Oud" }, deps);
  assert.equal(ok.ok, true);
  assert.equal(ok.video.toString(), "V2");
  assert.match(ok.attempts[0].reasons.join(), /frame 2: text added \(SALE 50%\)/);
  // Text that was already on the slide may stay; a changed product never passes.
  const kept = await generateVideo({ image: PX, texts: ["ثبات حتى ١٢ ساعة"] }, { ...deps, readBack: async () => ({ overlayTexts: ["ثبات حتى ١٢ ساعة"], arabicRendering: "correct" }) });
  assert.equal(kept.ok, true);
  const bad = await generateVideo({ image: PX }, { ...deps, checkProduct: async () => ({ sameProduct: true, shape: "changed", logo: "intact", problems: ["cap is different"] }) });
  assert.equal(bad.ok, false);
  assert.equal(bad.video, null);
  assert.match(bad.attempts[1].reasons.join(), /product changed \(cap is different\)/);
  await assert.rejects(generateVideo({ image: "data:video/mp4;base64,AA" }, deps), /PNG, JPEG or WebP/);
});
