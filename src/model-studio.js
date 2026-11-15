// Creator → Models: build a reusable AI model from a starting look and a few traits, read the
// "model passport" (the exact brief that goes to the image model), generate, then use the saved
// model for try-on and runway video. Replaces the older single-form cwModels().
var ms = { preset: "gulf-woman", gender: "woman", look: "gulf", cover: "hijab", age: "29", ageCustom: "", build: "average", hair: "black", setting: "studio", passport: "", edited: false, name: "", lastId: null };

var MS_PRESETS = [
  { id: "gulf-woman", en: "Gulf · hijab", ar: "خليجية · حجاب", t: { gender: "woman", look: "gulf", cover: "hijab", age: "29", build: "average", hair: "black" } },
  { id: "gulf-man", en: "Gulf · man", ar: "خليجي", t: { gender: "man", look: "gulf", cover: "none", age: "29", build: "athletic", hair: "black" } },
  { id: "levant-woman", en: "Levantine", ar: "شامية", t: { gender: "woman", look: "levant", cover: "none", age: "21", build: "slim", hair: "brown" } },
  { id: "north-africa-man", en: "North African", ar: "مغاربي", t: { gender: "man", look: "northAfrica", cover: "none", age: "39", build: "average", hair: "black" } },
  { id: "south-asia-woman", en: "South Asian", ar: "جنوب آسيوية", t: { gender: "woman", look: "southAsia", cover: "none", age: "29", build: "average", hair: "black" } },
  { id: "curvy-woman", en: "Plus-size", ar: "مقاسات كبيرة", t: { gender: "woman", look: "any", cover: "none", age: "39", build: "plus", hair: "brown" } }
];
var MS_LOOKS = [["gulf", "Gulf", "خليجي"], ["levant", "Levantine", "شامي"], ["northAfrica", "North African", "مغاربي"], ["southAsia", "South Asian", "جنوب آسيوي"], ["any", "Open", "مفتوح"]];
var MS_AGES = [["21", "18–24"], ["29", "25–34"], ["39", "35–44"], ["50", "45+"]];
var MS_BUILDS = [["slim", "Slim", "نحيفة"], ["average", "Average", "متوسطة"], ["athletic", "Athletic", "رياضية"], ["curvy", "Curvy", "ممتلئة"], ["plus", "Plus-size", "كبيرة"]];
var MS_HAIR = [["black", "#1d1714", "Black", "أسود"], ["brown", "#56362a", "Dark brown", "بني داكن"], ["blonde", "#d6b57a", "Blonde", "أشقر"], ["red", "#9a4a2c", "Auburn", "كستنائي"], ["grey", "#aaa59e", "Grey", "رمادي"]];
var MS_SETTINGS = [["studio", "Studio", "استوديو"], ["home", "UAE home", "منزل إماراتي"], ["outdoor", "City daylight", "المدينة نهاراً"], ["majlis", "Majlis", "مجلس"]];

function msLabel(list, key, i) { var x = list.find(function (r) { return r[0] === key; }); return x ? (state.lang === "ar" ? x[i + 1] : x[i]) : ""; }
function msAge() { var n = parseInt(ms.ageCustom || ms.age, 10); return isFinite(n) ? Math.min(70, Math.max(18, n)) : 29; }
function msRate() { return typeof proRate === "function" ? proRate("model") : 4; }

/** The brief shown in the passport and sent as the model prompt. Server-side styling adds the same
 * traits as structured fields, so an edited passport can only add direction, not remove the rules. */
