import { supabase } from './supabaseClient';
import type { TournamentTeamBalance, TournamentMatchSlotView } from './tournamentPlan';
import type { TournamentGoalScorer } from './tournamentGoalScorers';
import { buildTournamentReportText } from './tournamentReportText';
import type { TournamentFinalSummary } from './tournamentFinalSummary';
import { safeText } from './safeText';
import { formatTournamentKickoffTime, tournamentMatchDisplayStatus } from './tournamentPlan';

export type TournamentCompletionFeedPayload = {
  event_id: string;
  tournament_title: string;
  placement_line: string;
  teams_count: number | null;
  balance: Pick<
    TournamentTeamBalance,
    'played' | 'wins' | 'draws' | 'losses' | 'goalsFor' | 'goalsAgainst' | 'points'
  >;
  top_scorer: { playerName: string; goals: number } | null;
  results: Array<{ opponent: string; scoreLine: string; kickoff: string }>;
  completion_comment: string | null;
};

export function tournamentCompletionFeedDedupeKey(eventId: string): string {
  return `tournament_completion:${eventId.trim()}`;
}

export function buildTournamentCompletionFeedCaption(params: {
  tournamentTitle: string;
  placementLine: string;
  balance: TournamentTeamBalance;
  topScorer: TournamentGoalScorer | null;
  completionComment?: string | null;
}): string {
  const lines: string[] = ['Turnier abgeschlossen', ''];
  lines.push(safeText(params.tournamentTitle) || 'Turnier');
  lines.push('');
  lines.push(params.placementLine);
  lines.push('');
  lines.push(
    `${params.balance.played} ${params.balance.played === 1 ? 'Spiel' : 'Spiele'} · ${params.balance.wins} ${params.balance.wins === 1 ? 'Sieg' : 'Siege'}`,
  );
  lines.push(`${params.balance.goalsFor}:${params.balance.goalsAgainst} Tore · ${params.balance.points} Punkte`);
  if (params.topScorer) {
    lines.push('');
    lines.push(`Top-Torschütze: ${params.topScorer.playerName} (${params.topScorer.goals})`);
  }
  const comment = params.completionComment?.trim();
  if (comment) {
    lines.push('');
    lines.push(comment);
  }
  lines.push('', '#GEMEINSAMEINTEAM');
  return lines.join('\n');
}

export function buildTournamentCompletionFeedPayload(params: {
  eventId: string;
  tournamentTitle: string;
  placementLine: string;
  teamsCount: number | null;
  balance: TournamentTeamBalance;
  goalScorers: TournamentGoalScorer[];
  slots: TournamentMatchSlotView[];
  completionComment?: string | null;
}): TournamentCompletionFeedPayload {
  const finished = params.slots
    .filter((slot) => (slot.match_status ?? '').toLowerCase() === 'finished')
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

  const results = finished
    .map((slot) => {
      const status = tournamentMatchDisplayStatus(slot);
      if (status.kind !== 'result') return null;
      return {
        opponent: slot.opponent_name,
        scoreLine: `${status.ourGoals}:${status.oppGoals}`,
        kickoff: formatTournamentKickoffTime(slot.kickoff_at),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const top = params.goalScorers[0] ?? null;

  return {
    event_id: params.eventId,
    tournament_title: safeText(params.tournamentTitle) || 'Turnier',
    placement_line: params.placementLine,
    teams_count: params.teamsCount,
    balance: {
      played: params.balance.played,
      wins: params.balance.wins,
      draws: params.balance.draws,
      losses: params.balance.losses,
      goalsFor: params.balance.goalsFor,
      goalsAgainst: params.balance.goalsAgainst,
      points: params.balance.points,
    },
    top_scorer: top ? { playerName: top.playerName, goals: top.goals } : null,
    results,
    completion_comment: params.completionComment?.trim() || null,
  };
}

async function resolveTeamId(teamSeasonId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();
  if (error || !data?.team_id) return null;
  return String(data.team_id);
}

export async function isTournamentCompletionFeedPublished(eventId: string): Promise<boolean> {
  const dedupeKey = tournamentCompletionFeedDedupeKey(eventId);
  const { data, error } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

export type PublishTournamentCompletionFeedResult =
  | { ok: true }
  | { ok: false; reason: 'already_posted' | 'missing_team' | string };

export async function publishTournamentCompletionFeedPost(params: {
  eventId: string;
  teamSeasonId: string;
  userId: string | null;
  caption: string;
  payload: TournamentCompletionFeedPayload;
}): Promise<PublishTournamentCompletionFeedResult> {
  const dedupeKey = tournamentCompletionFeedDedupeKey(params.eventId);
  const already = await isTournamentCompletionFeedPublished(params.eventId);
  if (already) return { ok: false, reason: 'already_posted' };

  const teamId = await resolveTeamId(params.teamSeasonId);
  if (!teamId) return { ok: false, reason: 'missing_team' };

  const { error } = await supabase.from('team_feed_posts').insert({
    team_season_id: params.teamSeasonId,
    team_id: teamId,
    event_id: params.eventId,
    post_kind: 'tournament_completion_manual',
    caption: params.caption,
    payload: params.payload,
    dedupe_key: dedupeKey,
    media_type: 'tournament_completion',
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: params.userId,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'already_posted' };
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

export function buildTournamentCompletionReportText(params: {
  tournamentTitle: string;
  summary: TournamentFinalSummary | null;
  balance: TournamentTeamBalance;
  placementLine: string;
  goalScorers: TournamentGoalScorer[];
  completionComment?: string | null;
}): string {
  if (params.summary?.finalPlacementLabel) {
    const base = buildTournamentReportText({
      tournamentTitle: params.tournamentTitle,
      summary: params.summary,
      balance: params.balance,
      finalMatch: params.summary.finalMatch,
      goalScorers: params.goalScorers,
    });
    const comment = params.completionComment?.trim();
    if (!comment) return base;
    return `${base.replace(/\n#GEMEINSAMEINTEAM\s*$/, '')}\n\n${comment}\n\n#GEMEINSAMEINTEAM`;
  }

  const lines = [
    `Starker Auftritt beim ${safeText(params.tournamentTitle) || 'Turnier'}!`,
    '',
    params.placementLine,
    '',
    `${params.balance.played} ${params.balance.played === 1 ? 'Spiel' : 'Spiele'} · ${params.balance.wins} ${params.balance.wins === 1 ? 'Sieg' : 'Siege'}`,
    `${params.balance.goalsFor}:${params.balance.goalsAgainst} Tore`,
  ];
  if (params.goalScorers.length > 0) {
    lines.push('', 'Torschützen:');
    for (const scorer of params.goalScorers.slice(0, 5)) {
      lines.push(`• ${scorer.playerName} (${scorer.goals})`);
    }
  }
  const comment = params.completionComment?.trim();
  if (comment) {
    lines.push('', comment);
  }
  lines.push('', '#GEMEINSAMEINTEAM');
  return lines.join('\n');
}
