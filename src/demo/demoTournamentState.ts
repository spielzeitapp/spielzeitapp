/**
 * DEMO.2G-A — lokaler In-Memory-State für das produktive Turniercenter.
 * Event-ID bleibt `ev-tournament` (Termine/Feed). Kein LocalStorage, Reload = Seed.
 */

import type {
  TournamentMatchSlotView,
  TournamentParticipant,
} from '../lib/tournamentPlan';
import { TOURNAMENT_DEFAULT_PLANNED_MINUTES } from '../lib/tournamentPlan';
import type { TournamentCompletionState } from '../lib/tournamentCompletion';
import { DEMO_EVENT_TIMES, DEMO_TEAM_SEASON_ID } from './demoDataSource';
import { demoFixtures } from './demoFixtures';

export const DEMO_TOURNAMENT_EVENT_ID = 'ev-tournament';

/** Turnier-Slot-Matches (Prefix 5000) — getrennt von Meisterschaft (4000). */
export const DEMO_TOURNAMENT_MATCH_PREFIX = '00000000-demo-5000-8000-';

const OUR_TEAM = demoFixtures.teamName;

const listeners = new Set<() => void>();

export type DemoTournamentState = {
  participants: TournamentParticipant[];
  slots: TournamentMatchSlotView[];
  squadPlayerIds: string[];
  completion: TournamentCompletionState;
};

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribeDemoTournament(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isDemoTournamentEventId(eventId: string | null | undefined): boolean {
  return String(eventId ?? '').trim() === DEMO_TOURNAMENT_EVENT_ID;
}

export function isDemoTournamentMatchId(matchId: string | null | undefined): boolean {
  return String(matchId ?? '').trim().startsWith(DEMO_TOURNAMENT_MATCH_PREFIX);
}

function slotMatchId(n: number): string {
  return `${DEMO_TOURNAMENT_MATCH_PREFIX}tmslot${String(n).padStart(4, '0')}`;
}

function participantId(n: number): string {
  return `00000000-demo-5000-8000-tpart${String(n).padStart(4, '0')}`;
}

function tournamentSlotId(n: number): string {
  return `00000000-demo-5000-8000-tslot${String(n).padStart(4, '0')}`;
}

/** Kickoff am Turniertag relativ zu DEMO_EVENT_TIMES. */
function kickoffOnTournamentDay(hour: number, minute: number): string {
  const base = DEMO_EVENT_TIMES['ev-tournament']().starts;
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildSeed(): DemoTournamentState {
  const eid = DEMO_TOURNAMENT_EVENT_ID;

  const participants: TournamentParticipant[] = [
    { id: participantId(1), tournament_event_id: eid, team_name: OUR_TEAM, group_label: 'A', sort_order: 1 },
    {
      id: participantId(2),
      tournament_event_id: eid,
      team_name: 'SC St. Veit U12 – Demo',
      group_label: 'A',
      sort_order: 2,
    },
    {
      id: participantId(3),
      tournament_event_id: eid,
      team_name: 'SV Loosdorf U12 – Demo',
      group_label: 'A',
      sort_order: 3,
    },
    {
      id: participantId(4),
      tournament_event_id: eid,
      team_name: 'FC Traisental U12 – Demo',
      group_label: 'B',
      sort_order: 1,
    },
    {
      id: participantId(5),
      tournament_event_id: eid,
      team_name: 'SKN Nachwuchs U12 – Demo',
      group_label: 'B',
      sort_order: 2,
    },
    {
      id: participantId(6),
      tournament_event_id: eid,
      team_name: 'USC Alpenvorland U12 – Demo',
      group_label: 'B',
      sort_order: 3,
    },
  ];

  /** Produktives Modell: nur unsere Spiele (score_home = wir). */
  const slots: TournamentMatchSlotView[] = [
    {
      id: tournamentSlotId(1),
      tournament_event_id: eid,
      match_id: slotMatchId(1),
      opponent_name: 'SV Loosdorf U12 – Demo',
      kickoff_at: kickoffOnTournamentDay(9, 0),
      planned_minutes: TOURNAMENT_DEFAULT_PLANNED_MINUTES,
      pitch: 'Platz 1',
      group_label: 'A',
      phase: 'group',
      sort_order: 1,
      match_status: 'finished',
      score_home: 2,
      score_away: 2,
      has_lineup: true,
      has_squad: true,
    },
    {
      id: tournamentSlotId(2),
      tournament_event_id: eid,
      match_id: slotMatchId(2),
      opponent_name: 'SC St. Veit U12 – Demo',
      kickoff_at: kickoffOnTournamentDay(10, 30),
      planned_minutes: TOURNAMENT_DEFAULT_PLANNED_MINUTES,
      pitch: 'Platz 1',
      group_label: 'A',
      phase: 'group',
      sort_order: 2,
      match_status: 'finished',
      score_home: 2,
      score_away: 0,
      has_lineup: true,
      has_squad: true,
    },
    {
      id: tournamentSlotId(3),
      tournament_event_id: eid,
      match_id: slotMatchId(3),
      opponent_name: 'SC St. Veit U12 – Demo',
      kickoff_at: kickoffOnTournamentDay(14, 0),
      planned_minutes: TOURNAMENT_DEFAULT_PLANNED_MINUTES,
      pitch: 'Hauptplatz',
      group_label: null,
      phase: 'final',
      sort_order: 3,
      match_status: 'upcoming',
      score_home: 0,
      score_away: 0,
      has_lineup: false,
      has_squad: true,
    },
  ];

  return {
    participants,
    slots,
    squadPlayerIds: [...demoFixtures.tournament.squadPlayerIds],
    completion: {
      completedAt: null,
      completedBy: null,
      finalPlacement: null,
      finalTeamsCount: null,
      finalLabel: null,
    },
  };
}

let state: DemoTournamentState = buildSeed();

export function resetDemoTournamentState(): void {
  state = buildSeed();
  notify();
}

export function getDemoTournamentState(): DemoTournamentState {
  return {
    participants: state.participants.map((p) => ({ ...p })),
    slots: state.slots.map((s) => ({ ...s })),
    squadPlayerIds: [...state.squadPlayerIds],
    completion: { ...state.completion },
  };
}

export function getDemoTournamentParticipants(
  eventId: string,
): TournamentParticipant[] {
  if (!isDemoTournamentEventId(eventId)) return [];
  return state.participants.map((p) => ({ ...p }));
}

export function getDemoTournamentMatchSlots(eventId: string): TournamentMatchSlotView[] {
  if (!isDemoTournamentEventId(eventId)) return [];
  return state.slots.map((s) => ({ ...s }));
}

export function getDemoTournamentSquadPlayerIds(eventId: string): string[] {
  if (!isDemoTournamentEventId(eventId)) return [];
  return [...state.squadPlayerIds];
}

export function setDemoTournamentSquadPlayerIds(
  eventId: string,
  playerIds: string[],
): boolean {
  if (!isDemoTournamentEventId(eventId)) return false;
  state = {
    ...state,
    squadPlayerIds: [...new Set(playerIds.map((id) => String(id).trim()).filter(Boolean))],
  };
  notify();
  return true;
}

export function getDemoTournamentCompletion(eventId: string): TournamentCompletionState {
  if (!isDemoTournamentEventId(eventId)) {
    return {
      completedAt: null,
      completedBy: null,
      finalPlacement: null,
      finalTeamsCount: null,
      finalLabel: null,
    };
  }
  return { ...state.completion };
}

export function setDemoTournamentCompletion(
  eventId: string,
  next: TournamentCompletionState,
): boolean {
  if (!isDemoTournamentEventId(eventId)) return false;
  state = { ...state, completion: { ...next } };
  notify();
  return true;
}

export function addDemoTournamentParticipant(params: {
  tournamentEventId: string;
  teamName: string;
  groupLabel?: string | null;
}): { error: string | null } {
  if (!isDemoTournamentEventId(params.tournamentEventId)) {
    return { error: 'Kein Demo-Turnier.' };
  }
  const name = params.teamName.trim();
  if (!name) return { error: 'Mannschaftsname fehlt.' };
  if (state.participants.some((p) => p.team_name.toLowerCase() === name.toLowerCase())) {
    return { error: 'Mannschaft bereits vorhanden.' };
  }
  const sort_order = state.participants.length + 1;
  state = {
    ...state,
    participants: [
      ...state.participants,
      {
        id: participantId(sort_order + 10),
        tournament_event_id: DEMO_TOURNAMENT_EVENT_ID,
        team_name: name,
        group_label: params.groupLabel?.trim() || null,
        sort_order,
      },
    ],
  };
  notify();
  return { error: null };
}

export function removeDemoTournamentParticipant(participantId: string): boolean {
  const before = state.participants.length;
  state = {
    ...state,
    participants: state.participants.filter((p) => p.id !== participantId),
  };
  if (state.participants.length === before) return false;
  notify();
  return true;
}

export function importDemoTournamentParticipants(params: {
  tournamentEventId: string;
  groupLabel?: string | null;
  teamNames: string[];
}): { imported: number; error: string | null } {
  if (!isDemoTournamentEventId(params.tournamentEventId)) {
    return { imported: 0, error: 'Kein Demo-Turnier.' };
  }
  let imported = 0;
  for (const name of params.teamNames) {
    const res = addDemoTournamentParticipant({
      tournamentEventId: params.tournamentEventId,
      teamName: name,
      groupLabel: params.groupLabel,
    });
    if (!res.error) imported += 1;
  }
  return { imported, error: null };
}

export function applyDemoTournamentMatchResult(params: {
  matchId: string;
  ourGoals: number;
  oppGoals: number;
}): { applied: boolean; error: string | null } {
  const mid = String(params.matchId ?? '').trim();
  if (!isDemoTournamentMatchId(mid)) return { applied: false, error: 'Kein Demo-Turnierspiel.' };
  const idx = state.slots.findIndex((s) => s.match_id === mid);
  if (idx < 0) return { applied: false, error: 'Spiel nicht gefunden.' };
  const slot = state.slots[idx];
  if ((slot.match_status ?? '').toLowerCase() === 'live') {
    return { applied: false, error: null };
  }
  const next = [...state.slots];
  next[idx] = {
    ...slot,
    score_home: Math.max(0, Math.trunc(params.ourGoals)),
    score_away: Math.max(0, Math.trunc(params.oppGoals)),
    match_status: 'finished',
  };
  state = { ...state, slots: next };
  notify();
  return { applied: true, error: null };
}

export function patchDemoTournamentMatchSlot(
  matchId: string,
  patch: Partial<Pick<TournamentMatchSlotView, 'match_status' | 'score_home' | 'score_away' | 'has_lineup' | 'has_squad'>>,
): boolean {
  const mid = String(matchId ?? '').trim();
  const idx = state.slots.findIndex((s) => s.match_id === mid);
  if (idx < 0) return false;
  const next = [...state.slots];
  next[idx] = { ...next[idx], ...patch };
  state = { ...state, slots: next };
  notify();
  return true;
}

export function getDemoTournamentSlotByMatchId(
  matchId: string | null | undefined,
): TournamentMatchSlotView | null {
  const mid = String(matchId ?? '').trim();
  if (!mid) return null;
  return state.slots.find((s) => s.match_id === mid) ?? null;
}

export function getDemoTournamentEventIdForMatch(matchId: string | null | undefined): string | null {
  const slot = getDemoTournamentSlotByMatchId(matchId);
  return slot ? DEMO_TOURNAMENT_EVENT_ID : null;
}

/** Minimal-Matchzeile für Prep-Reads (kein LIVE). */
export function getDemoTournamentMatchLite(matchId: string | null | undefined): {
  id: string;
  team_season_id: string;
  opponent: string | null;
  match_date: string | null;
  location: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
  live_started_at: string | null;
  live_elapsed_seconds: number | null;
  live_is_running: boolean | null;
  live_period: number | null;
  period_scores: unknown | null;
  u11_formation_id: string | null;
  minimum_playtime_enabled: boolean | null;
  minimum_playtime_minutes: number | null;
  planned_match_minutes: number | null;
  auto_matchday_feed_enabled: boolean | null;
} | null {
  const slot = getDemoTournamentSlotByMatchId(matchId);
  if (!slot) return null;
  return {
    id: slot.match_id,
    team_season_id: DEMO_TEAM_SEASON_ID,
    opponent: slot.opponent_name,
    match_date: slot.kickoff_at,
    location: demoFixtures.tournament.location,
    status: slot.match_status,
    score_home: slot.score_home,
    score_away: slot.score_away,
    live_started_at: null,
    live_elapsed_seconds: 0,
    live_is_running: false,
    live_period: null,
    period_scores: null,
    u11_formation_id: '1-3-3-1',
    minimum_playtime_enabled: false,
    minimum_playtime_minutes: null,
    planned_match_minutes: slot.planned_minutes,
    auto_matchday_feed_enabled: false,
  };
}

export function createDemoTournamentMatchSlot(params: {
  tournamentEventId: string;
  opponentName: string;
  kickoffAt: string;
  pitch?: string | null;
  groupLabel?: string | null;
  phase?: string | null;
}): { error: string | null; matchId?: string } {
  if (!isDemoTournamentEventId(params.tournamentEventId)) {
    return { error: 'Kein Demo-Turnier.' };
  }
  const name = params.opponentName.trim();
  if (!name) return { error: 'Gegner fehlt.' };
  const n = state.slots.length + 1;
  const match_id = slotMatchId(n + 20);
  const slot: TournamentMatchSlotView = {
    id: tournamentSlotId(n + 20),
    tournament_event_id: DEMO_TOURNAMENT_EVENT_ID,
    match_id,
    opponent_name: name,
    kickoff_at: params.kickoffAt,
    planned_minutes: TOURNAMENT_DEFAULT_PLANNED_MINUTES,
    pitch: params.pitch ?? null,
    group_label: params.groupLabel ?? null,
    phase: params.phase ?? 'group',
    sort_order: n,
    match_status: 'upcoming',
    score_home: 0,
    score_away: 0,
    has_lineup: false,
    has_squad: false,
  };
  state = { ...state, slots: [...state.slots, slot] };
  notify();
  return { error: null, matchId: match_id };
}

export function removeDemoTournamentMatchSlot(matchId: string): boolean {
  const before = state.slots.length;
  state = { ...state, slots: state.slots.filter((s) => s.match_id !== matchId) };
  if (state.slots.length === before) return false;
  notify();
  return true;
}
