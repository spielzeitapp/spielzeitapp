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
