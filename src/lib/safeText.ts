/** Coerce unknown values to a trimmed string; never throws on null/object/number. */
export function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Like safeText, but returns null when empty. */
export function safeOptionalText(value: unknown): string | null {
  const text = safeText(value);
  return text.length > 0 ? text : null;
}
