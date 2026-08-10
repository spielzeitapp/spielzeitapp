import { parseClubDisplayName, tokenLooksLikeAgeGroup } from './feedClubNaming';
import { normalizeRole, type RoleKey } from './roles';

/**
 * STEP 1 Saisonwechsel — reine Lifecycle-Helfer (noch keine UI).
 * TODO(season-transition): TeamPage/MoreHub — „Nächste Saison vorbereiten“ (draft anlegen, U11→U12).
 * TODO(season-transition): useSession/TeamSwitcher — archivierte/draft Saisons filtern wenn aktiv.
 */

export const TEAM_SEASON_STATUS = ['active', 'draft', 'archived'] as const;
export type TeamSeasonLifecycleStatus = (typeof TEAM_SEASON_STATUS)[number];

export type CurrentSeasonLabelSource = {
  teamName?: string | null;
  seasonName?: string | null;
  ageGroup?: string | null;
  displayName?: string | null;
};

const STATUS_LABELS: Record<TeamSeasonLifecycleStatus, string> = {
  active: 'Aktiv',
  draft: 'In Vorbereitung',
  archived: 'Abgeschlossen',
};

/** Soft-Lock-Hinweis für abgeschlossene Saisons (UI). */
export const SEASON_SOFT_LOCK_MESSAGE =
  'Diese Saison ist abgeschlossen. Öffne die aktuelle Saison, um neue Termine oder Änderungen anzulegen.';

/** head_coach / co_trainer aus DB werden via normalizeRole() auf trainer gemappt. */
const PREPARE_NEXT_SEASON_ROLES: RoleKey[] = ['admin', 'trainer'];

export function normalizeTeamSeasonStatus(
  status: string | null | undefined,
): TeamSeasonLifecycleStatus {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'draft' || s === 'archived') return s;
  return 'active';
}

export function getSeasonStatusLabel(status: string | null | undefined): string {
  return STATUS_LABELS[normalizeTeamSeasonStatus(status)];
}

export function isSeasonDraft(status: string | null | undefined): boolean {
  return normalizeTeamSeasonStatus(status) === 'draft';
}

export function isSeasonActive(status: string | null | undefined): boolean {
  return normalizeTeamSeasonStatus(status) === 'active';
}

export function isSeasonArchived(
  status: string | null | undefined,
  archivedAt?: string | null,
): boolean {
  if (archivedAt != null && String(archivedAt).trim() !== '') return true;
  return normalizeTeamSeasonStatus(status) === 'archived';
}

/** Strukturelle Saison-Vorbereitung nur im Entwurf. */
export function isSeasonEditable(status: string | null | undefined): boolean {
  return isSeasonDraft(status);
}

export function canPrepareNextSeason(role: string | null | undefined): boolean {
  const key = normalizeRole(role);
  return key != null && PREPARE_NEXT_SEASON_ROLES.includes(key);
}

/** U7→U8 … U17→U18; unbekanntes Format wird unverändert zurückgegeben. */
export function computeNextAgeGroup(ageGroup: string): string {
  const trimmed = ageGroup.trim();
  const m = trimmed.match(/^U(\d{1,2})([a-z]?)$/i);
  if (!m) return trimmed;
  const next = parseInt(m[1], 10) + 1;
  const suffix = m[2] ?? '';
  return `U${next}${suffix}`;
}

/** 2025/26 → 2026/27; anderes Format bleibt unverändert. */
export function computeNextSeasonName(seasonName: string): string {
  const trimmed = seasonName.trim();
  const m = trimmed.match(/^(\d{4})\/(\d{2})$/);
  if (!m) return trimmed;
  const startYear = parseInt(m[1], 10);
  const endShort = parseInt(m[2], 10);
  const endYear = endShort < 100 ? Math.floor(startYear / 100) * 100 + endShort : endShort;
  const nextStart = endYear;
  const nextEndShort = (nextStart + 1) % 100;
  return `${nextStart}/${String(nextEndShort).padStart(2, '0')}`;
}

export function resolveCurrentAgeGroup(source: CurrentSeasonLabelSource): string | null {
  const fromField = source.ageGroup?.trim();
  if (fromField && tokenLooksLikeAgeGroup(fromField)) {
    return fromField.toUpperCase();
  }
  if (source.teamName?.trim()) {
    const parsed = parseClubDisplayName(source.teamName);
    if (parsed.ageGroup) return parsed.ageGroup;
  }
  if (source.displayName?.trim()) {
    const parsed = parseClubDisplayName(source.displayName);
    if (parsed.ageGroup) return parsed.ageGroup;
  }
  return null;
}

export function computeNextAgeGroupFromSource(source: CurrentSeasonLabelSource): string | null {
  const current = resolveCurrentAgeGroup(source);
  return current ? computeNextAgeGroup(current) : null;
}

