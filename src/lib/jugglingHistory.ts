import { percentImprovement } from './challengeScoring';

export type JugglingHistoryEntry = {
  id: string; teamSeasonId: string; title: string; startDate: string | null;
  createdAt: string; updatedAt: string; start: number; end: number | null;
  notes: string | null; minStart: number;
};

export function jugglingHistorySummary(history: JugglingHistoryEntry[], teamSeasonId?: string | null) {
  // Legacy 0/0 placeholders and unmeasured players have no personal achievement.
  const rows = history.filter(row => (!teamSeasonId || row.teamSeasonId === teamSeasonId) && Math.max(row.start,row.end ?? 0) > 0)
    .sort((a,b) => (a.startDate ?? a.updatedAt.slice(0,10)).localeCompare(b.startDate ?? b.updatedAt.slice(0,10)) || a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
  const bestRow = [...rows].sort((a,b) => Math.max(b.start,b.end ?? 0) - Math.max(a.start,a.end ?? 0))[0] ?? null;
  const latest = rows.at(-1) ?? null;
  const delta = latest?.end != null ? latest.end - latest.start : null;
  const percent = latest?.end != null && latest.start >= latest.minStart ? percentImprovement(latest.start,latest.end) : null;
  return { rows, best: bestRow ? Math.max(bestRow.start,bestRow.end ?? 0) : null, bestRow, latest, delta, percent };
}
