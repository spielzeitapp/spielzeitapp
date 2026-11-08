/** Pure presentation helpers. Club names never determine the palette. */
export type AppearanceMode = 'day' | 'night';
export const APPEARANCE_KEY = 'spielzeit.manager.appearance.v1';
export function parseAppearance(value: string | null): AppearanceMode {
  return value === 'day' ? 'day' : 'night';
}
export function brandColor(value: string | null | undefined, fallback: string): string {
  return /^#[\da-f]{6}$/i.test(value ?? '') ? value! : fallback;
}
function channels(hex: string): number[] { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function luminance(hex: string): number {
  const c = channels(hex).map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function onBrand(hex: string): string {
  return contrast(hex, '#111216') >= contrast(hex, '#FFFFFF') ? '#111216' : '#FFFFFF';
}
export function readableBrand(hex: string, surface: string, mode: AppearanceMode): string {
  const rgb = channels(hex), target = mode === 'day' ? 0 : 255;
  for (let mix = 0; mix <= 100; mix++) {
    const color = '#' + rgb.map(c => Math.round(c + (target - c) * mix / 100).toString(16).padStart(2, '0')).join('');
    if (contrast(color, surface) >= 4.5) return color;
  }
  return mode === 'day' ? '#111216' : '#FFFFFF';
}
export function clubAppearance(primary: string | null, secondary: string | null, accent: string | null, mode: AppearanceMode) {
  const p = brandColor(primary, '#202126'), s = brandColor(secondary, '#FFFFFF'), a = brandColor(accent, '#D9232C');
  const surface = mode === 'day' ? '#FFFFFF' : '#202127';
  // Yellow and white stay exact on filled actions; links use a readable club color.
  const link = mode === 'day' && contrast(p, surface) >= 4.5 ? p : readableBrand(a, surface, mode);
  return { primary: p, secondary: s, accent: a, onAccent: onBrand(a), link,
    accentRgb: channels(a).join(' '), primaryRgb: channels(p).join(' '), secondaryRgb: channels(s).join(' '),
    darkAccent: readableBrand(a, '#202127', 'night') };
}
