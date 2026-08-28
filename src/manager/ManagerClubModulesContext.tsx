import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from '../auth/useSession';
import { listClubModules, type ClubModule } from '../lib/platformClubAdmin';
import { resolveClubIdForTeamSeason } from '../lib/venues';
import { useManagerWorkMode } from './ManagerWorkModeContext';

type ManagerClubModulesContextValue = {
  clubId: string | null;
  modules: ClubModule[];
  loading: boolean;
  error: string | null;
  isModuleEnabled: (key: string | undefined) => boolean;
  reloadModules: () => Promise<void>;
};

const ManagerClubModulesContext = createContext<ManagerClubModulesContextValue | undefined>(undefined);

export function ManagerClubModulesProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { selectedTeamSeasonId, viewTeamSeasonId } = useSession();
  const { supportSession } = useManagerWorkMode();
  const teamSeasonId = viewTeamSeasonId ?? selectedTeamSeasonId;
  const [resolvedClubId, setResolvedClubId] = useState<string | null>(null);
  const [modules, setModules] = useState<ClubModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clubId = supportSession?.clubId ?? resolvedClubId;

  useEffect(() => {
    let cancelled = false;
    if (supportSession?.clubId) {
      setResolvedClubId(supportSession.clubId);
      return;
    }
    if (!teamSeasonId) {
      setResolvedClubId(null);
      return;
    }
    void resolveClubIdForTeamSeason(teamSeasonId).then((res) => {
      if (!cancelled) setResolvedClubId(res.clubId);
    });
    return () => {
      cancelled = true;
    };
  }, [supportSession?.clubId, teamSeasonId]);

  const reloadModules = useCallback(async () => {
    if (!clubId) {
      setModules([]);
      setError(null);
      return;
    }
    setLoading(true);
    const res = await listClubModules(clubId);
    setModules(res.data);
    setError(res.error);
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    void reloadModules();
  }, [reloadModules]);

  const enabledKeys = useMemo(
    () => new Set(modules.filter((module) => module.enabled).map((module) => module.module_key)),
    [modules],
  );

  const isModuleEnabled = useCallback(
    (key: string | undefined) => {
      if (!key) return true;
      // Während Laden/bei älteren DB-Ständen keine bestehende Navigation ausblenden.
      if (loading || error || modules.length === 0) return true;
      return enabledKeys.has(key);
    },
    [enabledKeys, error, loading, modules.length],
  );

  const value = useMemo(
    () => ({ clubId, modules, loading, error, isModuleEnabled, reloadModules }),
    [clubId, modules, loading, error, isModuleEnabled, reloadModules],
  );

  return <ManagerClubModulesContext.Provider value={value}>{children}</ManagerClubModulesContext.Provider>;
}

export function useManagerClubModules(): ManagerClubModulesContextValue {
  const value = useContext(ManagerClubModulesContext);
  if (!value) throw new Error('useManagerClubModules must be used within ManagerClubModulesProvider');
  return value;
}
