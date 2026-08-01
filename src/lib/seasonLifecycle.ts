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