function msCompose() {
  var ar = state.lang === "ar", woman = ms.gender === "woman", age = msAge();
  var look = { gulf: ar ? "ملامح خليجية" : "Gulf Arab appearance", levant: ar ? "ملامح شامية" : "Levantine appearance", northAfrica: ar ? "ملامح مغاربية" : "North African appearance", southAsia: ar ? "ملامح جنوب آسيوية" : "South Asian appearance", any: ar ? "ملامح حسب التوجيه" : "appearance open to the brief" }[ms.look];
  var place = { studio: ar ? "خلفية استوديو رمادية فاتحة" : "light grey seamless studio background", home: ar ? "منزل إماراتي عصري" : "a contemporary UAE home", outdoor: ar ? "مدينة إماراتية في ضوء النهار" : "a UAE city in soft daylight", majlis: ar ? "مجلس بإضاءة دافئة" : "a majlis in warm natural light" }[ms.setting];
  var build = msLabel(MS_BUILDS, ms.build, 1).toLowerCase();
  var hair = ms.cover === "hijab" ? (ar ? "ترتدي حجاباً مرتباً" : "wearing a neat hijab") : (ar ? "شعر " + msLabel(MS_HAIR, ms.hair, 2) : msLabel(MS_HAIR, ms.hair, 2).toLowerCase() + " hair");
  if (ar) return "صورة كاملة لعارض" + (woman ? "ة" : "") + " بالغ" + (woman ? "ة" : "") + ". " + look + "، العمر نحو " + age + "، بنية " + build + "، " + hair + ". قميص رمادي فاتح وبنطال بيج وحذاء أبيض بسيط، " + place + ". وقفة مستقيمة مواجهة للكاميرا وتعبير هادئ.";
  return "Full-length photo of an adult " + (woman ? "woman" : "man") + ". " + look + ", about " + age + ", " + build + " build, " + hair + ". Plain light grey t-shirt, beige trousers and simple white sneakers, " + place + ". Standing straight, facing the camera, calm neutral expression.";
}
function msRefresh() { if (!ms.edited) ms.passport = msCompose(); }
function msApply(t) { Object.assign(ms, t, { ageCustom: "" }); ms.edited = false; msRefresh(); }

function msChips(key, list, labelIndex) {
  return '<div class="ms-chips">' + list.map(function (r) { return '<button type="button" data-ms-set="' + key + '" data-ms-value="' + r[0] + '" aria-pressed="' + (ms[key] === r[0] && !(key === "age" && ms.ageCustom)) + '">' + (labelIndex == null ? r[1] : (state.lang === "ar" ? r[labelIndex + 1] : r[labelIndex])) + '</button>'; }).join("") + '</div>';
}

function msPreview() {
  var m = cw.models.find(function (x) { return x.id === ms.lastId; }), p = cwProject();
  if (cw.busy && /model|عارض/i.test(String(cw.busy))) return '<div class="ms-preview ms-preview-busy"><span class="ms-spinner"></span><b>' + cwt("Generating your model…", "جارٍ توليد العارض…") + '</b><p>' + cwt("It will appear here and in My models.", "سيظهر هنا وفي عارضيّ.") + '</p></div>';
  if (m) return '<div class="ms-preview ms-preview-done"><img src="' + esc(m.asset.url) + '" alt="' + esc(m.name) + '"><div class="ms-preview-bar"><div><b>' + esc(m.name) + '</b><small>' + cwt("Saved to My models · review before client use", "حُفظ في عارضيّ · راجعه قبل استخدامه للعميل") + '</small></div><div class="cw-actions">' + cwButton("model-tryon", cwt("Try on a product", "جرّب منتجاً"), true, !p || !state.api.ai || !state.api.imageGen, ' data-model="' + m.id + '"') + '<button type="button" class="btn btn-ghost btn-sm" data-ms-again>' + cwt("Generate another", "ولّد غيره") + '</button></div>' + (!p ? '<p class="note">' + cwt("Pick a product project in My models to try products on.", "اختر مشروع منتج في عارضيّ لتجربة المنتجات.") + '</p>' : '') + '</div></div>';
  var pre = MS_PRESETS.find(function (x) { return x.id === ms.preset; }) || MS_PRESETS[0];
  return '<div class="ms-preview"><img class="ms-ghost" src="/assets/models/' + pre.id + '.webp" alt=""><div class="ms-preview-copy"><b>' + cwt("This is roughly how your model will look", "هكذا سيبدو العارض تقريباً") + '</b><p>' + cwt("Set the traits on the left and press Generate. The result is saved to this client's My models.", "اضبط الصفات على اليسار واضغط توليد. تُحفظ النتيجة في عارضي هذا العميل.") + '</p></div></div>';
}

