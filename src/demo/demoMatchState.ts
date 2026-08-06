/**
 * Demo-Match-Vorbereitung / Aufstellung (DEMO.2E).
 * Stabile Match-IDs + lokaler Kader-/Lineup-State (kein Supabase).
 */

import type { FieldSlotId } from '../types/match';
import type { U11FormationId } from '../lib/matchFormations';
import { DEFAULT_FAIRPLAY_FORMATION } from '../lib/matchFormations';
import {
  computeSeasonMatchSummary,
  type SeasonMatchBoard,
  type SeasonMatchCardData,
} from '../lib/seasonMatchStats';
import {
  DEMO_MATCH_ID_LIVE,
  DEMO_MATCH_ID_PAST,
  DEMO_TEAM_SEASON_ID,
} from './demoDataSource';

export const DEMO_MATCH_ID_AWAY = '00000000-demo-4000-8000-matchsknaway';

export { DEMO_MATCH_ID_LIVE, DEMO_MATCH_ID_PAST };

export type DemoMatchLite = {
  id: string;
  team_season_id: string;
  opponent: string;
  status: string;
  live_started_at: string | null;
  is_home: boolean;
  event_id: string;
  u11_formation_id: U11FormationId;
  minimum_playtime_enabled: boolean;
  minimum_playtime_minutes: number;
  planned_match_minutes: number;
  auto_matchday_feed_enabled: boolean;
  score_home: number | null;
  score_away: number | null;
};

export type DemoMatchPrepState = {
  squadPlayerIds: string[];
  slots: Record<FieldSlotId, string | null>;
  formationId: U11FormationId;
  publishedLocal: boolean;
};

function emptySlots(): Record<FieldSlotId, string | null> {
  return { GK: null, LB: null, RB: null, CM: null, LW: null, RW: null, ST: null, FP: null };
}

/** Initiale 1-3-3-1 Aufstellung (8er FairPlay) – IDs aus demoPlayers. */
function seedFairPlayLineup(): Pick<DemoMatchPrepState, 'squadPlayerIds' | 'slots' | 'formationId'> {
  const slots = emptySlots();
  slots.GK = 'p01';
  slots.LB = 'p02';
  slots.CM = 'p03';
  slots.RB = 'p04';
  slots.LW = 'p06';
  slots.ST = 'p10';
  slots.RW = 'p08';
  slots.FP = 'p07';
  const starters = ['p01', 'p02', 'p03', 'p04', 'p06', 'p07', 'p08', 'p10'];
  const bench = ['p09', 'p11', 'p12', 'p13'];
  return {
    formationId: '1-3-3-1',
    slots,
    squadPlayerIds: [...starters, ...bench],
  };
}

function seedAwayLineup(): Pick<DemoMatchPrepState, 'squadPlayerIds' | 'slots' | 'formationId'> {
  const slots = emptySlots();
  slots.GK = 'p15';
  slots.LB = 'p12';
  slots.CM = 'p04';
  slots.RB = 'p02';
  slots.LW = 'p09';
  slots.ST = 'p11';
  slots.RW = 'p08';
  slots.FP = 'p13';
  const starters = ['p15', 'p12', 'p04', 'p02', 'p09', 'p11', 'p08', 'p13'];
  const bench = ['p01', 'p06', 'p07', 'p10'];
  return {
    formationId: DEFAULT_FAIRPLAY_FORMATION,
    slots,
    squadPlayerIds: [...starters, ...bench],
  };
}

