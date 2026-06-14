/**
 * Stadion-Tore nur über match_events.type — niemals über player_id / Namen.
 * goal = Heim (Stadion), goal_away = Auswärts (Stadion).
 */

export function normalizeMatchEventGoalType(type: string | null | undefined): 'goal' | 'goal_away' | null {
  const t = String(type ?? '').trim().toLowerCase();
  if (t === 'goal' || t === 'goal_home') return 'goal';
  if (t === 'goal_away') return 'goal_away';
  return null;
}

/**
 * UI-Auswahl (Stadionseite im Spielbericht) → DB match_events.type.
 * stadium_home / goal_home → goal (links); stadium_away / goal_away → goal_away (rechts).
 * Nur die Rückgabewerte goal / goal_away in die DB schreiben, nie die UI-Schlüssel.
 */
export function mapUiGoalTypeToMatchEventDbType(uiType: string | null | undefined): 'goal' | 'goal_away' {
  const t = String(uiType ?? '').trim().toLowerCase();
  if (t === 'stadium_away' || t === 'goal_away') return 'goal_away';
  if (t === 'stadium_home' || t === 'goal_home') return 'goal';
  return 'goal';
}

/** Obergrenze für manuell gepflegte Anzeige-Spielminute (Spielbericht / U11). */
export const FINISHED_REPORT_MAX_MINUTE = 90;

/**
 * Abgeschlossener Spielbericht (manuell): UI-Anzeige-Minute 1…90 → DB `minute` = effektive Spielsekunde (0…5340).
 * Ungültige Eingabe → -1.
 */
export function finishedReportMinuteDbFromInput(input: unknown): number {
  const raw = typeof input === 'string' ? input.trim() : input;
  const n = Number(raw);
  if (!Number.isFinite(n)) return -1;
  const display = Math.round(n);
  if (display < 1 || display > FINISHED_REPORT_MAX_MINUTE) return -1;
  return Math.max(0, (display - 1) * 60);
}

/**
 * DB `minute` = effektive Spielsekunde → Anzeige-Minute für Spielbericht / Feed: ⌊s/60⌋ + 1, max. 90.
 * (Live und manuell gepflegte Zeilen nach Umstellung speichern dasselbe Format.)
 */
export function finishedReportDisplayMinuteFromStoredSeconds(rawSecond: number | null | undefined): number {
  const s = Math.max(0, Math.floor(Number(rawSecond) || 0));
  const uncapped = Math.floor(s / 60) + 1;
  return Math.min(FINISHED_REPORT_MAX_MINUTE, Math.max(1, uncapped));
}

/**
 * DB-Rohwert → Anzeige-Spielminute (null bei fehlendem/ungültigem Wert).
 */
export function finishedReportMinuteDisplayFromDb(rawMinute: number | null | undefined): number | null {
  const n = Number(rawMinute);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return finishedReportDisplayMinuteFromStoredSeconds(n);
}

/** Ohne Clamp 90 – nur für DEV-Warnungen / Diagnose. */
export function finishedReportUncappedDisplayMinuteFromSeconds(rawSecond: number | null | undefined): number {
  const s = Math.max(0, Math.floor(Number(rawSecond) || 0));
  return Math.floor(s / 60) + 1;
}

export function friendlyMatchEventWriteError(raw: string | null | undefined): string {
  const m = String(raw ?? '').trim();
  const lower = m.toLowerCase();
  if (lower.includes('match_events_type_check')) {
    return 'Ereignis konnte nicht gespeichert werden. Datenbank erlaubt diesen Ereignistyp noch nicht.';
  }
  if (
    !m ||
    lower.includes('violates check constraint') ||
    lower.includes('check constraint')
  ) {
    return 'Ereignis konnte nicht gespeichert werden. Bitte Team und Typ prüfen.';
  }
  return m;
}

/** Nur DEV: goal_home darf nie in die DB. */
export function debugAssertMatchEventDbType(context: string, dbType: string): void {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const t = String(dbType ?? '').trim().toLowerCase();
    if (t === 'goal_home') {
      console.error(`[match_events] ${context}: UI-Typ goal_home darf nicht in die DB geschrieben werden`, dbType);
    }
  }
}

export function countStadiumGoalsFromMatchEventRows(
  rows: ReadonlyArray<{ type?: string | null }>,
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const r of rows) {
    const g = normalizeMatchEventGoalType(r.type);
    if (g === 'goal') home += 1;
    else if (g === 'goal_away') away += 1;
  }
  return { home, away };
}

/** Drei Abschnitte mit je Heim/Auswärts — Quelle für manuell gepflegtes Klammerergebnis. */
export type PeriodScoresTriplet = {
  p1: { h: number; a: number };
  p2: { h: number; a: number };
  p3: { h: number; a: number };
};

function readNonNegInt(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return null;
  return Math.floor(n);
}

/** Liest matches.period_scores: { p1..p3: { h, a } } oder ältere flache Keys p1h/p1a … */
export function parsePeriodScores(raw: unknown): PeriodScoresTriplet | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const readPair = (key: string): { h: number; a: number } | null => {
    const v = o[key];
    if (!v || typeof v !== 'object') return null;
    const p = v as { h?: unknown; a?: unknown };
    if (p.h === undefined && p.a === undefined) return null;
    const h = p.h === undefined || p.h === null || p.h === '' ? 0 : readNonNegInt(p.h);
    const a = p.a === undefined || p.a === null || p.a === '' ? 0 : readNonNegInt(p.a);
    if (h === null || a === null) return null;
    return { h, a };
  };

  const a1 = readPair('p1');
  const a2 = readPair('p2');
  const a3 = readPair('p3');
  if (a1 && a2 && a3) return { p1: a1, p2: a2, p3: a3 };

  const lh1 = readNonNegInt(o.p1h);
  const la1 = readNonNegInt(o.p1a);
  const lh2 = readNonNegInt(o.p2h);
  const la2 = readNonNegInt(o.p2a);
  const lh3 = readNonNegInt(o.p3h);
  const la3 = readNonNegInt(o.p3a);
  if (
    lh1 !== null &&
    la1 !== null &&
    lh2 !== null &&
    la2 !== null &&
    lh3 !== null &&
    la3 !== null
  ) {
    return {
      p1: { h: lh1, a: la1 },
      p2: { h: lh2, a: la2 },
      p3: { h: lh3, a: la3 },
    };
  }

  return null;
}

export function sumPeriodScoresTriplet(t: PeriodScoresTriplet): { home: number; away: number } {
  return {
    home: t.p1.h + t.p2.h + t.p3.h,
    away: t.p1.a + t.p2.a + t.p3.a,
  };
}

export function formatPeriodScoresBracket(t: PeriodScoresTriplet): string {
  return `(${t.p1.h}:${t.p1.a} | ${t.p2.h}:${t.p2.a} | ${t.p3.h}:${t.p3.a})`;
}

/** Wie Termine „Vergangen“: `(2:0 | 1:1 | 1:2)` aus rohem `period_scores`. */
export function formatPeriodScoresBracketFromRaw(raw: unknown): string | null {
  const triplet = parsePeriodScores(raw);
  return triplet ? formatPeriodScoresBracket(triplet) : null;
}
