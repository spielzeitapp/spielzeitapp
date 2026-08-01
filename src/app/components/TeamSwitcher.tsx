import React from 'react';
import { useSession } from '../../auth/useSession';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import {
  formatTeamSeasonCompactSwitcherLabel,
  isSeasonActive,
  isSeasonArchived,
  isSeasonDraft,
} from '../../lib/seasonLifecycle';

function labelForTeamSeason(ts: SessionTeamSeasonItem): string {
  return formatTeamSeasonCompactSwitcherLabel(
    {
      displayName: ts.display_name,
      ageGroup: ts.age_group,
      teamName: ts.team?.name,
      seasonName: ts.season?.name,
      status: ts.status,
    },
    {
      markArchived: true,
      markCurrent: isSeasonActive(ts.status),
    },
  );
}

/**
 * Wechselt die aktive Arbeitssaison (Write).
 * Archiv-Auswahl setzt nur die View-Saison — active bleibt unverändert.
 */
export const TeamSwitcher: React.FC = () => {
  const {
    teamSeasons,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
    viewTeamSeasonId,
    setViewTeamSeasonId,
  } = useSession();

  if (teamSeasons.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-slate-900/60 px-3 py-1 text-xs font-medium text-[var(--text)]">
        Keine Teams
      </span>
    );
  }

  // Anzeige: View-Saison (kann Archiv sein), ohne active zu überschreiben.
  const value = viewTeamSeasonId ?? selectedTeamSeasonId ?? '';

  const onChange = (raw: string) => {
    const id = raw || null;
    if (!id) {
      setViewTeamSeasonId(null);
      return;
    }
    const ts = teamSeasons.find((row) => row.id === id);
    if (!ts) return;
    if (isSeasonArchived(ts.status)) {
      setViewTeamSeasonId(id);
      return;
    }
    if (isSeasonActive(ts.status) || isSeasonDraft(ts.status)) {
      setSelectedTeamSeasonId(id);
      return;
    }
    setViewTeamSeasonId(id);
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="inline-flex max-w-[min(100%,12.5rem)] min-w-0 appearance-none items-center gap-1 rounded-full border border-[var(--border)] bg-slate-900/60 px-3 py-1 text-xs font-medium text-[var(--text)] shadow-sm text-left sm:max-w-xs"
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
