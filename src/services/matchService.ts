import type { Match, Team } from '../types/match';
import { matchesMock } from '../data/matches.mock';
import { getMatchById as getScheduleMatchById, getScheduleTeamMeta } from './matchRepo';
import { getPlayers } from './playerRepo';

const source = import.meta.env.VITE_DATA_SOURCE ?? 'mock';

function ensureMockSource(): void {
  if (source !== 'mock') {
    throw new Error('API datasource not implemented yet');
  }
}

export async function listMatches(): Promise<Match[]> {
  ensureMockSource();
  return matchesMock;
}

export async function getMatchById(id: string): Promise<Match | null> {
  ensureMockSource();
  const mockMatch = matchesMock.find((m) => m.id === id);
  if (mockMatch) return mockMatch;

  const schedule = getScheduleMatchById(id);
  if (!schedule) return null;

  const teamMeta = getScheduleTeamMeta(schedule.teamId);

  const ourTeam: Team = {
    id: schedule.teamId,
    name: teamMeta.fullName,
    shortName: teamMeta.shortName,
    players: getPlayers(schedule.teamId),
  };

  const opponentTeam: Team = {
    id: `opp-${schedule.opponentName.toLowerCase().replace(/\s+/g, '-')}`,
    name: schedule.opponentName,
    shortName: schedule.opponentName,
    players: [],
  };

  const isHome = schedule.homeAway === 'home';

  const match: Match = {
    id: schedule.id,
    home: isHome ? ourTeam : opponentTeam,
    away: isHome ? opponentTeam : ourTeam,
    kickoffISO: schedule.kickoffAt,
    status: schedule.status,
    score: {
      home: schedule.scoreHome,
      away: schedule.scoreAway,
    },
    events: [],
    currentMinute: undefined,
    period: undefined,
    isRunning: undefined,
    startedAtISO: null,
    lineup: {
      homeStarting: [],
      homeBench: [],
      awayStarting: [],
      awayBench: [],
    },
    field: {
      home: {},
      away: {},
    },
    timer: {
      isRunning: false,
      startedAtISO: null,
      accumulatedSeconds: 0,
    },
  };

  return match;
}

