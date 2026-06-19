/** Coerce unknown values to a trimmed string; never throws on null/object/number/array. */
export function safeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** Alias for readability at trim call sites. */
export const safeTrim = safeText;

/** Like safeText, but returns null when empty. */
export function safeOptionalText(value: unknown): string | null {
  const text = safeText(value);
  return text.length > 0 ? text : null;
}

/** Display helper: strings trimmed, numbers as text, else fallback. */
export function safeDisplayText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}
