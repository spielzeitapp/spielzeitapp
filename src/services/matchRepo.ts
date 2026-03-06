import type { ScheduleMatch } from '../types/schedule';
export type { ScheduleMatch };

export type ScheduleTeamId = 'u11a' | 'u12';

export type HomeAway = 'home' | 'away';

export interface ScheduleTeamMeta {
  id: ScheduleTeamId;
  label: string;
  shortName: string;
  fullName: string;
}

export const SCHEDULE_TEAMS: ScheduleTeamMeta[] = [
  {
    id: 'u11a',
    label: 'U11 A – SPG Rohrbach',
    shortName: 'SPG Rohrbach',
    fullName: 'SPG Rohrbach U11 A',
  },
  {
    id: 'u12',
    label: 'U12 – SPG Rohrbach',
    shortName: 'SPG Rohrbach U12',
    fullName: 'SPG Rohrbach U12',
  },
];

export function getScheduleTeamMeta(teamId: ScheduleTeamId): ScheduleTeamMeta {
  const meta = SCHEDULE_TEAMS.find((t) => t.id === teamId);
  if (!meta) return SCHEDULE_TEAMS[0];
  return meta;
}

/** LocalStorage-Key für die gewählte Mannschaft (Spielplan + Tabelle synchron). */
export const SCHEDULE_TEAM_STORAGE_KEY = 'sz_schedule_team';

function homeAwayLabels(
  teamId: ScheduleTeamId,
  opponentName: string,
  homeAway: HomeAway,
): { homeTeam: string; awayTeam: string } {
  const ourName = getScheduleTeamMeta(teamId).shortName;
  if (homeAway === 'home') return { homeTeam: ourName, awayTeam: opponentName };
  return { homeTeam: opponentName, awayTeam: ourName };
}

const STORAGE_PREFIX = 'sz_matches_v1_';

function storageKey(teamId: string): string {
  return `${STORAGE_PREFIX}${teamId}`;
}

function readStorage(teamId: string): ScheduleMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(teamId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as ScheduleMatch[]).map((m) => ({
      ...m,
      kickoffAt: (m as { kickoffAt?: string; kickoffISO?: string }).kickoffAt ?? (m as { kickoffISO?: string }).kickoffISO ?? m.kickoffAt,
    }));
  } catch {
    return [];
  }
}

function writeStorage(teamId: string, list: ScheduleMatch[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(teamId), JSON.stringify(list));
  } catch {
    // ignore
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedDataForTeam(teamId: ScheduleTeamId): ScheduleMatch[] {
  const baseNow = new Date('2026-03-01T23:00:00+01:00');
  const meta = getScheduleTeamMeta(teamId);

  function iso(offsetDays: number, hour: number, minute: number): string {
    const d = new Date(baseNow.getTime());
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  function row(
    id: string,
    opponentName: string,
    homeAway: HomeAway,
    kickoffAt: string,
    status: ScheduleMatch['status'],
    scoreHome: number,
    scoreAway: number,
  ): ScheduleMatch {
    const { homeTeam, awayTeam } = homeAwayLabels(teamId, opponentName, homeAway);
    return {
      id,
      teamId,
      homeTeam,
      awayTeam,
      opponentName,
      homeAway,
      kickoffAt,
      status,
      scoreHome,
      scoreAway,
    };
  }

  if (teamId === 'u11a') {
    return [
      row('u11-1', 'Pottenbrunn', 'home', iso(-21, 23, 0), 'finished', 3, 2),
      row('u11-2', 'Alpenvorland USG', 'away', iso(-14, 23, 0), 'finished', 1, 1),
      row('u11-3', 'SKN St. Pölten A', 'home', iso(-7, 23, 0), 'finished', 0, 2),
      row('u11-4', 'SPG Weinburg A', 'away', iso(-1, 23, 0), 'finished', 2, 4),
      row('u11-5', 'Pottenbrunn', 'away', iso(0, 23, 0), 'live', 1, 0),
      row('u11-6', 'Alpenvorland USG', 'home', iso(7, 10, 30), 'planned', 0, 0),
      row('u11-7', 'SKN St. Pölten A', 'away', iso(14, 11, 0), 'planned', 0, 0),
      row('u11-8', 'SPG Weinburg A', 'home', iso(21, 9, 30), 'planned', 0, 0),
      row('u11-9', 'Pottenbrunn', 'home', iso(28, 23, 0), 'planned', 0, 0),
      row('u11-10', 'SKN St. Pölten A', 'away', iso(35, 23, 0), 'planned', 0, 0),
      row('u11-11', 'SPG Weinburg A', 'home', iso(42, 23, 0), 'planned', 0, 0),
    ];
  }

  if (teamId === 'u12') {
    return [
      row('u12-1', 'FC Altstadt U12', 'home', iso(3, 18, 0), 'planned', 0, 0),
      row('u12-2', 'SV Nachbardorf U12', 'away', iso(10, 18, 30), 'planned', 0, 0),
      row('u12-3', 'USG Alpenvorland U12', 'home', iso(17, 17, 0), 'planned', 0, 0),
    ];
  }

  return [];
}

export function seedMatchesIfEmpty(teamId: string): void {
  if (typeof window === 'undefined') return;
  const list = readStorage(teamId);
  if (list.length > 0) return;
  const tid = teamId as ScheduleTeamId;
  if (tid !== 'u11a' && tid !== 'u12') return;
  writeStorage(teamId, seedDataForTeam(tid));
}

export function getMatches(teamId: string): ScheduleMatch[] {
  seedMatchesIfEmpty(teamId);
  const list = readStorage(teamId);
  return [...list].sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

export function getMatchById(matchId: string): ScheduleMatch | null {
  const teamIds: ScheduleTeamId[] = ['u11a', 'u12'];
  for (const tid of teamIds) {
    seedMatchesIfEmpty(tid);
    const list = readStorage(tid);
    const found = list.find((m) => m.id === matchId);
    if (found) return found;
  }
  return null;
}

/** @deprecated Use getMatchById */
export function getScheduleMatchById(matchId: string): ScheduleMatch | null {
  return getMatchById(matchId);
}

export function upsertMatch(
  teamId: string,
  match: Partial<ScheduleMatch> & { id?: string },
): ScheduleMatch {
  const tid = teamId as ScheduleTeamId;
  seedMatchesIfEmpty(teamId);
  const list = readStorage(teamId);
  const opponentName = (match.opponentName ?? 'Gegner').trim() || 'Gegner';
  const homeAway = (match.homeAway ?? 'home') as HomeAway;
  const kickoffAt = match.kickoffAt ?? new Date().toISOString();
  const status = match.status ?? 'planned';
  const scoreHome = match.scoreHome ?? 0;
  const scoreAway = match.scoreAway ?? 0;
  const { homeTeam, awayTeam } = homeAwayLabels(tid, opponentName, homeAway);

  const id = match.id ?? createId();
  const base: ScheduleMatch = {
    id,
    teamId,
    homeTeam,
    awayTeam,
    opponentName,
    homeAway,
    kickoffAt,
    status,
    scoreHome,
    scoreAway,
  };

  const idx = list.findIndex((m) => m.id === id);
  if (idx >= 0) list[idx] = base;
  else list.push(base);
  writeStorage(teamId, list);
  return base;
}

export function deleteMatch(teamId: string, matchId: string): void {
  seedMatchesIfEmpty(teamId);
  const list = readStorage(teamId).filter((m) => m.id !== matchId);
  writeStorage(teamId, list);
}