export function getDemoMatchCatalog(): DemoMatchLite[] {
  return [
    {
      id: DEMO_MATCH_ID_LIVE,
      team_season_id: DEMO_TEAM_SEASON_ID,
      opponent: 'SV Loosdorf U12',
      status: 'scheduled',
      live_started_at: null,
      is_home: true,
      event_id: 'ev-game-next',
      u11_formation_id: '1-3-3-1',
      minimum_playtime_enabled: true,
      minimum_playtime_minutes: 20,
      planned_match_minutes: 50,
      auto_matchday_feed_enabled: false,
      score_home: null,
      score_away: null,
    },
    {
      id: DEMO_MATCH_ID_AWAY,
      team_season_id: DEMO_TEAM_SEASON_ID,
      opponent: 'SKN Nachwuchs U12',
      status: 'scheduled',
      live_started_at: null,
      is_home: false,
      event_id: 'ev-game-away',
      u11_formation_id: DEFAULT_FAIRPLAY_FORMATION,
      minimum_playtime_enabled: false,
      minimum_playtime_minutes: 20,
      planned_match_minutes: 50,
      auto_matchday_feed_enabled: false,
      score_home: null,
      score_away: null,
    },
    {
      id: DEMO_MATCH_ID_PAST,
      team_season_id: DEMO_TEAM_SEASON_ID,
      opponent: 'SC St. Veit U12',
      status: 'finished',
      live_started_at: null,
      is_home: true,
      event_id: 'ev-game-past',
      u11_formation_id: '1-3-3-1',
      minimum_playtime_enabled: true,
      minimum_playtime_minutes: 20,
      planned_match_minutes: 50,
      auto_matchday_feed_enabled: false,
      score_home: 3,
      score_away: 1,
    },
  ];
}

export function getDemoMatchLite(matchId: string | null | undefined): DemoMatchLite | null {
  const id = (matchId ?? '').trim();
  if (!id) return null;
  return getDemoMatchCatalog().find((m) => m.id === id) ?? null;
}

export function getDemoMatchIdForEvent(eventId: string | null | undefined): string | null {
  const eid = (eventId ?? '').trim();
  if (!eid) return null;
  return getDemoMatchCatalog().find((m) => m.event_id === eid)?.id ?? null;
}

export function buildInitialDemoMatchStates(): Record<string, DemoMatchPrepState> {
  const home = seedFairPlayLineup();
  const away = seedAwayLineup();
  const past = seedFairPlayLineup();
  return {
    [DEMO_MATCH_ID_LIVE]: { ...home, publishedLocal: false },
    [DEMO_MATCH_ID_AWAY]: { ...away, publishedLocal: false },
    [DEMO_MATCH_ID_PAST]: { ...past, publishedLocal: true },
  };
}

export function cloneDemoMatchState(state: DemoMatchPrepState): DemoMatchPrepState {
  return {
    squadPlayerIds: [...state.squadPlayerIds],
    slots: { ...state.slots },
    formationId: state.formationId,
    publishedLocal: state.publishedLocal,
  };
}

/** Team-Tab „Spiele“: produktive SeasonMatchBoard-Struktur aus Demo-Katalog. */
export function buildDemoSeasonMatchBoard(
  eventsById: Map<string, { starts_at?: string | null; location?: string | null }>,
): SeasonMatchBoard {
  const catalog = getDemoMatchCatalog();
  const all: SeasonMatchCardData[] = catalog.map((m) => {
    const ev = eventsById.get(m.event_id);
    const finished = m.status === 'finished';
    const teamGoals = finished ? (m.is_home ? m.score_home : m.score_away) : null;
    const oppGoals = finished ? (m.is_home ? m.score_away : m.score_home) : null;
    let outcome: 'win' | 'draw' | 'loss' | null = null;
    if (finished && teamGoals != null && oppGoals != null) {
      outcome = teamGoals > oppGoals ? 'win' : teamGoals < oppGoals ? 'loss' : 'draw';
    }
    const displayStatus =
      m.status === 'live'
        ? ('live' as const)
        : outcome === 'win' || outcome === 'draw' || outcome === 'loss'
          ? outcome
          : ('upcoming' as const);
    return {
      id: m.id,
      opponent: m.opponent,
      match_date: ev?.starts_at ?? null,
      status: m.status,
      score_home: m.score_home,
      score_away: m.score_away,
      teamGoals,
      oppGoals,
      outcome,
      eventId: m.event_id,
      location: ev?.location ?? null,
      isHome: m.is_home,
      displayStatus,
    };
  });
  const upcoming = all.filter((m) => m.displayStatus === 'upcoming' || m.displayStatus === 'live');
  const recent = all.filter((m) => m.outcome != null);
  return {
    summary: computeSeasonMatchSummary(all),
    upcoming,
    recent,
    all,
  };
}
