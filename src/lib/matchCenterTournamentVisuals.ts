import type { EventRow } from '../hooks/useEvents';
import { safeOptionalText, safeText } from './safeText';
import type { TournamentMatchSlotView, TournamentParticipant } from './tournamentPlan';
import defaultTournamentHeroArtwork from '../assets/branding/tournament-hero-default.png';

/** Globales Fallback-Hero für Turniere (Vite-Asset aus src/assets/branding). */
export const DEFAULT_TOURNAMENT_HERO_ARTWORK_URL = defaultTournamentHeroArtwork;

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

function isAllowedCoverUrl(url: unknown): boolean {
  const u = safeText(url);
  return COVER_PREFIXES.some((p) => u.startsWith(p));
}

export function resolveTournamentCoverUrl(
  event: EventRow,
  fallbackUrl: string = DEFAULT_TOURNAMENT_HERO_ARTWORK_URL,
): string {
  const extra = event as EventRow & MatchCenterTournamentEventExtras;
  const url = safeOptionalText(extra.tournament_cover_url);
  if (url && isAllowedCoverUrl(url)) return url;
  return fallbackUrl;
}

/** Für Turnier-Hero ohne EventRow — tournament_cover_url zuerst, sonst Branding-Fallback. */
export function resolveTournamentHeroBackgroundUrl(coverUrl?: string | null): string {
  const url = safeText(coverUrl);
  if (url && isAllowedCoverUrl(url)) return url;
  return DEFAULT_TOURNAMENT_HERO_ARTWORK_URL;
}

export function mapTournamentParticipants(rows: TournamentParticipantRow[]): MatchCenterParticipant[] {
  return rows
    .map((p) => ({
      name: safeText(p.team_name),
      logoUrl: safeOptionalText(p.logo_url),
    }))
    .filter((p) => p.name.length > 0);
}

function normalizePhase(phase: unknown): string {
  const p = safeText(phase).toLowerCase();
  if (!p) return '';
  if (p === 'final' || p === 'finale' || p.includes('finalspiel')) return 'final';
  if (p === 'semifinal' || p === 'halbfinale') return 'semifinal';
  if (
    p === 'placement' ||
    /spiel\s+um\s+platz/.test(p) ||
    /platz\s*\d+/.test(p) ||
    p.includes('platzierung')
  ) {
    return 'placement';
  }
  if (p === 'group' || p === 'gruppe' || p === 'vorrunde') return 'group';
  return p;
}

/** „Spiel um Platz 7“ aus Provider-Titel oder group_label (ohne Hardcode Platz 3). */
export function tournamentPlacementTitleFromLabel(label: string | null | undefined): string | null {
  const raw = safeText(label).replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const spielUm = raw.match(/spiel\s+um\s+platz\s*(\d+)/i);
  if (spielUm?.[1]) return `Spiel um Platz ${spielUm[1]}`;
  const platzOnly = raw.match(/^platz\s*(\d+)\b/i);
  if (platzOnly?.[1]) return `Spiel um Platz ${platzOnly[1]}`;
  if (/^\d+$/.test(raw)) return `Spiel um Platz ${raw}`;
  return null;
}

export function tournamentPhaseDisplayLabel(
  phase: string | null | undefined,
  groupLabel: string | null | undefined,
): string {
  const fromLabel = tournamentPlacementTitleFromLabel(groupLabel);
  if (fromLabel) return fromLabel;
  const fromPhase = tournamentPlacementTitleFromLabel(phase);
  if (fromPhase) return fromPhase;

  const p = normalizePhase(phase);
  if (p === 'final') return 'Finale';
  if (p === 'semifinal') return 'Halbfinale';
  if (p === 'placement') return 'Platzierungsspiel';
  const group = safeText(groupLabel);
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
  if (home > away) return safeOptionalText(ourTeamName);
  if (away > home) return safeOptionalText(finalSlot.opponent_name);
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
