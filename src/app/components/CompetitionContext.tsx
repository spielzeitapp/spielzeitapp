import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from '../../auth/useSession';
import { getOefbTableSettings, type OefbTableSettings } from '../../lib/oefbTableSettings';
import { formatTeamSeasonContextLabel } from '../../lib/seasonLifecycle';

type CompetitionOption = { seasonId: string; label: string; settings: OefbTableSettings };
type CompetitionContextValue = {
  settings: OefbTableSettings | null; loading: boolean; error: string | null;
  options: CompetitionOption[]; selectedSeasonId: string | null;
  selectSeason: (id: string) => void;
};
const CompetitionContext = createContext<CompetitionContextValue>({ settings: null, loading: false, error: null, options: [], selectedSeasonId: null, selectSeason: () => {} });

/** Table selection is read-only and independent of the active team/role. */
export const CompetitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, selectedTeamSeasonId, viewTeamSeasonId, teamSeasons, teamViewFilter, filteredTeamSeasonIds } = useSession();
  const seasonId = viewTeamSeasonId ?? selectedTeamSeasonId;
  const ids = teamViewFilter === null ? [seasonId] : filteredTeamSeasonIds;
  const eligibleIds = teamSeasons.filter((season) => {
    const age = Number(/^U\s*(\d+)$/i.exec(String(season.age_group || season.team?.age_group || '').trim())?.[1]);
    return ids.includes(season.id) && Number.isFinite(age) && age >= 13;
  }).map((season) => season.id).sort();
  const idsKey = JSON.stringify(eligibleIds);
  const key = eligibleIds.length ? `${user?.id ?? ''}:${idsKey}` : null;
  const [chosenSeasonId, setChosenSeasonId] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; tables: { seasonId: string; settings: OefbTableSettings }[]; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!key) { setResult(null); return; }
    Promise.all((JSON.parse(idsKey) as string[]).map(async (id) => ({ seasonId: id, ...await getOefbTableSettings(id) }))).then((rows) => {
      if (!cancelled) setResult({ key, tables: rows.flatMap((row) => row.data ? [{ seasonId: row.seasonId, settings: row.data }] : []), error: rows.find((row) => row.error)?.error ?? null });
    }).catch(() => {
      if (!cancelled) setResult({ key, tables: [], error: 'Die Tabellenzuordnung konnte nicht geladen werden.' });
    });
    return () => { cancelled = true; };
  }, [key, idsKey]);
  const current = key && result?.key === key ? result : null;
  const options = (current?.tables ?? []).map((table) => {
    const season = teamSeasons.find((item) => item.id === table.seasonId);
    return { ...table, label: formatTeamSeasonContextLabel({ displayName: season?.display_name, ageGroup: season?.age_group, teamName: season?.team?.name, seasonName: season?.season?.name, status: season?.status }, { markArchived: true }) };
  });
  const chosen = options.find((option) => option.seasonId === chosenSeasonId) ?? options.find((option) => option.seasonId === seasonId) ?? options[0] ?? null;
  return <CompetitionContext.Provider value={{ settings: chosen?.settings ?? null, options, selectedSeasonId: chosen?.seasonId ?? null,
    selectSeason: (id) => { if (options.some((option) => option.seasonId === id)) setChosenSeasonId(id); },
    loading: !!key && !current, error: current?.error ?? null }}>{children}</CompetitionContext.Provider>;
};
export const useCompetition = () => useContext(CompetitionContext);
