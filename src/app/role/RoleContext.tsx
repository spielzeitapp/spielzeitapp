import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getUiRole,
  getBackendRole,
  setDevUiRole,
  clearDevUiRole as clearDevUiRoleStorage,
  isDevMode,
  canEditSchedule,
  canUseLiveControls,
  type UiRole,
} from '../auth/role';

interface RoleContextValue {
  /** Aktive UI-Rolle (Backend oder DEV-Testrolle). */
  role: UiRole;
  /** Setzt UI-Testrolle (nur wirksam in DEV und wenn Backend admin/head). */
  setRole: (role: UiRole) => void;
  /** Setzt Testrolle zurück auf Backend-Rolle. */
  clearDevUiRole: () => void;
  getBackendRole: () => string;
  isDevMode: () => boolean;
  canEditSchedule: (role: string) => boolean;
  canUseLiveControls: (role: string) => boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UiRole>(() => getUiRole());

  const setRole = useCallback((next: UiRole) => {
    if (!isDevMode()) return;
    const backend = getBackendRole();
    if (backend !== 'admin' && backend !== 'head_coach') return;
    setDevUiRole(next);
    setRoleState(getUiRole());
  }, []);

  const clearDevUiRole = useCallback(() => {
    clearDevUiRoleStorage();
    setRoleState(getUiRole());
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      setRole,
      clearDevUiRole,
      getBackendRole,
      isDevMode,
      canEditSchedule,
      canUseLiveControls,
    }),
    [role, setRole, clearDevUiRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used within RoleProvider');
  }
  return ctx;
}