/**
 * Display-Name für einen vorbereiteten Draft.
 * targetAgeGroup / targetSeasonName sind die finalen Werte (Wizard-Auswahl oder
 * bereits berechneter Default) — werden NICHT nochmals hochgezählt.
 * Beispiel: „U12 SPG Rohrbach · 2026/27“
 */
export function buildPreparedSeasonDisplayName(opts: {
  teamName?: string | null;
  targetAgeGroup?: string | null;
  targetSeasonName: string;
}): string {
  const age = opts.targetAgeGroup?.trim() || null;
  const season = opts.targetSeasonName.trim();
  const base =
    opts.teamName?.trim() ||
    '';
  if (base) {
    const teamLabel = age ? bumpTeamLabel(base, age) : base;
    return season ? `${teamLabel} · ${season}` : teamLabel;
  }
  if (age) return season ? `${age} · ${season}` : age;
  return season ? `Saison ${season}` : 'Saison';
}

/**
 * Legacy-Helfer: leitet Ziel-Altersklasse/Saison aus der Quell-Saison ab
 * (Default-Vorschlag). Für Wizard-Overrides buildPreparedSeasonDisplayName nutzen.
 */
export function buildDraftSeasonDisplayName(source: CurrentSeasonLabelSource): string {
  const nextAge = computeNextAgeGroupFromSource(source);
  const seasonRaw = source.seasonName?.trim() ?? '';
  const nextSeason = seasonRaw ? computeNextSeasonName(seasonRaw) : '—';
  return buildPreparedSeasonDisplayName({
    teamName: source.teamName,
    targetAgeGroup: nextAge,
    targetSeasonName: nextSeason,
  });
}

function bumpTeamLabel(teamName: string, nextAge: string | null): string {
  const trimmed = teamName.trim();
  if (!trimmed) return nextAge ?? 'Team';
  const parsed = parseClubDisplayName(trimmed);
  const clubLabel = [parsed.line1, parsed.line2].filter(Boolean).join(' ').trim();
  if (parsed.ageGroup && clubLabel) {
    return [nextAge ?? computeNextAgeGroup(parsed.ageGroup), clubLabel].filter(Boolean).join(' ');
  }
  if (/^U\d{1,2}\b/i.test(trimmed) && nextAge) {
    return trimmed.replace(/^U\d{1,2}\b/i, nextAge);
  }
  return nextAge ? [nextAge, trimmed].join(' ') : trimmed;
}

/**
 * Vorschlagsname für draft-team_season (z. B. U11 → U12, 2025/26 → 2026/27).
 */
export function buildNextSeasonDraftName(source: CurrentSeasonLabelSource): string {
  const nextAge = computeNextAgeGroupFromSource(source);

  const seasonRaw = source.seasonName?.trim() ?? '';
  const nextSeason = seasonRaw ? computeNextSeasonName(seasonRaw) : '';

  const baseTeam =
    source.teamName?.trim() ||
    (source.displayName?.trim()
      ? parseClubDisplayName(source.displayName).line1
      : '') ||
    'Team';
  const teamLabel = bumpTeamLabel(baseTeam, nextAge);

  return nextSeason ? `${teamLabel} (${nextSeason})` : teamLabel;
}

/** Eingabe für saisonbezogene UI-Labels (nicht teams.name allein). */
export type TeamSeasonLabelInput = {
  displayName?: string | null;
  /** team_seasons.age_group (Saison-Snapshot). */
  ageGroup?: string | null;
  /** teams.name — Stammdatensatz, darf alte Altersklasse enthalten. */
  teamName?: string | null;
  seasonName?: string | null;
  status?: string | null;
};

export type TeamSeasonLabelParts = {
  /** z. B. „U12 SPG Rohrbach · 2026/27“ */
  full: string;
  /** z. B. „U12 SPG Rohrbach“ */
  teamLine: string;
  /** z. B. „2026/27“ */
  seasonLine: string;
};

/** Club-/Teamname ohne führende Altersklasse (Stammdaten-Bereinigung). */
export function clubNameWithoutAgeGroup(teamName: string | null | undefined): string {
  const trimmed = (teamName ?? '').trim();
  if (!trimmed) return '';
  const parsed = parseClubDisplayName(trimmed);
  const club = [parsed.line1, parsed.line2].filter(Boolean).join(' ').trim();
  return club || trimmed;
}

/**
 * Einheitliches Saison-Label.
 * 1) team_seasons.display_name
 * 2) team_seasons.age_group + bereinigter Clubname + season.name
 */
