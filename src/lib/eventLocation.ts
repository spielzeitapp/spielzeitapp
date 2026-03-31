/**
 * Ort / Platzname + Adresse für Anzeige und ICS.
 */

export function formatFullLocation(
  place: string | null | undefined,
  address: string | null | undefined,
): string {
  const p = (place ?? '').trim();
  const a = (address ?? '').trim();
  if (p && a && p.toLowerCase() === a.toLowerCase()) return p;
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

/** Speichert Platzname + Adresse in einem Feld (kompatibel ohne DB-Schema-Änderung). */
export function combineLocationParts(
  place: string | null | undefined,
  address: string | null | undefined,
): string | null {
  const p = (place ?? '').trim();
  const a = (address ?? '').trim();
  if (!p && !a) return null;
  if (p && a) return `${p}\n${a}`;
  return p || a;
}

/** Liest Platzname + Adresse aus einem gespeicherten location-Wert. */
export function splitCombinedLocation(value: string | null | undefined): { place: string; address: string } {
  const s = (value ?? '').trim();
  if (!s) return { place: '', address: '' };
  const lines = s.split('\n').map((v) => v.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return { place: lines[0], address: lines.slice(1).join(', ') };
  }
  return { place: s, address: '' };
}
