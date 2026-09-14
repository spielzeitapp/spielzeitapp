import React from 'react';
import { useNavigate } from 'react-router-dom';
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

function compactLabelForTeamSeason(ts: SessionTeamSeasonItem | undefined): string {
  const ageGroup = ts?.age_group?.trim().toUpperCase();
  const seasonName = ts?.season?.name?.trim();

  if (ageGroup && seasonName) return `${ageGroup} · ${seasonName}`;
  if (ageGroup) return ageGroup;

  const fallback = ts?.display_name ?? ts?.team?.name ?? '';
  const fallbackAgeGroup = fallback.match(/\bU\d{1,2}\b/i)?.[0]?.toUpperCase();
  const fallbackSeason = fallback.match(/\b20\d{2}\/\d{2}\b/)?.[0];
  return [fallbackAgeGroup, fallbackSeason].filter(Boolean).join(' · ') || 'Team';
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
  const navigate = useNavigate();
  const {
    teamSeasons,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
    viewTeamSeasonId,
    setViewTeamSeasonId,
    memberships,
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
    if (raw === '__manage_favorites__') {
      navigate('/app/fan-onboarding');
      return;
    }

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

  const ownTeamSeasonIds = new Set(
    memberships
      .filter((membership) => String(membership.role).trim().toLowerCase() !== 'fan')
      .map((membership) => membership.team_season_id),
  );
  const ownTeamSeasons = teamSeasons.filter((ts) => ownTeamSeasonIds.has(ts.id));
  const favoriteTeamSeasons = teamSeasons.filter((ts) => !ownTeamSeasonIds.has(ts.id));

  const options = (
    <>
      <option value="">Team wählen</option>
      {ownTeamSeasons.length > 0 ? (
        <optgroup label="Meine Mannschaften">
          {ownTeamSeasons.map((ts) => (
            <option key={ts.id} value={ts.id}>
              {labelForTeamSeason(ts, selectedTeamSeasonId)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {favoriteTeamSeasons.length > 0 ? (
        <optgroup label="Favoriten">
          {favoriteTeamSeasons.map((ts) => (
            <option key={ts.id} value={ts.id}>
              {`★ ${labelForTeamSeason(ts, selectedTeamSeasonId)}`}
            </option>
          ))}
        </optgroup>
      ) : null}
      <option value="__manage_favorites__">＋ Favoriten verwalten</option>
    </>
  );

  if (compact) {
    const visibleTeamSeason = teamSeasons.find((ts) => ts.id === value);

    return (
      <label
        className={[
          'relative inline-flex h-8 min-w-[5.75rem] shrink-0 items-center justify-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 text-[10px] font-bold text-white/95 shadow-sm sm:min-w-[6.75rem] sm:px-2.5 sm:text-[11px]',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span aria-hidden>{compactLabelForTeamSeason(visibleTeamSeason)}</span>
        <span className="text-[9px] text-white/55" aria-hidden>▼</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Team/Saison wählen"
        >
          {options}
        </select>
      </label>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        'inline-flex max-w-[min(100%,12.5rem)] min-w-0 appearance-none items-center gap-1 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-left text-xs font-medium text-white/90 shadow-sm sm:max-w-xs',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Team/Saison wählen"
    >
      {options}
    </select>
  );
};
