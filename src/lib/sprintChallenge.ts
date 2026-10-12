export type SprintAttempts = [number | null, number | null, number | null];
export function parseSprintSeconds(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,3})?$/.test(text)) return null;
  const milliseconds = Math.round(Number(text) * 1000);
  return milliseconds > 0 && milliseconds <= 60000 ? milliseconds : null;
}
export function bestSprintTime(attempts: SprintAttempts): number | null {
  const valid = attempts.filter((value): value is number => value != null && Number.isInteger(value) && value > 0 && value <= 60000);
  return valid.length ? Math.min(...valid) : null;
}
export function formatSprintTime(milliseconds: number | null): string {
  return milliseconds == null ? '—' : (milliseconds / 1000).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + ' s';
}
export function rankSprintResults(rows: { playerId: string; playerName: string; attempts: SprintAttempts }[]) {
  const sorted = rows.map(row => ({ ...row, best: bestSprintTime(row.attempts), rank: 0 }))
    .filter((row): row is typeof row & { best: number } => row.best != null)
    .sort((a, b) => a.best - b.best || a.playerName.localeCompare(b.playerName, 'de'));
  sorted.forEach((row, index) => { row.rank = index > 0 && row.best === sorted[index - 1].best ? sorted[index - 1].rank : index + 1; });
  return sorted;
}

export type SprintParticipation = 'participated' | 'absent' | null;
export type SprintHistoryEntry = {
 testId: string; playerId: string; date: string | null; createdAt: string;
 method: 'hand' | 'light_gate' | null; attempts: SprintAttempts; participation: SprintParticipation;
};
export function compareSprintTests(a: Pick<SprintHistoryEntry,'testId'|'date'|'createdAt'>, b: Pick<SprintHistoryEntry,'testId'|'date'|'createdAt'>) {
 return (a.date ?? a.createdAt.slice(0,10)).localeCompare(b.date ?? b.createdAt.slice(0,10)) || a.createdAt.localeCompare(b.createdAt) || a.testId.localeCompare(b.testId);
}
export function sprintProgress(history: SprintHistoryEntry[], current: SprintHistoryEntry) {
 const best = current.participation === 'absent' ? null : bestSprintTime(current.attempts);
 const previous = current.method == null ? [] : history.filter(row => row.playerId === current.playerId && row.method === current.method && row.testId !== current.testId && compareSprintTests(row,current) < 0 && row.participation !== 'absent' && bestSprintTime(row.attempts) != null).sort(compareSprintTests);
 const last = previous.at(-1);
 const previousTime = last ? bestSprintTime(last.attempts) : null;
 const previousBest = previous.length ? Math.min(...previous.map(row => bestSprintTime(row.attempts)!)) : null;
 const improvementMs = best != null && previousTime != null ? previousTime - best : null;
 return { best, previousTime, previousBest, previousDate: last?.date ?? null, improvementMs,
 improvementPercent: improvementMs != null && previousTime != null ? improvementMs / previousTime * 100 : null,
 newPersonalBest: best != null && previousBest != null && best < previousBest };
}
export function sprintDevelopmentRanking(rows: { playerId: string; playerName: string; improvementMs: number | null; improvementPercent: number | null }[], metric: 'seconds'|'percent') {
 const value = (row: typeof rows[number]) => metric === 'seconds' ? row.improvementMs : row.improvementPercent;
 const sorted = rows.filter(row => (value(row) ?? 0) > 0).sort((a,b) => value(b)! - value(a)! || a.playerName.localeCompare(b.playerName,'de'));
 return sorted.map((row,index) => ({ ...row, rank: index > 0 && value(row) === value(sorted[index - 1]) ? sorted.findIndex(other => value(other) === value(row)) + 1 : index + 1 }));
}
