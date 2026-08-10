import React from 'react';
import { useSession } from '../../auth/useSession';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import {
  formatTeamSeasonCompactSwitcherLabel,
  isSeasonActive,
  resolveTeamSeasonSwitcherAction,
} from '../../lib/seasonLifecycle';

function labelForTeamSeason(ts: SessionTeamSeasonItem, activeId: string | null): string {
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
      markCurrent: ts.id === activeId || isSeasonActive(ts.status),
    },
  );
}

export type TeamSwitcherProps = {
  /** kompakt im App-Header */
  compact?: boolean;
  className?: string;
  /** Wenn false und nur 1 Saison: nichts rendern */
  hideWhenSingle?: boolean;
};

/**
 * Wechselt die aktive Arbeitssaison (Write).
 * Archiv-Auswahl setzt nur die View-Saison — active bleibt unverändert.
 */
export const TeamSwitcher: React.FC<TeamSwitcherProps> = ({
  compact = false,
  className,
  hideWhenSingle = false,
}) => {
  const {
    teamSeasons,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
    viewTeamSeasonId,
    setViewTeamSeasonId,
  } = useSession();

  if (teamSeasons.length === 0) {
    if (hideWhenSingle) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-medium text-white/80">
        Keine Teams
      </span>
    );
  }

  if (hideWhenSingle && teamSeasons.length < 2) return null;

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
    const action = resolveTeamSeasonSwitcherAction(ts.status);
    if (action === 'view-archive' || action === 'view-only') {
      setViewTeamSeasonId(id);
      return;
    }
    setSelectedTeamSeasonId(id);
  };

  const selectClass = compact
    ? 'inline-flex max-w-[min(42vw,9.5rem)] min-w-0 appearance-none truncate rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-medium text-white/90 sm:max-w-[11rem] sm:text-[11px]'
    : 'inline-flex max-w-[min(100%,12.5rem)] min-w-0 appearance-none items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-medium text-white/90 shadow-sm text-left sm:max-w-xs';

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[selectClass, className].filter(Boolean).join(' ')}
      aria-label="Team/Saison wählen"
    >
      <option value="">Team wählen</option>
      {teamSeasons.map((ts) => (
        <option key={ts.id} value={ts.id}>
          {labelForTeamSeason(ts, selectedTeamSeasonId)}
        </option>
      ))}
    </select>
  );
};
