/**
 * Aktives Live-Spiel für die Termine-Seite.
 * Source of Truth: `matches.status === 'live'` (wie Bottom-Nav / Live-Tab).
 * Keine parallele Live-Architektur — Turnier über tournament_matches-Lookup.
 */

import type { EventRow } from '../hooks/useEvents';
import { getMatchTypeLabel } from '../components/match/matchCardLabels';
import { formatTimeHHmmDe } from '../components/schedule/scheduleEventViewUtils';
import { supabase } from './supabaseClient';
import { safeOptionalText, safeText } from './safeText';
import {
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  isOwnPlayableTournamentSlot,
} from './tournamentPlan';
import {
  mapTournamentParticipants,
  type TournamentParticipantRow,
} from './matchCenterTournamentVisuals';
import { getClubLogo } from './teamLogos';

export type ScheduleActiveLiveMatch = {
  matchId: string;
  /** Kurzlabel hinter LIVE · … */
  kindLabel: string;
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  scoreHome: number;
  scoreAway: number;
  kickoffLabel: string | null;
  venueLabel: string | null;
};

type LiveMatchRow = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  match_date: string | null;
  location: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
};

function kindLabelForMatchType(matchType: string | null | undefined, isTournament: boolean): string {
  if (isTournament) return 'TURNIERSPIEL';
  const mt = safeText(matchType).toLowerCase();
  if (mt === 'league' || mt === 'game') return 'MEISTERSCHAFT';
  if (mt === 'friendly') return 'FREUNDSCHAFTSSPIEL';
  if (mt === 'cup') return 'POKAL';
  if (mt === 'tournament') return 'TURNIERSPIEL';
  const labeled = getMatchTypeLabel(matchType);
  if (labeled) {
    return labeled
      .replace(/spiel$/i, '')
      .trim()
      .toUpperCase() || 'SPIEL';
  }
  return 'SPIEL';
}

function formatKickoffLabel(iso: string | null | undefined): string | null {
  const t = formatTimeHHmmDe(iso);
  return t ? `${t} Uhr` : null;
}

async function loadLiveMatchRow(
  teamSeasonId: string,
  matchIdHint?: string | null,
): Promise<LiveMatchRow | null> {
  const hint = safeText(matchIdHint);
  if (hint) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, team_season_id, opponent, match_date, location, status, score_home, score_away')
      .eq('id', hint)
      .maybeSingle();
    if (
      !error &&
      data &&
      String(data.team_season_id ?? '') === teamSeasonId &&
      String(data.status ?? '').toLowerCase() === 'live'
    ) {
      return data as LiveMatchRow;
    }
  }

  const { data, error } = await supabase
    .from('matches')
    .select('id, team_season_id, opponent, match_date, location, status, score_home, score_away')
    .eq('team_season_id', teamSeasonId)
    .eq('status', 'live')
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as LiveMatchRow;
}

async function buildTournamentLive(
  match: LiveMatchRow,
  ourTeamName: string,
): Promise<ScheduleActiveLiveMatch | null> {
  const { data: link, error } = await supabase
    .from('tournament_matches')
    .select('tournament_event_id')
    .eq('match_id', match.id)
    .maybeSingle();

  if (error || !link?.tournament_event_id) return null;

  const tournamentEventId = String(link.tournament_event_id);
  const [slotsRes, participantsRes] = await Promise.all([
    fetchTournamentMatchSlots(tournamentEventId),
    fetchTournamentParticipants(tournamentEventId),
  ]);

  const slot =
    (slotsRes.data ?? []).find(
      (s) => s.match_id === match.id && isOwnPlayableTournamentSlot(s),
    ) ?? null;
  if (!slot || String(slot.match_status ?? '').toLowerCase() !== 'live') return null;

  const participants = mapTournamentParticipants(
    (participantsRes.data ?? []) as TournamentParticipantRow[],
  );
  const logoByName = new Map<string, string | null>();
  for (const p of participants) {
    logoByName.set(safeText(p.name).toLowerCase(), safeOptionalText(p.logoUrl));
  }

  const homeTeamName = safeText(ourTeamName) || 'Unser Team';
  const awayTeamName = safeText(slot.opponent_name) || safeText(match.opponent) || 'Gegner';
  const awayLogo = logoByName.get(awayTeamName.toLowerCase()) ?? null;

  return {
    matchId: match.id,
    kindLabel: kindLabelForMatchType(null, true),
    homeTeamName,
    awayTeamName,
    homeLogoUrl: getClubLogo(homeTeamName, { ourTeam: true }),
    awayLogoUrl: awayLogo ? getClubLogo(awayTeamName, { logoUrl: awayLogo }) : getClubLogo(awayTeamName),
    scoreHome: Number(match.score_home ?? 0),
    scoreAway: Number(match.score_away ?? 0),
    kickoffLabel: formatKickoffLabel(slot.kickoff_at ?? match.match_date),
    venueLabel: safeOptionalText(slot.pitch) ?? safeOptionalText(match.location),
  };
}

async function buildRegularLive(
  match: LiveMatchRow,
  events: EventRow[],
  ourTeamName: string,
): Promise<ScheduleActiveLiveMatch | null> {
  let event = events.find((e) => e.match_id === match.id) ?? null;
  if (!event) {
    const { data } = await supabase
      .from('events')
      .select(
        'id, team_season_id, kind, type, match_type, opponent, is_home, location, starts_at, status, match_id, opponent_logo_url',
      )
      .eq('match_id', match.id)
      .maybeSingle();
    if (data) event = data as EventRow;
  }

  const opponent =
    safeOptionalText(event?.opponent) || safeOptionalText(match.opponent) || 'Gegner';
  const isHome = event?.is_home !== false;
  const homeTeamName = isHome ? safeText(ourTeamName) || 'Unser Team' : opponent;
  const awayTeamName = isHome ? opponent : safeText(ourTeamName) || 'Unser Team';
  const oppLogo = safeOptionalText(event?.opponent_logo_url);

  return {
    matchId: match.id,
    kindLabel: kindLabelForMatchType(event?.match_type ?? null, false),
    homeTeamName,
    awayTeamName,
    homeLogoUrl: isHome
      ? getClubLogo(homeTeamName, { ourTeam: true })
      : oppLogo
        ? getClubLogo(homeTeamName, { logoUrl: oppLogo })
        : getClubLogo(homeTeamName),
    awayLogoUrl: isHome
      ? oppLogo
        ? getClubLogo(awayTeamName, { logoUrl: oppLogo })
        : getClubLogo(awayTeamName)
      : getClubLogo(awayTeamName, { ourTeam: true }),
    scoreHome: Number(match.score_home ?? 0),
    scoreAway: Number(match.score_away ?? 0),
    kickoffLabel: formatKickoffLabel(event?.starts_at ?? match.match_date),
    venueLabel: safeOptionalText(event?.location) ?? safeOptionalText(match.location),
  };
}

export async function fetchActiveScheduleLiveMatch(params: {
  teamSeasonId: string;
  events: EventRow[];
  ourTeamName: string;
  matchIdHint?: string | null;
}): Promise<ScheduleActiveLiveMatch | null> {
  const teamSeasonId = safeText(params.teamSeasonId);
  if (!teamSeasonId) return null;

  const match = await loadLiveMatchRow(teamSeasonId, params.matchIdHint);
  if (!match) return null;

  const tournament = await buildTournamentLive(match, params.ourTeamName);
  if (tournament) return tournament;

  return buildRegularLive(match, params.events, params.ourTeamName);
}
