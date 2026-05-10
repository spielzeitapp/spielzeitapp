/**
 * Stadion-Tore nur über match_events.type — niemals über player_id / Namen.
 * goal = Heim (Stadion), goal_away = Auswärts (Stadion).
 */

export function normalizeMatchEventGoalType(type: string | null | undefined): 'goal' | 'goal_away' | null {
  const t = String(type ?? '').trim().toLowerCase();
  if (t === 'goal') return 'goal';
  if (t === 'goal_away') return 'goal_away';
  return null;
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
