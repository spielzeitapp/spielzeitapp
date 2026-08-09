/**
 * Pure helpers for the public team tournament page (TURNIER.1).
 * Shared by API (_lib) and tests — no secrets, no DB.
 */

export function normalizeOefbImportedTeamName(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  s = s.replace(/\(\s*U[\s\-]?11\s*\)|\bU[\s\-]?11\b/gi, ' ');
  s = s.replace(/\(\s*\)/g, ' ');
  s = s.replace(/\s*[–—]\s*/g, ' – ');
  s = s.replace(/(?:\s*–\s*){2,}/g, ' – ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^(?:[–—\-]\s*)+|(?:\s*[–—\-])+$/g, '').trim();
  return s;
}

export function isUuidLike(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s ?? '').trim(),
  );
}

/** Demo seed id used in SPA demo tournament. */
export function isDemoPublicTournamentId(id) {
  return String(id ?? '').trim() === 'ev-tournament';
}

export function isValidPublicTournamentId(id) {
  const s = String(id ?? '').trim();
  return isUuidLike(s) || isDemoPublicTournamentId(s);
}

/**
 * Club name + optional age label. Age must never be glued into the club string.
 * Prefers explicit ageGroup; otherwise strips a leading Uxx from the raw team name.
 */
export function splitPublicTeamDisplay(rawName, ageGroupHint) {
  const hint = String(ageGroupHint ?? '')
    .trim()
    .toUpperCase();
  const hintMatch = hint.match(/^U\d{1,2}[A-Z]?$/i);
  const normalized = normalizeOefbImportedTeamName(rawName);
  const leading = normalized.match(/^(U\d{1,2}[A-Za-z]?)\s+(.+)$/);
  if (hintMatch) {
    const club = normalized.replace(new RegExp(`^${hintMatch[0]}\\s+`, 'i'), '').trim() || normalized;
    return { teamName: club || 'Mannschaft', ageGroupLabel: hintMatch[0].toUpperCase() };
  }
  if (leading) {
    return {
      teamName: leading[2].trim() || normalized,
      ageGroupLabel: leading[1].toUpperCase(),
    };
  }
  return { teamName: normalized || 'Mannschaft', ageGroupLabel: null };
}

export function normalizeMatchStatus(raw) {
  const st = String(raw ?? 'upcoming').trim().toLowerCase();
  if (st === 'live') return 'live';
  if (st === 'finished' || st === 'ended' || st === 'completed') return 'finished';
  if (st === 'canceled' || st === 'cancelled') return 'canceled';
  return 'upcoming';
}

export function publicStatusLabel(status) {
  if (status === 'live') return 'LIVE';
  if (status === 'finished') return 'Beendet';
  if (status === 'canceled') return 'Abgesagt';
  return 'Demnächst';
}

export function sortSlotsChronologically(slots) {
  return [...(slots ?? [])].sort((a, b) => {
    const ta = Date.parse(a.kickoff_at ?? a.kickoffAt ?? '');
    const tb = Date.parse(b.kickoff_at ?? b.kickoffAt ?? '');
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
  });
}

export function pickNextOpenSlot(slots) {
  const sorted = sortSlotsChronologically(slots);
  const live = sorted.find((s) => normalizeMatchStatus(s.match_status) === 'live');
  if (live) return live;
  return (
    sorted.find((s) => {
      const st = normalizeMatchStatus(s.match_status);
      return st !== 'finished' && st !== 'canceled';
    }) ?? null
  );
}

export function resolveTournamentLifecycle(eventStatus, slots) {
  const es = String(eventStatus ?? '').trim().toLowerCase();
  if (es === 'canceled' || es === 'cancelled') {
    return { status: 'canceled', label: 'Abgesagt' };
  }
  const list = slots ?? [];
  if (list.length === 0) {
    return { status: 'upcoming', label: 'Bevorstehend' };
  }
  if (list.some((s) => normalizeMatchStatus(s.match_status) === 'live')) {
    return { status: 'live', label: 'Läuft' };
  }
  const open = list.some((s) => {
    const st = normalizeMatchStatus(s.match_status);
    return st !== 'finished' && st !== 'canceled';
  });
  if (!open) return { status: 'finished', label: 'Beendet' };
  return { status: 'upcoming', label: 'Bevorstehend' };
}

