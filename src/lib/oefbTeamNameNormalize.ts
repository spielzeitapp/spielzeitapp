/**
 * ÖFB-Mannschaftsnamen: Altersklassenmarkierung „U11“ entfernen.
 * Bewusst eng — keine anderen Altersklassen, keine Teilstrings in Vereinsnamen.
 */

/**
 * Entfernt eigenständige „U11“-Markierungen (inkl. Schreibvarianten) aus einem Namen.
 *
 * @example
 * normalizeOefbImportedTeamName('U11 SPG Rohrbach') // 'SPG Rohrbach'
 * normalizeOefbImportedTeamName('SV U11dorf') // 'SV U11dorf'
 */
export function normalizeOefbImportedTeamName(raw: string | null | undefined): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';

  // (U11) / (U 11) / (U-11) oder freistehendes U11 / U 11 / U-11
  s = s.replace(/\(\s*U[\s\-]?11\s*\)|\bU[\s\-]?11\b/gi, ' ');
  s = s.replace(/\(\s*\)/g, ' ');
  s = s.replace(/\s*[–—]\s*/g, ' – ');
  s = s.replace(/(?:\s*–\s*){2,}/g, ' – ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^(?:[–—\-]\s*)+|(?:\s*[–—\-])+$/g, '').trim();
  return s;
}

/** Kurzhinweis für die Importvorschau, wenn sich der Gegnername ändert. */
export function describeOefbOpponentCorrection(
  existingOpponent: string | null | undefined,
  nextOpponent: string | null | undefined,
): string | null {
  const a = String(existingOpponent ?? '').trim();
  const b = String(nextOpponent ?? '').trim();
  if (!a || !b || a === b) return null;
  return `${a} → ${b}`;
}
