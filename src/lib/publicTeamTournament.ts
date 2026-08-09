/**
 * TURNIER.1 – öffentliche Team-Turnierseite (View-Model + Client-Fetch).
 * Nur unser Team / unsere Spiele. Keine privaten Felder.
 */

import { normalizeOefbImportedTeamName } from './oefbTeamNameNormalize';
import { getOurTeamDisplayName, getOurTeamLogoUrl } from './teamLogos';
import { VIENNA_TZ } from './viennaTime';

export type PublicTeamTournamentMatchStatus = 'upcoming' | 'live' | 'finished' | 'canceled';

export type PublicTeamTournamentMatchDto = {
  id: string;
  kickoffAt: string;
  kickoffTimeLabel: string;
  pitch: string | null;
  groupLabel: string | null;
  phase: string | null;
  opponentName: string;
  ourTeamName: string;
  homeName: string;
  awayName: string;
  ourIsHome: boolean;
  status: PublicTeamTournamentMatchStatus;
  statusLabel: string;
  scoreOur: number | null;
  scoreOpp: number | null;
  isLive: boolean;
};

export type PublicTeamTournamentPageDto = {
  publicId: string;
  tournamentName: string;
  dateLabel: string;
  venue: string | null;
  teamName: string;
  ageGroupLabel: string | null;
  teamLogoUrl: string | null;
  tournamentStatus: 'upcoming' | 'live' | 'finished' | 'canceled';
  tournamentStatusLabel: string;
  nextMatch: PublicTeamTournamentMatchDto | null;
  upcomingMatches: PublicTeamTournamentMatchDto[];
  results: PublicTeamTournamentMatchDto[];
  allMatches: PublicTeamTournamentMatchDto[];
};

export function publicTeamTournamentPath(publicId: string): string {
  return `/turnier/${encodeURIComponent(String(publicId).trim())}`;
}

