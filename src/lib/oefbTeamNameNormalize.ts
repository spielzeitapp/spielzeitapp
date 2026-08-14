/**
 * Sichtbare Mannschafts-/Spielbezeichnungen: Altersklassenmarkierung „U11“ entfernen.
 * Bewusst eng — keine anderen Altersklassen, keine Teilstrings in Vereinsnamen.
 * Keine DB-/Saison-Umbenennung — nur Anzeige und ÖFB-Importfelder.
 */

/**
 * Entfernt eigenständige „U11“-Markierungen (inkl. Schreibvarianten) aus einem Namen
 * oder einer Begegnungszeile („U11 A – U11 B“).
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

export type VisibleMatchEncounter = {
  home: string;
  away: string;
  /** „Heim – Gast“ */
  line: string;
  ourTeam: string;
  opponent: string;
};

/**
 * Zentrale Bildung sichtbarer Heim-/Auswärtsnamen (beide Seiten ohne U11).
 * Internen Team-/Saisonbezug nicht ändern — nur die für die Anzeige genutzten Strings.
 */
export function formatVisibleMatchEncounter(opts: {
  isHome: boolean | null | undefined;
  ourTeamName: string | null | undefined;
  opponentName: string | null | undefined;
  fallbackOur?: string;
  fallbackOpponent?: string;
}): VisibleMatchEncounter {
  const ourTeam =
    normalizeOefbImportedTeamName(opts.ourTeamName) ||
    (opts.fallbackOur ?? 'Heim');
  const opponent =
    normalizeOefbImportedTeamName(opts.opponentName) ||
    (opts.fallbackOpponent ?? 'Gegner');
  const home = opts.isHome === false ? opponent : ourTeam;
  const away = opts.isHome === false ? ourTeam : opponent;
  return {
    home,
    away,
    line: `${home} – ${away}`,
    ourTeam,
    opponent,
  };
}
