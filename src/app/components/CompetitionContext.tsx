import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from '../../auth/useSession';
import { getOefbTableSettings, type OefbTableSettings } from '../../lib/oefbTableSettings';

type CompetitionContextValue = { settings: OefbTableSettings | null; loading: boolean; error: string | null };
const CompetitionContext = createContext<CompetitionContextValue>({ settings: null, loading: false, error: null });

/** Follows the displayed single season; a previous team's table must never survive a switch. */
export const CompetitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, selectedTeamSeasonId, viewTeamSeasonId, teamSeasons, teamViewFilter } = useSession();
  const seasonId = viewTeamSeasonId ?? selectedTeamSeasonId;
  const season = teamSeasons.find((item) => item.id === seasonId);
  const age = Number(/^U\s*(\d+)$/i.exec(String(season?.age_group || season?.team?.age_group || '').trim())?.[1]);
  const eligible = !!seasonId && teamViewFilter === null && Number.isFinite(age) && age >= 13;
  const key = eligible ? `${user?.id ?? ''}:${seasonId}` : null;
  const [result, setResult] = useState<{ key: string; settings: OefbTableSettings | null; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!key || !seasonId) { setResult(null); return; }
    getOefbTableSettings(seasonId).then(({ data, error }) => {
      if (!cancelled) setResult({ key, settings: data, error });
    }).catch(() => {
      if (!cancelled) setResult({ key, settings: null, error: 'Die Tabellenzuordnung konnte nicht geladen werden.' });
    });
    return () => { cancelled = true; };
  }, [key, seasonId]);
  const current = key && result?.key === key ? result : null;
  return <CompetitionContext.Provider value={{ settings: current?.settings ?? null, loading: !!key && !current, error: current?.error ?? null }}>{children}</CompetitionContext.Provider>;
};
export const useCompetition = () => useContext(CompetitionContext);
