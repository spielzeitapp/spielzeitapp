import { supabase } from './supabaseClient';
import type { EventRow } from '../hooks/useEvents';
import {
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  type TournamentMatchSlotView,
} from './tournamentPlan';
import { fetchTournamentCompletion } from './tournamentCompletion';
import {
  mapTournamentParticipants,
  type MatchCenterParticipant,
  type TournamentParticipantRow,
} from './matchCenterTournamentVisuals';
import { VIENNA_TZ } from './viennaTime';

export type TournamentLiveMatchDetails = {
  scoreHome: number;
  scoreAway: number;
  liveElapsedSeconds: number;
  liveIsRunning: boolean;
  livePeriod: number;
};

export type ActiveTournamentLiveContext = {
  tournamentEvent: EventRow;
  slot: TournamentMatchSlotView;
  participants: MatchCenterParticipant[];
  liveDetails: TournamentLiveMatchDetails;
};

function isCanceledOrFinishedEvent(e: EventRow): boolean {
  const st = e.status ?? 'upcoming';
  return st === 'finished' || st === 'canceled';
}

function isSameViennaCalendarDay(isoA: string, isoB: Date): boolean {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: VIENNA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dayA = fmt(new Date(isoA));
  const dayB = fmt(isoB);
  return dayA === dayB && dayA !== 'Invalid Date';
}

