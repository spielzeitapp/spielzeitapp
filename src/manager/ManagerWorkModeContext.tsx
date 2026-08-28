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
  resolveTrainerTeamSeasonId,
  writeStoredTrainerTeamSeasonId,
  writeStoredWorkMode,
  workModeHomePath,
  type ManagerWorkMode,
} from './managerWorkMode';
import { adminLogSupportAccess } from '../lib/platformClubAdmin';

export type ManagerSupportSession = {
  clubId: string;
  clubName: string;
  teamSeasons: SessionTeamSeasonItem[];
};

type ManagerWorkModeContextValue = {
  workMode: ManagerWorkMode;
  availableModes: ManagerWorkMode[];
  canSwitchMode: boolean;
  isTrainerMode: boolean;
  isAdministrationMode: boolean;
  usesExpandedAdminCapabilities: boolean;
  /** Team-Saisons für Header/Switcher im aktuellen Modus. */
  contextTeamSeasons: SessionTeamSeasonItem[];
  /** Trainer-Team-Saison im Trainermodus setzen (speichert benutzerspezifisch). */
  selectTrainerTeamSeasonId: (teamSeasonId: string) => void;
  setWorkMode: (mode: ManagerWorkMode, opts?: { navigate?: boolean }) => void;
  switchToAdministration: () => void;
  switchToTrainer: () => void;
  adminSwitchButtonLabel: string;
  supportSession: ManagerSupportSession | null;
  startSupportSession: (input: ManagerSupportSession & { initialTeamSeasonId: string }) => void;
  endSupportSession: () => void;
};

const ManagerWorkModeContext = createContext<ManagerWorkModeContextValue | undefined>(undefined);

export function ManagerWorkModeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    backendRole,
    memberships,
    teamSeasons,
    loading,
    setSelectedTeamSeasonId,
    setViewTeamSeasonId,
    selectedTeamSeasonId,
  } = useSession();

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
  const [supportSession, setSupportSession] = useState<ManagerSupportSession | null>(null);

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

  const trainerSeasonIds = useMemo(
    () => new Set(filterTrainerStaffTeamSeasonIds(membershipInputs)),
    [membershipInputs],
  );

  const trainerTeamSeasons = useMemo(
    () => teamSeasons.filter((ts) => trainerSeasonIds.has(ts.id)),
    [teamSeasons, trainerSeasonIds],
  );

  const contextTeamSeasons = useMemo(() => {
    if (workMode === 'platform_admin' && supportSession) return supportSession.teamSeasons;
    if (isTrainerWorkMode(workMode)) return trainerTeamSeasons;
    return teamSeasons;
  }, [workMode, supportSession, teamSeasons, trainerTeamSeasons]);

  const startSupportSession = useCallback(
    (input: ManagerSupportSession & { initialTeamSeasonId: string }) => {
      if (!availableModes.includes('platform_admin')) return;
      const { initialTeamSeasonId, ...session } = input;
      setSupportSession(session);
      setWorkModeState('platform_admin');
      if (authUser?.id) writeStoredWorkMode(authUser.id, 'platform_admin');
      setViewTeamSeasonId(null);
      setSelectedTeamSeasonId(initialTeamSeasonId);
      void adminLogSupportAccess({
        clubId: input.clubId,
        action: 'support_started',
        teamSeasonId: initialTeamSeasonId,
      });
      navigate('/manager');
    },
    [availableModes, authUser?.id, navigate, setSelectedTeamSeasonId, setViewTeamSeasonId],
  );

  const endSupportSession = useCallback(() => {
    if (supportSession) {
      void adminLogSupportAccess({
        clubId: supportSession.clubId,
        action: 'support_ended',
        teamSeasonId: selectedTeamSeasonId,
      });
    }
    setSupportSession(null);
    setViewTeamSeasonId(null);
    navigate('/manager/plattform', { replace: true });
  }, [navigate, selectedTeamSeasonId, setViewTeamSeasonId, supportSession]);

  const applyTrainerTeamSeason = useCallback(
    (opts?: { force?: boolean }) => {
      if (!isTrainerWorkMode(workMode) && !opts?.force) return;
      const nextId = resolveTrainerTeamSeasonId({
        userId: authUser?.id,
        trainerTeamSeasons,
      });
      if (!nextId) return;
      const validTrainer = trainerSeasonIds.has(nextId);
      if (!validTrainer) return;
      if (selectedTeamSeasonId === nextId && !opts?.force) return;
      setSelectedTeamSeasonId(nextId);
      writeStoredTrainerTeamSeasonId(authUser?.id, nextId);
    },
    [
      workMode,
      authUser?.id,
      trainerTeamSeasons,
      trainerSeasonIds,
      selectedTeamSeasonId,
      setSelectedTeamSeasonId,
    ],
  );

  const setWorkMode = useCallback(
    (mode: ManagerWorkMode, opts?: { navigate?: boolean }) => {
      if (!availableModes.includes(mode)) return;
      setWorkModeState(mode);
      if (authUser?.id) writeStoredWorkMode(authUser.id, mode);
      if (mode === 'trainer') {
        const nextId = resolveTrainerTeamSeasonId({
          userId: authUser?.id,
          trainerTeamSeasons,
        });
        if (nextId && trainerSeasonIds.has(nextId)) {
          setSelectedTeamSeasonId(nextId);
          writeStoredTrainerTeamSeasonId(authUser?.id, nextId);
        }
      }
      if (opts?.navigate !== false) {
        navigate(workModeHomePath(mode), { replace: true });
      }
    },
    [
      availableModes,
      authUser?.id,
      navigate,
      trainerTeamSeasons,
      trainerSeasonIds,
      setSelectedTeamSeasonId,
    ],
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
    if (!availableModes.includes('trainer')) return;
    setWorkMode('trainer');
  }, [availableModes, setWorkMode]);

  useEffect(() => {
    if (!isTrainerWorkMode(workMode) || trainerTeamSeasons.length === 0) return;
    const currentValid =
      selectedTeamSeasonId && trainerSeasonIds.has(selectedTeamSeasonId);
    if (!currentValid) {
      applyTrainerTeamSeason({ force: true });
      return;
    }
    writeStoredTrainerTeamSeasonId(authUser?.id, selectedTeamSeasonId);
  }, [
    workMode,
    trainerTeamSeasons,
    trainerSeasonIds,
    selectedTeamSeasonId,
    authUser?.id,
    applyTrainerTeamSeason,
  ]);

  const selectTrainerTeamSeasonId = useCallback(
    (teamSeasonId: string) => {
      if (!trainerSeasonIds.has(teamSeasonId)) return;
      setSelectedTeamSeasonId(teamSeasonId);
      writeStoredTrainerTeamSeasonId(authUser?.id, teamSeasonId);
    },
    [trainerSeasonIds, setSelectedTeamSeasonId, authUser?.id],
  );

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
      selectTrainerTeamSeasonId,
      setWorkMode,
      switchToAdministration,
      switchToTrainer,
      adminSwitchButtonLabel,
      supportSession,
      startSupportSession,
      endSupportSession,
    }),
    [
      workMode,
      availableModes,
      backendRole,
      membershipInputs,
      contextTeamSeasons,
      selectTrainerTeamSeasonId,
      setWorkMode,
      switchToAdministration,
      switchToTrainer,
      adminSwitchButtonLabel,
      supportSession,
      startSupportSession,
      endSupportSession,
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
