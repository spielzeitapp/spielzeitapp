import React from 'react';
import { useSession } from '../../auth/useSession';
import type { SessionTeamSeasonItem } from '../../auth/useSession';

/** selectedTeamId z. B. "u11" => "U11" für Fallback-Altersklasse. */
function fallbackAgeGroupFromTeamId(selectedTeamId: string): string {
  if (!selectedTeamId) return '';
  return selectedTeamId.charAt(0).toUpperCase() + selectedTeamId.slice(1).toLowerCase();
}

/**
 * Label: Altersklasse + Mannschaftsname + (Saison), z. B. "U11 SPG Rohrbach (2025/26)".
 * Keine UUIDs. Wenn team.name bereits mit Altersklasse beginnt, nicht nochmal prefixen. Trim & collapse spaces.
 */
function formatTeamSeasonLabel(
  ts: SessionTeamSeasonItem,
  fallbackAgeGroup: string,
): string {
  const season =
    (ts.season?.name ??
      (ts as { season_name?: string; seasonName?: string }).season_name ??
      (ts as { season_name?: string; seasonName?: string }).seasonName)?.trim() ?? '';
  const teamName =
    (ts.team?.name ??
      (Array.isArray(ts.teams) ? ts.teams[0]?.name : ts.teams?.name) ??
      (ts as { team_name?: string; teamName?: string }).team_name ??
      (ts as { team_name?: string; teamName?: string }).teamName)?.trim() ?? '';
  const ageGroup =
    (ts.team?.age_group ??
      (Array.isArray(ts.teams) ? ts.teams[0]?.age_group : ts.teams?.age_group))?.trim() ??
    fallbackAgeGroup.trim();

  const nameNorm = teamName.replace(/\s+/g, ' ').trim();
  const ageNorm = ageGroup.replace(/\s+/g, ' ').trim();
  const alreadyStartsWithAge =
    (ageNorm && nameNorm && nameNorm.toLowerCase().startsWith(ageNorm.toLowerCase())) ||
    (nameNorm && /^u\d{1,2}\b/i.test(nameNorm));
  const base = alreadyStartsWithAge
    ? nameNorm
    : [ageNorm, nameNorm].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const displayBase = base || 'Team';
  return season ? `${displayBase} (${season})` : displayBase;
}

export const TeamSwitcher: React.FC = () => {
  const {
    teamSeasons,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
    selectedTeamId,
  } = useSession();

  if (teamSeasons.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-slate-900/60 px-3 py-1 text-xs font-medium text-[var(--text)]">
        Keine Teams
      </span>
    );
  }

  const value = selectedTeamSeasonId ?? '';
  const fallbackAge = fallbackAgeGroupFromTeamId(selectedTeamId ?? '');

  return (
    <select
      value={value}
      onChange={(e) => setSelectedTeamSeasonId(e.target.value || null)}
      className="inline-flex max-w-full min-w-0 appearance-none items-center gap-1 rounded-full border border-[var(--border)] bg-slate-900/60 px-3 py-1 text-xs font-medium text-[var(--text)] shadow-sm truncate text-left"
      aria-label="Team/Saison wählen"
    >
      <option value="">Team wählen</option>
      {teamSeasons.map((ts) => (
        <option key={ts.id} value={ts.id}>
          {formatTeamSeasonLabel(ts, fallbackAge)}
        </option>
      ))}
    </select>
  );
};
