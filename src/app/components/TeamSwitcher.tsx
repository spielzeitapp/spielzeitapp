import React from 'react';
import { useSession } from '../../auth/useSession';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import { formatTeamSeasonDisplayLabel } from '../../lib/seasonLifecycle';

function labelForTeamSeason(ts: SessionTeamSeasonItem): string {
  return formatTeamSeasonDisplayLabel(
    {
      displayName: ts.display_name,
      ageGroup: ts.age_group,
      teamName: ts.team?.name,
      seasonName: ts.season?.name,
      status: ts.status,
    },
    { markArchived: true },
  );
}

export const TeamSwitcher: React.FC = () => {
  const {
    teamSeasons,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
  } = useSession();

  if (teamSeasons.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-slate-900/60 px-3 py-1 text-xs font-medium text-[var(--text)]">
        Keine Teams
      </span>
    );
  }

  const value = selectedTeamSeasonId ?? '';

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
          {labelForTeamSeason(ts)}
        </option>
      ))}
    </select>
  );
};