/** Turniere, an denen heute oder kürzlich gespielt wird — für Live-Scan. */
export function pickTournamentEventsForLiveScan(events: EventRow[], now: Date): EventRow[] {
  const nowMs = now.getTime();
  return events
    .filter((e) => {
      if (e.kind !== 'tournament') return false;
      if (isCanceledOrFinishedEvent(e)) return false;
      if (!e.starts_at?.trim()) return false;
      const startMs = new Date(e.starts_at).getTime();
      if (Number.isNaN(startMs)) return false;
      if (isSameViennaCalendarDay(e.starts_at, now)) return true;
      const hoursSinceStart = (nowMs - startMs) / 3_600_000;
      return startMs <= nowMs && hoursSinceStart <= 36;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

export function pickLiveTournamentSlot(slots: TournamentMatchSlotView[]): TournamentMatchSlotView | null {
  return slots.find((s) => (s.match_status ?? '').toLowerCase() === 'live') ?? null;
}

async function fetchLiveMatchDetails(matchId: string): Promise<TournamentLiveMatchDetails | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('status, score_home, score_away, live_elapsed_seconds, live_is_running, live_period, team_season_id')
    .eq('id', matchId)
    .maybeSingle();

  if (error || !data || (data.status ?? '').toLowerCase() !== 'live') return null;

  return {
    scoreHome: Number(data.score_home ?? 0),
    scoreAway: Number(data.score_away ?? 0),
    liveElapsedSeconds: Number(data.live_elapsed_seconds ?? 0) || 0,
    liveIsRunning: Boolean(data.live_is_running),
    livePeriod: Number(data.live_period ?? 1) || 1,
  };
}

async function resolveTournamentEventForMatch(
  matchId: string,
  events: EventRow[],
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('tournament_event_id')
    .eq('match_id', matchId)
    .maybeSingle();

  if (error || !data?.tournament_event_id) return null;
  const eventId = String(data.tournament_event_id);
  const fromList = events.find((e) => e.id === eventId);
  if (fromList) return fromList;

  const { data: row } = await supabase
    .from('events')
    .select('id, team_season_id, kind, opponent, starts_at, location, notes, status, official_tournament_url')
    .eq('id', eventId)
    .maybeSingle();

  if (!row || (row.kind ?? '') !== 'tournament') return null;
  return row as EventRow;
}

async function buildContextForLiveSlot(
  tournamentEvent: EventRow,
  slot: TournamentMatchSlotView,
  liveDetails: TournamentLiveMatchDetails,
): Promise<ActiveTournamentLiveContext | null> {
  const completion = await fetchTournamentCompletion(tournamentEvent.id);
  if (completion.data.completedAt) return null;

  const participantsRes = await fetchTournamentParticipants(tournamentEvent.id);
  const participantRows = (participantsRes.data ?? []) as TournamentParticipantRow[];

  return {
    tournamentEvent,
    slot,
    participants: mapTournamentParticipants(participantRows),
    liveDetails,
  };
}

async function contextFromMatchIdHint(
  teamSeasonId: string,
  events: EventRow[],
  matchId: string,
): Promise<ActiveTournamentLiveContext | null> {
  const liveDetails = await fetchLiveMatchDetails(matchId);
  if (!liveDetails) return null;

  const { data: matchRow } = await supabase
    .from('matches')
    .select('team_season_id')
    .eq('id', matchId)
    .maybeSingle();

  if (String(matchRow?.team_season_id ?? '') !== teamSeasonId) return null;

  const tournamentEvent = await resolveTournamentEventForMatch(matchId, events);
  if (!tournamentEvent || tournamentEvent.team_season_id !== teamSeasonId) return null;

  const slotsRes = await fetchTournamentMatchSlots(tournamentEvent.id);
  const slot = (slotsRes.data ?? []).find((s) => s.match_id === matchId) ?? null;
  if (!slot || (slot.match_status ?? '').toLowerCase() !== 'live') return null;

  return buildContextForLiveSlot(tournamentEvent, slot, liveDetails);
}

async function contextFromEventScan(
  teamSeasonId: string,
  events: EventRow[],
  now: Date,
): Promise<ActiveTournamentLiveContext | null> {
  const candidates = pickTournamentEventsForLiveScan(events, now).filter(
    (e) => e.team_season_id === teamSeasonId,
  );

  for (const tournamentEvent of candidates) {
    const completion = await fetchTournamentCompletion(tournamentEvent.id);
    if (completion.data.completedAt) continue;

    const slotsRes = await fetchTournamentMatchSlots(tournamentEvent.id);
    const liveSlot = pickLiveTournamentSlot(slotsRes.data ?? []);
    if (!liveSlot) continue;

    const liveDetails = await fetchLiveMatchDetails(liveSlot.match_id);
    if (!liveDetails) continue;

    const { data: matchRow } = await supabase
      .from('matches')
      .select('team_season_id')
      .eq('id', liveSlot.match_id)
      .maybeSingle();

    if (String(matchRow?.team_season_id ?? '') !== teamSeasonId) continue;

    const ctx = await buildContextForLiveSlot(tournamentEvent, liveSlot, liveDetails);
    if (ctx) return ctx;
  }

  return null;
}

export async function fetchActiveTournamentLiveContext(params: {
  teamSeasonId: string;
  events: EventRow[];
  now: Date;
  matchIdHint?: string | null;
}): Promise<ActiveTournamentLiveContext | null> {
  const { teamSeasonId, events, now, matchIdHint } = params;
  if (!teamSeasonId.trim()) return null;

  const hint = matchIdHint?.trim();
  if (hint) {
    const fromHint = await contextFromMatchIdHint(teamSeasonId, events, hint);
    if (fromHint) return fromHint;
  }

  return contextFromEventScan(teamSeasonId, events, now);
}

export async function isTournamentLiveMatchForTeam(
  matchId: string,
  teamSeasonId: string,
): Promise<boolean> {
  if (!matchId.trim() || !teamSeasonId.trim()) return false;

  const { data: matchRow } = await supabase
    .from('matches')
    .select('team_season_id, status')
    .eq('id', matchId)
    .maybeSingle();

  if ((matchRow?.status ?? '').toLowerCase() !== 'live') return false;
  if (String(matchRow?.team_season_id ?? '') !== teamSeasonId) return false;

  const { data: slotRow } = await supabase
    .from('tournament_matches')
    .select('id')
    .eq('match_id', matchId)
    .maybeSingle();

  return Boolean(slotRow?.id);
}

export function formatTournamentLivePhaseLabel(period: number): string {
  if (period >= 3) return 'Verlängerung';
  if (period === 2) return '2. Halbzeit';
  return '1. Halbzeit';
}

export function formatTournamentLiveClock(seconds: number, plannedMinutes: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const capMin = Math.max(1, plannedMinutes);
  const minute = Math.min(capMin, Math.max(1, Math.ceil(safeSec / 60) || 1));
  return `${minute}. Min`;
}
