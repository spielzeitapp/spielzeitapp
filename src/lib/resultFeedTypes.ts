/**
 * Automatische Ergebnis-Feedposts (MVP: JSON + UI, kein PNG/Storage).
 */

import { displayMatchMinuteFromEffectiveSeconds } from './matchEngine';

export type ResultFeedScorer = {
  player_name: string;
  /** z. B. "23'" aus Spielsekunden */
  minute_label: string;
};

export type ResultFeedPayload = {
  match_id: string;
  event_id: string | null;
  team_season_id: string;
  home_team_name: string;
  away_team_name: string;
  home_logo_url: string;
  away_logo_url: string;
  home_score: number;
  away_score: number;
  match_type: string | null;
  starts_at: string | null;
  meeting_at: string | null;
  location: string;
  /** Nur Tore unserer Mannschaft (für Card) */
  scorers: ResultFeedScorer[];
  period_scores: unknown;
  result_state: 'win' | 'draw' | 'loss';
  our_team_name: string;
  is_home: boolean;
  deep_link: string;
};

export function parseResultFeedPayload(raw: unknown): ResultFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const matchId = typeof p.match_id === 'string' ? p.match_id : '';
  const teamSeasonId = typeof p.team_season_id === 'string' ? p.team_season_id : '';
  if (!matchId || !teamSeasonId) return null;

  const homeScore = Number(p.home_score);
  const awayScore = Number(p.away_score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;

  const rs = p.result_state;
  const result_state =
    rs === 'win' || rs === 'draw' || rs === 'loss' ? rs : ('draw' as const);

  const scorersRaw = Array.isArray(p.scorers) ? p.scorers : [];
  const scorers: ResultFeedScorer[] = [];
  for (const s of scorersRaw) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const player_name = typeof o.player_name === 'string' ? o.player_name : '—';
    const minute_label = typeof o.minute_label === 'string' ? o.minute_label : '—';
    scorers.push({ player_name, minute_label });
  }

  return {
    match_id: matchId,
    event_id: typeof p.event_id === 'string' ? p.event_id : null,
    team_season_id: teamSeasonId,
    home_team_name: String(p.home_team_name ?? ''),
    away_team_name: String(p.away_team_name ?? ''),
    home_logo_url: typeof p.home_logo_url === 'string' ? p.home_logo_url : '',
    away_logo_url: typeof p.away_logo_url === 'string' ? p.away_logo_url : '',
    home_score: Math.max(0, Math.trunc(homeScore)),
    away_score: Math.max(0, Math.trunc(awayScore)),
    match_type: typeof p.match_type === 'string' ? p.match_type : null,
    starts_at: typeof p.starts_at === 'string' ? p.starts_at : null,
    meeting_at: typeof p.meeting_at === 'string' ? p.meeting_at : null,
    location: String(p.location ?? ''),
    scorers,
    period_scores: p.period_scores ?? null,
    result_state,
    our_team_name: String(p.our_team_name ?? ''),
    is_home: Boolean(p.is_home),
    deep_link: typeof p.deep_link === 'string' ? p.deep_link : `/app/live?matchId=${matchId}`,
  };
}

export function formatGoalMinuteLabel(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(seconds ?? 0) || 0));
  const m = displayMatchMinuteFromEffectiveSeconds(s);
  return m <= 0 ? "0'" : `${m}'`;
}

export function buildAutoResultCaption(params: {
  ourTeamName: string;
  opponentName: string;
  homeScore: number;
  awayScore: number;
  resultState: 'win' | 'draw' | 'loss';
}): string {
  const us = (params.ourTeamName || '').trim() || 'Unser Team';
  const opp = (params.opponentName || '').trim() || 'Gegner';
  const scoreStr = `${params.homeScore}:${params.awayScore}`;

  if (params.resultState === 'win') {
    return `🔥 ENDSTAND!\n${us} gewinnt ${scoreStr} gegen ${opp}.\nStarker Einsatz unserer Mannschaft!\n#GEMEINSAMEINTEAM`;
  }
  if (params.resultState === 'draw') {
    return `⚽ ENDSTAND!\n${us} trennt sich ${scoreStr} von ${opp}.\nGemeinsam bis zum Schluss gekämpft!\n#GEMEINSAMEINTEAM`;
  }
  return `⚽ ENDSTAND!\n${us} unterliegt ${scoreStr} gegen ${opp}.\nKopf hoch – wir lernen weiter und bleiben ein Team.\n#GEMEINSAMEINTEAM`;
}