function msLibrary() {
  return '<section class="ms-library" id="ms-library"><div class="ms-library-head"><div><h2>' + cwt("My models", "عارضيّ") + ' <span>' + cw.models.length + '</span></h2><p>' + cwt("Saved for this client. Use them for try-on and runway video.", "محفوظون لهذا العميل. استخدمهم للتجربة وفيديو العرض.") + '</p></div><select class="sel" id="cw-project-pick" aria-label="' + cwt("Product project for try-on", "مشروع المنتج للتجربة") + '"><option value="">' + cwt("Product project for try-on…", "مشروع المنتج للتجربة…") + '</option>' + cw.projects.map(function (p) { return '<option value="' + p.id + '"' + (p.id === cw.projectId ? " selected" : "") + '>' + esc(p.name) + '</option>'; }).join("") + '</select></div>' +
    (cw.models.length ? '<div class="ms-lib-grid">' + cw.models.slice().reverse().map(function (m) {
      var p = cwProject(), trySlot = p && p.slots.find(function (s) { return s.kind === "tryon" && s.revisions.some(function (r) { return r.model === m.id && r.id === s.selected[r.language] && r.review.status === "approved"; }); });
      return '<article class="ms-card"><img src="' + esc(m.asset.url) + '" alt="' + esc(m.name) + '"><div class="ms-card-body"><b>' + esc(m.name) + '</b><small>' + (m.aiPeople ? cwt("AI-generated", "مولّد بالذكاء الاصطناعي") : cwt("Uploaded photo", "صورة مرفوعة")) + '</small><div class="cw-actions">' + cwButton("model-tryon", cwt("Try on", "تجربة"), true, !p || !state.api.ai || !state.api.imageGen, ' data-model="' + m.id + '"') + cwButton("model-runway", cwt("Runway", "عرض"), false, !trySlot || !state.api.videoGen || !state.api.render || !state.api.ai, ' data-model="' + m.id + '" data-slot="' + (trySlot ? trySlot.id : "") + '"') + '</div></div></article>';
    }).join("") + '</div>' : '<div class="ms-lib-empty">' + cwt("No models yet. Your first one will appear here.", "لا يوجد عارضون بعد. سيظهر أولهم هنا.") + '</div>') + '</section>';
}

