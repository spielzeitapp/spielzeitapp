/**
 * Ort / Platzname + Adresse für Anzeige und ICS.
 */

export function formatFullLocation(
  place: string | null | undefined,
  address: string | null | undefined,
): string {
  const p = (place ?? '').trim();
  const a = (address ?? '').trim();
  if (p && a) return `${p}, ${a}`;
  return p || a || '';
}

/** Zwei Zeilen für UI (Platzname, Adresse) */
export function formatLocationTwoLines(
  place: string | null | undefined,
  address: string | null | undefined,
): { line1: string | null; line2: string | null } {
  const p = (place ?? '').trim();
  const a = (address ?? '').trim();
  return {
    line1: p || null,
    line2: a || null,
  };
}