export function tournamentTitleFromNotes(notes) {
  const raw = String(notes ?? '').trim();
  if (!raw) return 'Turnier';
  const first = raw.split(/\s*[·|]\s*|\r?\n/)[0]?.trim() ?? '';
  return first || 'Turnier';
}

export function formatViennaDateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatViennaTimeLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Map raw slot (+ match enrichment) → public match DTO.
 * score_home = our team (existing tournament convention).
 */
export function toPublicMatchDto(slot, ourTeamName) {
  const our = normalizeOefbImportedTeamName(ourTeamName) || 'Unser Team';
  const opp = normalizeOefbImportedTeamName(slot.opponent_name ?? slot.opponentName) || 'Gegner';
  const status = normalizeMatchStatus(slot.match_status ?? slot.status);
  const scoreOur =
    status === 'finished' || status === 'live'
      ? Number(slot.score_home ?? slot.scoreOur ?? 0)
      : null;
  const scoreOpp =
    status === 'finished' || status === 'live'
      ? Number(slot.score_away ?? slot.scoreOpp ?? 0)
      : null;
  return {
    id: String(slot.match_id ?? slot.id ?? ''),
    kickoffAt: String(slot.kickoff_at ?? slot.kickoffAt ?? ''),
    kickoffTimeLabel: formatViennaTimeLabel(slot.kickoff_at ?? slot.kickoffAt),
    pitch: slot.pitch ? String(slot.pitch).trim() || null : null,
    groupLabel: slot.group_label ?? slot.groupLabel ?? null,
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

/**
 * Build public page DTO from already-loaded, team-scoped slots.
 * Slots must already be only our team's tournament_matches rows (ID-scoped).
 */
export function buildPublicTeamTournamentDto(input) {
  const publicId = String(input.publicId ?? '').trim();
  const rawTeamName = input.teamName ?? 'Mannschaft';
  const { teamName, ageGroupLabel } = splitPublicTeamDisplay(rawTeamName, input.ageGroup);
  const slots = sortSlotsChronologically(input.slots ?? []);
  const matches = slots.map((s) => toPublicMatchDto(s, teamName));
  const nextRaw = pickNextOpenSlot(slots);
  const nextMatch = nextRaw ? toPublicMatchDto(nextRaw, teamName) : null;
  const upcomingMatches = matches.filter(
    (m) => m.status !== 'finished' && m.status !== 'canceled' && (!nextMatch || m.id !== nextMatch.id),
  );
  const results = matches
    .filter((m) => m.status === 'finished')
    .slice()
    .sort((a, b) => Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt));
  const life = resolveTournamentLifecycle(input.eventStatus, slots);

  return {
    publicId,
    tournamentName: String(input.tournamentName ?? '').trim() || tournamentTitleFromNotes(input.notes),
    dateLabel: formatViennaDateLabel(input.startsAt),
    venue: input.venue ? String(input.venue).trim() || null : null,
    teamName,
    ageGroupLabel,
    teamLogoUrl: input.teamLogoUrl ?? null,
    tournamentStatus: life.status,
    tournamentStatusLabel: life.label,
    nextMatch: life.status === 'finished' || life.status === 'canceled' ? null : nextMatch,
    upcomingMatches,
    results,
    allMatches: matches,
  };
}

/** Assert public DTO never contains private keys. */
export const FORBIDDEN_PUBLIC_KEYS = [
  'email',
  'phone',
  'attendance',
  'birth',
  'notes',
  'squad',
  'lineup',
  'injury',
  'membership',
  'team_season_id',
  'created_by',
  'rsvp',
];

export function assertPublicDtoSafe(dto) {
  const blob = JSON.stringify(dto ?? {});
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (new RegExp(`"${key}"\\s*:`, 'i').test(blob)) {
      throw new Error(`Public DTO contains forbidden key: ${key}`);
    }
  }
  return true;
}
