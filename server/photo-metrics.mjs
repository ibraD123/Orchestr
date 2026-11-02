// Pixel-level photo checks and background removal on raw RGBA data.
// Pure functions with no imports: the server runs them inside Chromium on decoded images,
// and scripts/build.mjs inlines them into the app so photos are checked in the browser.

export function borderColour(d, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.02));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= band && x < w - band && y >= band && y < h - band) continue;
    const i = (y * w + x) * 4;
    if (d[i + 3] < 128) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  return n ? [r / n, g / n, b / n] : [255, 255, 255];
}

/**
 * Measure a decoded image.
 * whiteShare: share of border pixels that are white (Amazon and Noon main images need a white background).
 * fill: how much of the frame the product's bounding box covers on its longer side (Amazon asks for 85%).
 * transparent: whether the background is already transparent.
 */
export function measurePixels(d, w, h) {
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  let white = 0, total = 0, clear = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= band && x < w - band && y >= band && y < h - band) continue;
    const i = (y * w + x) * 4;
    total++;
    if (d[i + 3] < 30) clear++;
    else if (d[i] >= 243 && d[i + 1] >= 243 && d[i + 2] >= 243) white++;
  }
  const bg = borderColour(d, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 30) continue;
    const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
    if (clear / total < 0.5 && dist < 45) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const found = maxX >= 0;
  const fill = found ? Math.max((maxX - minX + 1) / w, (maxY - minY + 1) / h) : 0;
  return {
    whiteShare: total ? Math.round((white / total) * 100) / 100 : 0,
    transparent: total ? clear / total > 0.5 : false,
    fill: Math.round(fill * 100) / 100,
    box: found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null
  };
}

/**
 * Make the background transparent by flooding inward from the edges while colours stay close
 * to the edge colour. Works on plain studio backgrounds, not on busy scenes.
 * Mutates d (RGBA) in place and returns the share of pixels removed.
 */
export function removeBackground(d, w, h, tolerance = 40) {
  const bg = borderColour(d, w, h);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const near = (p) => { const i = p * 4; return Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) <= tolerance * 3 || d[i + 3] < 30; };
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  let removed = 0;
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!near(p)) continue;
    d[p * 4 + 3] = 0; removed++;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
  }
  // Soften the cut: half-transparent edge pixels next to removed ones.
  for (let p = 0; p < w * h; p++) {
    if (d[p * 4 + 3] === 0) continue;
    const x = p % w, y = (p / w) | 0;
    const edge = (x > 0 && d[(p - 1) * 4 + 3] === 0) || (x < w - 1 && d[(p + 1) * 4 + 3] === 0) || (y > 0 && d[(p - w) * 4 + 3] === 0) || (y < h - 1 && d[(p + w) * 4 + 3] === 0);
    if (edge) d[p * 4 + 3] = Math.min(d[p * 4 + 3], 150);
  }
  return removed / (w * h);
}

/** Where to draw a product box inside a square so its longer side covers `target` of the frame. */
export function fitBox(box, size, target = 0.85) {
  const scale = (size * target) / Math.max(box.w, box.h);
  const w = box.w * scale, h = box.h * scale;
  return { scale, x: (size - w) / 2, y: (size - h) / 2, w, h };
}

/** Main-image rules per channel, applied to measured numbers. */
export function mainImageChecks(m, channel) {
  const strict = channel === "amazon" || channel === "noon";
  const out = [];
  const short = Math.min(m.width || 0, m.height || 0);
  out.push({ key: "size", ok: short >= 1000, value: (m.width || 0) + " × " + (m.height || 0), need: "≥ 1000 px" });
  if (strict) out.push({ key: "white", ok: m.whiteShare >= 0.9 && !m.transparent, value: Math.round(m.whiteShare * 100) + "%", need: "≥ 90%" });
  out.push({ key: "fill", ok: m.fill >= (strict ? 0.85 : 0.7), value: Math.round(m.fill * 100) + "%", need: strict ? "≥ 85%" : "≥ 70%" });
  out.push({ key: "square", ok: m.width && m.height ? Math.abs(m.width / m.height - 1) < 0.05 : false, value: m.width && m.height ? (m.width / m.height).toFixed(2) : "?", need: "1 : 1" });
  return out;
}
