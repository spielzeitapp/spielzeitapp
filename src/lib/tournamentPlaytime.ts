import { computePlayerPlaytimeFromEvents, resolveReplayAtMatchSecond, type MatchEngineEvent } from './matchEngine';

type MatchTiming = {
  kickoffPlayerIds: string[];
  squadPlayerIds: string[];
  events: MatchEngineEvent[];
  elapsedSeconds: number | null;
  liveStartedAt: string | null;
};

export function tournamentMatchPlaytime({ kickoffPlayerIds, squadPlayerIds, events, elapsedSeconds, liveStartedAt }: MatchTiming) {
  const hasRecordedStart = events.some((event) => event.type === 'start') ||
    (liveStartedAt !== null && Number.isFinite(Date.parse(liveStartedAt)));
  if (!kickoffPlayerIds.some(Boolean) || !hasRecordedStart) return null;
  if (!(elapsedSeconds && elapsedSeconds > 0) && !events.some((event) => event.type === 'end' && event.timestamp > 0)) {
    return null;
  }

  const finalMatchSecond = resolveReplayAtMatchSecond(events, elapsedSeconds);
  if (finalMatchSecond <= 0) return null;
  return computePlayerPlaytimeFromEvents({
    kickoffStartingPlayerIds: kickoffPlayerIds,
    squadPlayerIds,
    events,
    finalMatchSecond,
  });
}

export function sumTournamentPlaytime(matches: Record<string, number>[]) {
  const totals = new Map<string, { playerId: string; seconds: number; appearances: number }>();
  for (const match of matches) {
    for (const [playerId, seconds] of Object.entries(match)) {
      const total = totals.get(playerId) ?? { playerId, seconds: 0, appearances: 0 };
      total.seconds += seconds;
      if (seconds > 0) total.appearances += 1;
      totals.set(playerId, total);
    }
  }
  return [...totals.values()];
}
