import type { EventRow } from '../hooks/useEvents';
import type { TournamentMatchSlotView, TournamentParticipant } from './tournamentPlan';

const DEFAULT_COVER = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

export type MatchCenterTournamentEventExtras = {
  tournament_cover_url?: string | null;
};

export type MatchCenterParticipant = {
  name: string;
  logoUrl?: string | null;
};

export type TournamentParticipantRow = TournamentParticipant & {
  logo_url?: string | null;
};

const COVER_PREFIXES = ['/', 'https://'];

function isAllowedCoverUrl(url: string): boolean {
  const u = url.trim();
  return COVER_PREFIXES.some((p) => u.startsWith(p));
}

export function resolveTournamentCoverUrl(
  event: EventRow,
  fallbackUrl: string = DEFAULT_COVER,
): string {
  const extra = event as EventRow & MatchCenterTournamentEventExtras;
  const url = extra.tournament_cover_url?.trim();
  if (url && isAllowedCoverUrl(url)) return url;
  return fallbackUrl;
}

export function mapTournamentParticipants(rows: TournamentParticipantRow[]): MatchCenterParticipant[] {
  return rows
    .map((p) => ({
      name: p.team_name.trim(),
      logoUrl: p.logo_url?.trim() || null,
    }))
    .filter((p) => p.name.length > 0);
}

function normalizePhase(phase: string | null | undefined): string {
  const p = (phase ?? '').trim().toLowerCase();
  if (!p) return '';
  if (p === 'final' || p === 'finale' || p.includes('finalspiel')) return 'final';
  if (p === 'semifinal' || p === 'halbfinale') return 'semifinal';
  if (p === 'placement' || p.includes('platz 3') || p.includes('platzierung')) return 'placement';
  if (p === 'group' || p === 'gruppe' || p === 'vorrunde') return 'group';
  return p;
}

export function tournamentPhaseDisplayLabel(
  phase: string | null | undefined,
  groupLabel: string | null | undefined,
): string {
  const p = normalizePhase(phase);
  if (p === 'final') return 'Finale';
  if (p === 'semifinal') return 'Halbfinale';
  if (p === 'placement') return 'Spiel um Platz 3';
  const group = (groupLabel ?? '').trim();
  if (group) return `Gruppe ${group}`;
  if (p === 'group') return 'Gruppenspiel';
  return 'Turnierspiel';
}

/** Highlight-Spiel: LIVE → geplantes Finale → nächstes offenes Spiel. */
export function pickTournamentTopMatch(slots: TournamentMatchSlotView[]): TournamentMatchSlotView | null {
  if (slots.length === 0) return null;
  const live = slots.find((s) => (s.match_status ?? '').toLowerCase() === 'live');
  if (live) return live;
  const openFinal = slots.find(
    (s) =>
      normalizePhase(s.phase) === 'final' &&
      (s.match_status ?? '').toLowerCase() !== 'finished',
  );
  if (openFinal) return openFinal;
  const open = slots.find((s) => (s.match_status ?? '').toLowerCase() !== 'finished');
  return open ?? slots[0] ?? null;
}

export function pickTournamentFirstMatch(slots: TournamentMatchSlotView[]): TournamentMatchSlotView | null {
  if (slots.length === 0) return null;
  const sorted = [...slots].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
  );
  return sorted[0] ?? null;
}

export function resolveTournamentWinnerName(
  slots: TournamentMatchSlotView[],
  ourTeamName: string,
): string | null {
  const finalSlot = slots.find(
    (s) =>
      normalizePhase(s.phase) === 'final' &&
      (s.match_status ?? '').toLowerCase() === 'finished',
  );
  if (!finalSlot) return null;
  const home = Number(finalSlot.score_home ?? 0);
  const away = Number(finalSlot.score_away ?? 0);
  if (home > away) return ourTeamName.trim() || null;
  if (away > home) return finalSlot.opponent_name.trim() || null;
  return null;
}

export function resolveTournamentWinnerDisplay(
  slots: TournamentMatchSlotView[],
  ourTeamName: string,
  completed: boolean,
): string {
  const winner = resolveTournamentWinnerName(slots, ourTeamName);
  if (winner) return winner;
  return completed ? '—' : 'Offen';
}