export function resolveTeamSeasonLabelParts(input: TeamSeasonLabelInput): TeamSeasonLabelParts {
  const season = (input.seasonName ?? '').trim();
  const display = (input.displayName ?? '').trim();
  if (display) {
    const bits = display.split(/\s*·\s*/).map((b) => b.trim()).filter(Boolean);
    if (bits.length >= 2) {
      const seasonLine = bits[bits.length - 1] ?? season;
      const teamLine = bits.slice(0, -1).join(' · ').trim();
      return {
        full: display,
        teamLine: teamLine || display,
        seasonLine: seasonLine || season || '—',
      };
    }
    return {
      full: season ? `${display} · ${season}` : display,
      teamLine: display,
      seasonLine: season || '—',
    };
  }

  const age =
    (input.ageGroup ?? '').trim() ||
    resolveCurrentAgeGroup({
      ageGroup: input.ageGroup,
      teamName: input.teamName,
      displayName: input.displayName,
    }) ||
    null;
  const club = clubNameWithoutAgeGroup(input.teamName);
  const rawTeam = (input.teamName ?? '').trim();
  const teamLine = age
    ? [age, club || rawTeam].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    : rawTeam || 'Team';
  const full = season ? `${teamLine} · ${season}` : teamLine;
  return { full, teamLine, seasonLine: season || '—' };
}

export function formatTeamSeasonDisplayLabel(
  input: TeamSeasonLabelInput,
  opts?: { markArchived?: boolean },
): string {
  const { full } = resolveTeamSeasonLabelParts(input);
  if (opts?.markArchived && isSeasonArchived(input.status)) {
    return `${full} · Archiv`;
  }
  return full;
}

/**
 * Kompaktes Switcher-Label für schmale Mobile-Selects.
 * Clubname entfällt (im Screen ohnehin klar) — Altersklasse + Saison + Status bleiben lesbar.
 * Beispiel: „U11 · 2025/26 · Archiv“ / „U12 · 2026/27 · Aktuell“
 */
export function formatTeamSeasonCompactSwitcherLabel(
  input: TeamSeasonLabelInput,
  opts?: { markArchived?: boolean; markCurrent?: boolean },
): string {
  const age =
    (input.ageGroup ?? '').trim() ||
    resolveCurrentAgeGroup({
      ageGroup: input.ageGroup,
      teamName: input.teamName,
      displayName: input.displayName,
    }) ||
    '';
  const { seasonLine, full } = resolveTeamSeasonLabelParts(input);
  const season = (seasonLine || '').trim();
  const core = [age, season].filter(Boolean).join(' · ') || full;
  if (opts?.markArchived && isSeasonArchived(input.status)) {
    return `${core} · Archiv`;
  }
  if (opts?.markCurrent && isSeasonActive(input.status)) {
    return `${core} · Aktuell`;
  }
  return core;
}

/**
 * Einheitliche Switcher-Logik:
 * - archived → nur View (Read-only Historie), Active unverändert
 * - active/draft → Active + View (Schreiben nur in nicht-archivierten Saisons)
 */
export function resolveTeamSeasonSwitcherAction(
  status: string | null | undefined,
): 'view-archive' | 'select-work' | 'view-only' {
  if (isSeasonArchived(status)) return 'view-archive';
  if (isSeasonActive(status) || isSeasonDraft(status)) return 'select-work';
  return 'view-only';
}

/**
 * Auswahl nach Reload / Login:
 * 1) gespeicherte/explizite ID, wenn gültig und active
 * 2) erste active team_season (Trainer-/Eltern-Membership bevorzugt)
 * 3) Fallback (draft vor archived) — archived nie vor active
 */
export function pickPreferredActiveTeamSeasonId(opts: {
  teamSeasons: Array<{ id: string; status?: string | null }>;
  memberships: Array<{ team_season_id: string; role: string }>;
  storedId?: string | null;
  preferredId?: string | null;
}): string | null {
  const { teamSeasons, memberships, storedId, preferredId } = opts;
  if (teamSeasons.length === 0) return null;

  const byId = new Map(teamSeasons.map((ts) => [ts.id, ts]));
  const isUsableActive = (id: string | null | undefined): boolean => {
    if (!id) return false;
    const ts = byId.get(id);
    if (!ts) return false;
    return isSeasonActive(ts.status) && !isSeasonArchived(ts.status) && !isSeasonDraft(ts.status);
  };

  const candidates = [preferredId, storedId];
  for (const id of candidates) {
    if (isUsableActive(id)) return id as string;
  }

  const activeIds = teamSeasons
    .filter((ts) => isUsableActive(ts.id))
    .map((ts) => ts.id);
  if (activeIds.length > 0) {
    const activeSet = new Set(activeIds);
    const byRole = (role: string) =>
      memberships.find((m) => normalizeRole(m.role) === role && activeSet.has(m.team_season_id));
    const trainer = byRole('trainer');
    if (trainer) return trainer.team_season_id;
    const parent = byRole('parent');
    if (parent) return parent.team_season_id;
    const anyMem = memberships.find((m) => activeSet.has(m.team_season_id));
    if (anyMem) return anyMem.team_season_id;
    return activeIds[0];
  }

  const draft = teamSeasons.find((ts) => isSeasonDraft(ts.status));
  if (draft) return draft.id;

  const anyMem = memberships.find((m) => byId.has(m.team_season_id));
  if (anyMem) return anyMem.team_season_id;
  return teamSeasons[0]?.id ?? null;
}