function modelStudio() {
  msRefresh();
  var can = state.api.imageGen, hijab = ms.cover === "hijab", rate = msRate();
  var presets = MS_PRESETS.map(function (p) { return '<button type="button" class="ms-preset" data-ms-preset="' + p.id + '" aria-pressed="' + (ms.preset === p.id) + '"><img src="/assets/models/' + p.id + '.webp" alt="" loading="lazy"><span>' + cwt(p.en, p.ar) + '</span></button>'; }).join("") +
    '<button type="button" class="ms-preset ms-preset-icon" data-ms-random><span class="ms-dice" aria-hidden="true"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/></svg></span><span>' + cwt("Surprise me", "مفاجأة") + '<small>' + cwt("random traits", "صفات عشوائية") + '</small></span></button>' +
    '<button type="button" class="ms-preset ms-preset-icon" data-ms-library><span class="ms-stack" aria-hidden="true">' + (cw.models.length ? '' : '<svg class="ms-people" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="16.5" cy="9" r="2.6"/><path d="M15.5 14.2c2.6-.3 4.6 1.2 5 4.3"/></svg>') + cw.models.slice(-3).map(function (m) { return '<img src="' + esc(m.asset.url) + '" alt="">'; }).join("") + '</span><span>' + cwt("My models", "عارضيّ") + '<small>' + cw.models.length + ' ' + cwt("saved", "محفوظ") + '</small></span></button>';
  var left = '<div class="ms-panel ms-build"><div class="ms-row-head"><h3>' + cwt("Start from", "ابدأ من") + '</h3><span class="ms-hint">' + cwt("1 click sets every trait", "نقرة واحدة تضبط كل الصفات") + '</span></div><div class="ms-presets">' + presets + '</div>' +
    '<div class="ms-traits">' +
    '<div class="ms-trait"><h4>' + cwt("Gender", "الجنس") + '</h4><div class="ms-seg">' + [["woman", "Woman", "امرأة"], ["man", "Man", "رجل"]].map(function (g) { return '<button type="button" data-ms-set="gender" data-ms-value="' + g[0] + '" aria-pressed="' + (ms.gender === g[0]) + '">' + cwt(g[1], g[2]) + '</button>'; }).join("") + '</div></div>' +
    (ms.gender === "woman" ? '<div class="ms-trait"><h4>' + cwt("Head covering", "غطاء الرأس") + '</h4>' + msChips("cover", [["hijab", "Hijab", "حجاب"], ["none", "None", "بدون"]], 1) + '</div>' : '') +
    '<div class="ms-trait"><h4>' + cwt("Appearance", "الملامح") + '</h4>' + msChips("look", MS_LOOKS, 1) + '</div>' +
    '<div class="ms-trait"><h4>' + cwt("Age", "العمر") + '</h4><div class="ms-chips">' + MS_AGES.map(function (a) { return '<button type="button" data-ms-set="age" data-ms-value="' + a[0] + '" aria-pressed="' + (ms.age === a[0] && !ms.ageCustom) + '">' + a[1] + '</button>'; }).join("") + '<input class="ms-age" type="number" min="18" max="70" inputmode="numeric" data-ms-input="ageCustom" value="' + esc(ms.ageCustom) + '" placeholder="' + cwt("Exact, e.g. 42", "عمر محدد، مثلاً 42") + '" aria-label="' + cwt("Exact age", "عمر محدد") + '"></div></div>' +
    '<div class="ms-trait"><h4>' + cwt("Build", "البنية") + '</h4>' + msChips("build", MS_BUILDS, 1) + '</div>' +
    '<div class="ms-trait"><h4>' + cwt("Hair", "الشعر") + '</h4><div class="ms-swatches">' + MS_HAIR.map(function (h) { return '<button type="button" class="ms-swatch" style="--sw:' + h[1] + '" data-ms-set="hair" data-ms-value="' + h[0] + '" aria-pressed="' + (ms.hair === h[0]) + '" aria-label="' + cwt(h[2], h[3]) + '" title="' + cwt(h[2], h[3]) + '"' + (hijab ? " disabled" : "") + '></button>'; }).join("") + '<span class="ms-swatch-name">' + (hijab ? cwt("Covered by the hijab", "مغطى بالحجاب") : msLabel(MS_HAIR, ms.hair, 2)) + '</span></div></div>' +
    '<div class="ms-trait"><h4>' + cwt("Setting", "المكان") + '</h4>' + msChips("setting", MS_SETTINGS, 1) + '</div>' +
    '<div class="ms-trait ms-ref"><h4>' + cwt("Face reference", "مرجع الوجه") + ' <small>' + cwt("optional", "اختياري") + '</small></h4><div class="ms-ref-row">' + (cw.modelForm.image ? '<img src="' + esc(cw.modelForm.image) + '" alt=""><button type="button" class="btn btn-ghost btn-sm" data-ms-clear-ref>' + cwt("Remove", "إزالة") + '</button><button type="button" class="btn btn-ghost btn-sm" data-ms-save-ref' + (cw.busy ? " disabled" : "") + '>' + cwt("Save this photo as a model", "احفظ الصورة كعارض") + '</button>' : '<label class="ms-ref-drop"><input type="file" class="vh" data-cwfile="model-reference" accept="image/png,image/jpeg,image/webp"><b>+ ' + cwt("Add a photo of the person", "أضف صورة الشخص") + '</b><small>' + cwt("Keeps the same face across shoots. Only with the person's consent.", "يحافظ على الوجه نفسه في كل الجلسات. بموافقة الشخص فقط.") + '</small></label>') + '</div></div>' +
    '</div></div>';
  var right = '<div class="ms-panel ms-side"><div class="ms-passport"><div class="ms-passport-head"><span>' + cwt("Model passport", "جواز العارض") + '</span>' + (ms.edited ? '<button type="button" data-ms-reset>' + cwt("Rebuild from traits", "أعد البناء من الصفات") + '</button>' : '') + '</div><textarea dir="auto" rows="5" data-ms-input="passport" aria-label="' + cwt("Model passport", "جواز العارض") + '">' + esc(ms.passport) + '</textarea><small>' + cwt("This exact brief goes to the image model. Edit it freely.", "يُرسل هذا الوصف كما هو إلى نموذج الصور. عدّله كما تشاء.") + '</small></div>' +
    '<label class="ms-name"><span>' + cwt("Model name", "اسم العارض") + ' <small>' + cwt("optional", "اختياري") + '</small></span><input data-ms-input="name" maxlength="80" value="' + esc(ms.name) + '" placeholder="' + cwt("e.g. Noura, Layali 01", "مثلاً: نورة، ليالي 01") + '"></label>' +
    '<button type="button" class="btn btn-primary ms-generate" data-ms-generate' + (!can || cw.busy ? " disabled" : "") + '>✦ ' + cwt("Generate model", "ولّد العارض") + '</button>' +
    '<div class="ms-meta"><span class="ms-cost">' + rate + ' ' + cwt("credits", "رصيد") + '</span><span>' + cwt("1 result · saved to My models · AI label in the file", "نتيجة واحدة · تُحفظ في عارضيّ · علامة الذكاء الاصطناعي في الملف") + '</span></div>' +
    (!can ? '<p class="note">' + cwt("Set up an image provider to generate models.", "فعّل مزود الصور لتوليد العارضين.") + '</p>' : '') + msPreview() + '</div>';
  return '<div class="ms"><div class="ms-head"><div><h2>' + cwt("Create an AI model", "أنشئ عارضاً بالذكاء الاصطناعي") + '</h2><p>' + cwt("Pick a starting look or build one from traits — Basira generates a photo-real, reusable model for this client.", "اختر ملامح جاهزة أو ابنِها من الصفات — تولّد بصيرة عارضاً واقعياً قابلاً لإعادة الاستخدام لهذا العميل.") + '</p></div><button type="button" class="btn btn-ghost" data-ms-library>' + cwt("My models", "عارضيّ") + ' · ' + cw.models.length + '</button></div><div class="ms-grid">' + left + right + '</div>' + msLibrary() + '</div>';
}

