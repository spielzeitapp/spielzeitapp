/**
 * TRAINER-MODE.1 – React-Kontext für Arbeitsmodus (UI, keine DB-Mutation).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession, type SessionTeamSeasonItem } from '../auth/useSession';
import {
  adminSwitchLabel,
  canSwitchWorkMode,
  filterTrainerStaffTeamSeasonIds,
  isAdministrationWorkMode,
  isTrainerWorkMode,
  managerUsesExpandedAdminCapabilities,
  resolveAvailableWorkModes,
  resolveDefaultWorkMode,
  resolveEffectiveWorkMode,
  writeStoredWorkMode,
  workModeHomePath,
  type ManagerWorkMode,
} from './managerWorkMode';

type ManagerWorkModeContextValue = {
  workMode: ManagerWorkMode;
  availableModes: ManagerWorkMode[];
  canSwitchMode: boolean;
  isTrainerMode: boolean;
  isAdministrationMode: boolean;
  usesExpandedAdminCapabilities: boolean;
  /** Team-Saisons für Header/Switcher im aktuellen Modus. */
  contextTeamSeasons: SessionTeamSeasonItem[];
  setWorkMode: (mode: ManagerWorkMode, opts?: { navigate?: boolean }) => void;
  switchToAdministration: () => void;
  switchToTrainer: () => void;
  adminSwitchButtonLabel: string;
};

const ManagerWorkModeContext = createContext<ManagerWorkModeContextValue | undefined>(undefined);

export function ManagerWorkModeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { backendRole, memberships, teamSeasons, loading, setSelectedTeamSeasonId } = useSession();

  const membershipInputs = useMemo(
    () =>
      memberships.map((m) => ({
        team_season_id: m.team_season_id,
        role: m.role,
      })),
    [memberships],
  );

  const availableModes = useMemo(
    () =>
      resolveAvailableWorkModes({
        backendRole,
        memberships: membershipInputs,
      }),
    [backendRole, membershipInputs],
  );

  const [workMode, setWorkModeState] = useState<ManagerWorkMode>(() =>
    resolveDefaultWorkMode(availableModes),
  );

  useEffect(() => {
    if (loading || !authUser?.id) return;
    setWorkModeState(
      resolveEffectiveWorkMode({
        userId: authUser.id,
        backendRole,
        memberships: membershipInputs,
      }),
    );
  }, [loading, authUser?.id, backendRole, membershipInputs]);

  const setWorkMode = useCallback(
    (mode: ManagerWorkMode, opts?: { navigate?: boolean }) => {
      if (!availableModes.includes(mode)) return;
      setWorkModeState(mode);
      if (authUser?.id) writeStoredWorkMode(authUser.id, mode);
      if (opts?.navigate !== false) {
        navigate(workModeHomePath(mode), { replace: true });
      }
    },
    [availableModes, authUser?.id, navigate],
  );

  const switchToAdministration = useCallback(() => {
    if (availableModes.includes('platform_admin')) {
      setWorkMode('platform_admin');
      return;
    }
    if (availableModes.includes('club_admin')) {
      setWorkMode('club_admin');
    }
  }, [availableModes, setWorkMode]);

  const switchToTrainer = useCallback(() => {
    if (availableModes.includes('trainer')) setWorkMode('trainer');
  }, [availableModes, setWorkMode]);

  const trainerSeasonIds = useMemo(
    () => new Set(filterTrainerStaffTeamSeasonIds(membershipInputs)),
    [membershipInputs],
  );

  const contextTeamSeasons = useMemo(() => {
    if (isTrainerWorkMode(workMode)) {
      return teamSeasons.filter((ts) => trainerSeasonIds.has(ts.id));
    }
    return teamSeasons;
  }, [workMode, teamSeasons, trainerSeasonIds]);

  useEffect(() => {
    if (!isTrainerWorkMode(workMode) || contextTeamSeasons.length === 0) return;
    const active = contextTeamSeasons.find((ts) => ts.status === 'active') ?? contextTeamSeasons[0];
    if (active?.id) setSelectedTeamSeasonId(active.id);
  }, [workMode, contextTeamSeasons, setSelectedTeamSeasonId]);

  const adminSwitchButtonLabel = useMemo(() => {
    if (availableModes.includes('platform_admin')) return adminSwitchLabel('platform_admin');
    if (availableModes.includes('club_admin')) return adminSwitchLabel('club_admin');
    return adminSwitchLabel('club_admin');
  }, [availableModes]);

  const value = useMemo(
    (): ManagerWorkModeContextValue => ({
      workMode,
      availableModes,
      canSwitchMode: canSwitchWorkMode(availableModes),
      isTrainerMode: isTrainerWorkMode(workMode),
      isAdministrationMode: isAdministrationWorkMode(workMode),
      usesExpandedAdminCapabilities: managerUsesExpandedAdminCapabilities(
        workMode,
        backendRole,
        membershipInputs,
      ),
      contextTeamSeasons,
      setWorkMode,
      switchToAdministration,
      switchToTrainer,
      adminSwitchButtonLabel,
    }),
    [
      workMode,
      availableModes,
      backendRole,
      membershipInputs,
      contextTeamSeasons,
      setWorkMode,
      switchToAdministration,
      switchToTrainer,
      adminSwitchButtonLabel,
    ],
  );

  return (
    <ManagerWorkModeContext.Provider value={value}>{children}</ManagerWorkModeContext.Provider>
  );
}

export function useManagerWorkMode(): ManagerWorkModeContextValue {
  const ctx = useContext(ManagerWorkModeContext);
  if (!ctx) {
    throw new Error('useManagerWorkMode must be used within ManagerWorkModeProvider');
  }
  return ctx;
}