export function publicTeamTournamentAbsoluteUrl(publicId: string): string {
  if (typeof window === 'undefined') return publicTeamTournamentPath(publicId);
  const path = publicTeamTournamentPath(publicId);
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const origin = window.location.origin;
  return `${origin}${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
}

export async function sharePublicTeamTournamentPage(
  title: string,
  publicId: string,
): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof window === 'undefined') return 'failed';
  const url = publicTeamTournamentAbsoluteUrl(publicId);
  const shareTitle = title.trim() || 'Turnierseite';
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: shareTitle, url, text: shareTitle });
      return 'shared';
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return 'copied';
    }
  } catch {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return 'copied';
      }
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}

function formatViennaDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatViennaTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function splitPublicTeamDisplay(
  rawName: string | null | undefined,
  ageGroupHint?: string | null,
): { teamName: string; ageGroupLabel: string | null } {
  const hint = String(ageGroupHint ?? '')
    .trim()
    .toUpperCase();
  const hintMatch = hint.match(/^U\d{1,2}[A-Z]?$/i);
  const normalized = normalizeOefbImportedTeamName(rawName);
  const leading = normalized.match(/^(U\d{1,2}[A-Za-z]?)\s+(.+)$/);
  if (hintMatch) {
    const club =
      normalized.replace(new RegExp(`^${hintMatch[0]}\\s+`, 'i'), '').trim() || normalized;
    return { teamName: club || 'Mannschaft', ageGroupLabel: hintMatch[0].toUpperCase() };
  }
  if (leading) {
    return {
      teamName: leading[2]!.trim() || normalized,
      ageGroupLabel: leading[1]!.toUpperCase(),
    };
  }
  return { teamName: normalized || 'Mannschaft', ageGroupLabel: null };
}

function normalizeMatchStatus(raw: string | null | undefined): PublicTeamTournamentMatchStatus {
  const st = String(raw ?? 'upcoming').trim().toLowerCase();
  if (st === 'live') return 'live';
  if (st === 'finished' || st === 'ended' || st === 'completed') return 'finished';
  if (st === 'canceled' || st === 'cancelled') return 'canceled';
  return 'upcoming';
}

function publicStatusLabel(status: PublicTeamTournamentMatchStatus): string {
  if (status === 'live') return 'LIVE';
  if (status === 'finished') return 'Beendet';
  if (status === 'canceled') return 'Abgesagt';
  return 'Demnächst';
}

export type PublicTournamentSlotInput = {
  id?: string;
  match_id?: string;
  opponent_name?: string;
  kickoff_at?: string;
  pitch?: string | null;
  group_label?: string | null;
  phase?: string | null;
  sort_order?: number;
  match_status?: string | null;
  score_home?: number;
  score_away?: number;
};

export function sortPublicSlotsChronologically<T extends PublicTournamentSlotInput>(slots: T[]): T[] {
  return [...slots].sort((a, b) => {
    const ta = Date.parse(a.kickoff_at ?? '');
    const tb = Date.parse(b.kickoff_at ?? '');
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
  });
}

export function pickNextOpenPublicSlot(
  slots: PublicTournamentSlotInput[],
): PublicTournamentSlotInput | null {
  const sorted = sortPublicSlotsChronologically(slots);
  const live = sorted.find((s) => normalizeMatchStatus(s.match_status) === 'live');
  if (live) return live;
  return (
    sorted.find((s) => {
      const st = normalizeMatchStatus(s.match_status);
      return st !== 'finished' && st !== 'canceled';
    }) ?? null
  );
}

function toPublicMatchDto(
  slot: PublicTournamentSlotInput,
  ourTeamName: string,
): PublicTeamTournamentMatchDto {
  const our = normalizeOefbImportedTeamName(ourTeamName) || 'Unser Team';
  const opp = normalizeOefbImportedTeamName(slot.opponent_name) || 'Gegner';
  const status = normalizeMatchStatus(slot.match_status);
  const scoreOur = status === 'finished' || status === 'live' ? Number(slot.score_home ?? 0) : null;
  const scoreOpp = status === 'finished' || status === 'live' ? Number(slot.score_away ?? 0) : null;
  return {
    id: String(slot.match_id ?? slot.id ?? ''),
    kickoffAt: String(slot.kickoff_at ?? ''),
    kickoffTimeLabel: formatViennaTimeLabel(slot.kickoff_at ?? ''),
    pitch: slot.pitch ? String(slot.pitch).trim() || null : null,
    groupLabel: slot.group_label ?? null,
    phase: slot.phase ?? null,
    opponentName: opp,
    ourTeamName: our,
    homeName: our,
    awayName: opp,
    ourIsHome: true,
    status,
    statusLabel: publicStatusLabel(status),
    scoreOur,
    scoreOpp,
    isLive: status === 'live',
  };
}

export function buildPublicTeamTournamentPageDto(input: {
  publicId: string;
  tournamentName?: string | null;
  notes?: string | null;
  startsAt: string;
  venue?: string | null;
  teamName: string;
  ageGroup?: string | null;
  teamLogoUrl?: string | null;
  eventStatus?: string | null;
  slots: PublicTournamentSlotInput[];
}): PublicTeamTournamentPageDto {
  const { teamName, ageGroupLabel } = splitPublicTeamDisplay(input.teamName, input.ageGroup);
  const slots = sortPublicSlotsChronologically(input.slots);
  const matches = slots.map((s) => toPublicMatchDto(s, teamName));
  const nextRaw = pickNextOpenPublicSlot(slots);
  const nextMatch = nextRaw ? toPublicMatchDto(nextRaw, teamName) : null;

  const es = String(input.eventStatus ?? '').trim().toLowerCase();
  let tournamentStatus: PublicTeamTournamentPageDto['tournamentStatus'] = 'upcoming';
  let tournamentStatusLabel = 'Bevorstehend';
  if (es === 'canceled' || es === 'cancelled') {
    tournamentStatus = 'canceled';
    tournamentStatusLabel = 'Abgesagt';
  } else if (slots.some((s) => normalizeMatchStatus(s.match_status) === 'live')) {
    tournamentStatus = 'live';
    tournamentStatusLabel = 'Läuft';
  } else if (
    slots.length > 0 &&
    slots.every((s) => {
      const st = normalizeMatchStatus(s.match_status);
      return st === 'finished' || st === 'canceled';
    })
  ) {
    tournamentStatus = 'finished';
    tournamentStatusLabel = 'Beendet';
  }

  const notesTitle = (() => {
    const raw = String(input.notes ?? '').trim();
    if (!raw) return null;
    return raw.split(/\s*[·|]\s*|\r?\n/)[0]?.trim() || null;
  })();

  return {
    publicId: input.publicId,
    tournamentName: String(input.tournamentName ?? '').trim() || notesTitle || 'Turnier',
    dateLabel: formatViennaDateLabel(input.startsAt),
    venue: input.venue ? String(input.venue).trim() || null : null,
    teamName,
    ageGroupLabel,
    teamLogoUrl: input.teamLogoUrl ?? null,
    tournamentStatus,
    tournamentStatusLabel,
    nextMatch:
      tournamentStatus === 'finished' || tournamentStatus === 'canceled' ? null : nextMatch,
    upcomingMatches: matches.filter(
      (m) =>
        m.status !== 'finished' &&
        m.status !== 'canceled' &&
        (!nextMatch || m.id !== nextMatch.id),
    ),
    results: matches
      .filter((m) => m.status === 'finished')
      .slice()
      .sort((a, b) => Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt)),
    allMatches: matches,
  };
}

export async function fetchPublicTeamTournamentPage(
  publicId: string,
): Promise<{ page: PublicTeamTournamentPageDto | null; error: string | null }> {
  const id = String(publicId ?? '').trim();
  if (!id) return { page: null, error: 'Turnierseite nicht gefunden.' };

  // Demo: client-side only, no API / no DB writes
  if (id === 'ev-tournament') {
    try {
      const { getDemoTournamentMatchSlots } = await import('../demo/demoTournamentState');
      const { demoData } = await import('../demo/demoFixtures');
      const { DEMO_EVENT_TIMES } = await import('../demo/demoDataSource');
      const slots = getDemoTournamentMatchSlots(id).map((s) => ({
        id: s.id,
        match_id: s.match_id,
        opponent_name: s.opponent_name,
        kickoff_at: s.kickoff_at,
        pitch: s.pitch,
        group_label: s.group_label,
        phase: s.phase,
        sort_order: s.sort_order,
        match_status: s.match_status,
        score_home: s.score_home,
        score_away: s.score_away,
      }));
      const tour = demoData.tournament;
      const startsAt =
        DEMO_EVENT_TIMES['ev-tournament']?.().starts ??
        slots[0]?.kickoff_at ??
        new Date().toISOString();
      const page = buildPublicTeamTournamentPageDto({
        publicId: id,
        tournamentName: tour?.name ?? 'Demo-Turnier',
        startsAt,
        venue: tour?.location ?? null,
        teamName: getOurTeamDisplayName(),
        ageGroup: 'U12',
        teamLogoUrl: getOurTeamLogoUrl(),
        eventStatus: 'upcoming',
        slots,
      });
      return { page, error: null };
    } catch {
      return { page: null, error: 'Demo-Turnier konnte nicht geladen werden.' };
    }
  }

  try {
    const res = await fetch(
      `/api/tournament-plan-analyze?publicTournamentId=${encodeURIComponent(id)}`,
    );
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      page?: PublicTeamTournamentPageDto;
      message?: string;
    };
    if (!res.ok || !json.ok || !json.page) {
      return {
        page: null,
        error: json.message || 'Turnierseite nicht gefunden.',
      };
    }
    // Ensure display-time U11 normalize on names from API
    const page = {
      ...json.page,
      teamName: normalizeOefbImportedTeamName(json.page.teamName) || json.page.teamName,
      teamLogoUrl: json.page.teamLogoUrl || getOurTeamLogoUrl(),
      allMatches: json.page.allMatches.map((m) => ({
        ...m,
        ourTeamName: normalizeOefbImportedTeamName(m.ourTeamName) || m.ourTeamName,
        opponentName: normalizeOefbImportedTeamName(m.opponentName) || m.opponentName,
        homeName: normalizeOefbImportedTeamName(m.homeName) || m.homeName,
        awayName: normalizeOefbImportedTeamName(m.awayName) || m.awayName,
      })),
    };
    page.nextMatch = page.allMatches.find((m) => m.id === json.page!.nextMatch?.id) ?? null;
    page.upcomingMatches = page.allMatches.filter((m) =>
      json.page!.upcomingMatches.some((u) => u.id === m.id),
    );
    page.results = page.allMatches.filter((m) => json.page!.results.some((r) => r.id === m.id));
    return { page, error: null };
  } catch {
    return { page: null, error: 'Keine Verbindung. Bitte erneut versuchen.' };
  }
}