function msName() {
  if (ms.name.trim()) return ms.name.trim();
  var pre = MS_PRESETS.find(function (x) { return x.id === ms.preset; });
  return (pre ? cwt(pre.en, pre.ar) : msLabel(MS_LOOKS, ms.look, 1)) + " · " + msAge() + " · " + (cw.models.length + 1);
}

document.addEventListener("click", function (e) {
  var el;
  if ((el = e.target.closest("[data-ms-preset]"))) { var pre = MS_PRESETS.find(function (x) { return x.id === el.dataset.msPreset; }); ms.preset = pre.id; msApply(pre.t); render(); return; }
  if (e.target.closest("[data-ms-random]")) { var pick = function (l) { return l[Math.floor(Math.random() * l.length)][0]; }; var g = Math.random() < 0.5 ? "woman" : "man"; ms.preset = null; msApply({ gender: g, cover: g === "woman" && Math.random() < 0.5 ? "hijab" : "none", look: pick(MS_LOOKS), age: pick(MS_AGES), build: pick(MS_BUILDS), hair: pick(MS_HAIR), setting: "studio" }); render(); return; }
  if (e.target.closest("[data-ms-library]")) { var lib = document.getElementById("ms-library"); if (lib) lib.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if ((el = e.target.closest("[data-ms-set]"))) { var k = el.dataset.msSet; ms[k] = el.dataset.msValue; if (k === "age") ms.ageCustom = ""; if (k === "gender" && ms.gender === "man") ms.cover = "none"; ms.preset = null; msRefresh(); render(); return; }
  if (e.target.closest("[data-ms-reset]")) { ms.edited = false; msRefresh(); render(); return; }
  if (e.target.closest("[data-ms-again]")) { ms.lastId = null; render(); return; }
  if (e.target.closest("[data-ms-clear-ref]")) { cw.modelForm.image = null; render(); return; }
  if (e.target.closest("[data-ms-save-ref]")) { var nm = msName(); cwRun(cwt("Saving model", "جارٍ حفظ العارض"), function () { return cwPost("upload", { kind: "model", name: nm, image: cw.modelForm.image }).then(function (m) { cw.modelForm.image = null; if (m && m.id) ms.lastId = m.id; }); }); return; }
  if (e.target.closest("[data-ms-generate]")) {
    var input = { name: msName(), prompt: ms.passport, gender: ms.gender, look: ms.look, cover: ms.cover, setting: ms.setting, age: msAge(), build: ms.build, hair: ms.hair };
    cwRun(cwt("Creating model", "جارٍ إنشاء العارض"), function () { return cwPost("models", { action: "create", input: input, image: cw.modelForm.image }).then(function (m) { if (m && m.id) ms.lastId = m.id; ms.name = ""; }); });
    return;
  }
});
document.addEventListener("input", function (e) {
  var el = e.target, k = el.dataset && el.dataset.msInput; if (!k) return;
  ms[k] = el.value;
  if (k === "passport") ms.edited = true;
  if (k === "ageCustom") { ms.preset = null; if (!ms.edited) { ms.passport = msCompose(); var ta = document.querySelector('[data-ms-input="passport"]'); if (ta) ta.value = ms.passport; } }
});
