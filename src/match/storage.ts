import type { Lineup, MatchConfig, MatchId, MatchRoster } from './types';
import type { MatchEventLog } from './events';

export interface MatchEngineSeed {
  matchId: MatchId;
  config: MatchConfig;
  roster?: MatchRoster;
  lineup: Lineup;
}

const seedKey = (matchId: MatchId) => `spielzeit:match:${matchId}:seed`;
const logKey = (matchId: MatchId) => `spielzeit:match:${matchId}:log`;

export function loadMatchEngine(
  matchId: MatchId,
): { seed: MatchEngineSeed; log: MatchEventLog } | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawSeed = window.localStorage.getItem(seedKey(matchId));
    const rawLog = window.localStorage.getItem(logKey(matchId));
    if (!rawSeed) {
      return null;
    }
    const seed = JSON.parse(rawSeed) as MatchEngineSeed;
    const log: MatchEventLog = rawLog ? (JSON.parse(rawLog) as MatchEventLog) : [];
    return { seed, log };
  } catch {
    return null;
  }
}

export function saveMatchEngine(matchId: MatchId, seed: MatchEngineSeed, log: MatchEventLog): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(seedKey(matchId), JSON.stringify(seed));
    window.localStorage.setItem(logKey(matchId), JSON.stringify(log));
  } catch {
    // ignore quota / storage errors
  }
}

export function clearMatchEngine(matchId: MatchId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(seedKey(matchId));
    window.localStorage.removeItem(logKey(matchId));
  } catch {
    // ignore
  }
}

