/**
 * PLATZ.5.1 – Halb-/Drittelzonen quer (oben→unten), Viertel unverändert.
 */
import assert from 'assert';

// Spiegel der Client-Presets (gleiche Werte wie fieldZoneGeometry.ts)
const PRESETS = {
  entire: { x: 0, y: 0, w: 1, h: 1 },
  half_a: { x: 0, y: 0, w: 1, h: 0.5 },
  half_b: { x: 0, y: 0.5, w: 1, h: 0.5 },
  third_a: { x: 0, y: 0, w: 1, h: 1 / 3 },
  third_b: { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
  third_c: { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
  quarter_a: { x: 0, y: 0, w: 0.5, h: 0.5 },
  quarter_b: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
  quarter_c: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
  quarter_d: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
};

function rectsOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

// Orientierung
assert.strictEqual(PRESETS.half_a.w, 1);
assert.strictEqual(PRESETS.half_a.h, 0.5);
assert.strictEqual(PRESETS.half_a.y, 0);
assert.strictEqual(PRESETS.half_b.w, 1);
assert.strictEqual(PRESETS.half_b.h, 0.5);
assert.strictEqual(PRESETS.half_b.y, 0.5);
for (const key of ['third_a', 'third_b', 'third_c']) {
  assert.strictEqual(PRESETS[key].w, 1);
  assert.ok(Math.abs(PRESETS[key].h - 1 / 3) < 1e-12);
}
assert.ok(Math.abs(PRESETS.third_a.y - 0) < 1e-12);
assert.ok(Math.abs(PRESETS.third_b.y - 1 / 3) < 1e-12);
assert.ok(Math.abs(PRESETS.third_c.y - 2 / 3) < 1e-12);

// Angrenzend ohne Überlappung
assert.strictEqual(rectsOverlap(PRESETS.half_a, PRESETS.half_b), false);
assert.strictEqual(rectsOverlap(PRESETS.third_a, PRESETS.third_b), false);
assert.strictEqual(rectsOverlap(PRESETS.third_b, PRESETS.third_c), false);
assert.strictEqual(rectsOverlap(PRESETS.third_a, PRESETS.third_c), false);

// Überlappungen
assert.ok(rectsOverlap(PRESETS.half_a, PRESETS.third_a));
assert.ok(rectsOverlap(PRESETS.half_a, PRESETS.third_b));
assert.strictEqual(rectsOverlap(PRESETS.half_a, PRESETS.third_c), false);
assert.ok(rectsOverlap(PRESETS.entire, PRESETS.half_a));
assert.ok(rectsOverlap(PRESETS.entire, PRESETS.third_b));

// Viertel unverändert (2×2)
assert.deepStrictEqual(PRESETS.quarter_a, { x: 0, y: 0, w: 0.5, h: 0.5 });
assert.deepStrictEqual(PRESETS.quarter_b, { x: 0.5, y: 0, w: 0.5, h: 0.5 });
assert.deepStrictEqual(PRESETS.quarter_c, { x: 0, y: 0.5, w: 0.5, h: 0.5 });
assert.deepStrictEqual(PRESETS.quarter_d, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 });

// SVG-Mapping: gleiche Orientierung wie Unit-Square (x L→R, y O→U)
function rectToSvg(r, pad = 10, W = 200, H = 300) {
  const iw = W - pad * 2;
  const ih = H - pad * 2;
  return { x: pad + r.x * iw, y: pad + r.y * ih, width: r.w * iw, height: r.h * ih };
}
const svgHalfA = rectToSvg(PRESETS.half_a);
const svgHalfB = rectToSvg(PRESETS.half_b);
assert.ok(svgHalfA.y < svgHalfB.y);
assert.ok(Math.abs(svgHalfA.width - (200 - 20)) < 1e-9);
assert.ok(Math.abs(svgHalfA.height - svgHalfB.height) < 1e-9);
const svgThirdA = rectToSvg(PRESETS.third_a);
const svgThirdC = rectToSvg(PRESETS.third_c);
assert.ok(svgThirdA.y < svgThirdC.y);
assert.ok(Math.abs(svgThirdA.width - svgThirdC.width) < 1e-9);

console.log('platz51-half-third-orientation-test: OK');
