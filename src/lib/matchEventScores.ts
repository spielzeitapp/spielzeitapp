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

/**
 * Abgeschlossener Spielbericht: `match_events.minute` = Anzeigeminute (1:1), keine *60- oder -1-Umrechnung beim Speichern.
 * Legacy-Zeilen: oft (m−1)·60 (durch 60 teilbar, groß) — siehe {@link finishedReportMinuteDisplayFromDb}.
 */
export function finishedReportMinuteDbFromInput(inputMinute: number): number {
  return Math.max(0, Math.floor(Number(inputMinute) || 0));
}

/**
 * DB-Rohwert → angezeigte Spielminute. Neu: Ganzzahl ≤130 direkt.
 * Legacy: große Vielfache von 60 → m = ⌊v/60⌋ + 1 (alter (m−1)·60-Speicher).
 */
export function finishedReportMinuteDisplayFromDb(raw: number | null | undefined): number {
  const v = Math.max(0, Number(raw) || 0);
  if (v === 0) return 0;
  if (v <= 130) return v;
  if (v % 60 === 0) return Math.floor(v / 60) + 1;
  return v;
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
