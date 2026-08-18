/**
 * TRAINER-MODE.1 – Route-Guard für Admin-Pfade im Trainer-Arbeitsmodus.
 */
import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useManagerWorkMode } from './ManagerWorkModeContext';
import { isAdminOnlyManagerLocation } from './managerWorkMode';

type Props = {
  children: React.ReactNode;
};

export function ManagerRouteGuard({ children }: Props): React.ReactElement {
  const location = useLocation();
  const { workMode, availableModes, switchToAdministration, isTrainerMode } = useManagerWorkMode();

  const adminRoute = isAdminOnlyManagerLocation(location.pathname, location.search);

  if (!adminRoute) return <>{children}</>;

  if (!isTrainerMode) return <>{children}</>;

  const canElevate =
    availableModes.includes('platform_admin') || availableModes.includes('club_admin');

  if (canElevate) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[16px] font-semibold text-slate-900">Administrationsbereich</h2>
        <p className="mt-2 text-[14px] text-slate-600">
          Du befindest dich in der Traineransicht. Dieser Bereich gehört zur{' '}
          {availableModes.includes('platform_admin') ? 'Plattformverwaltung' : 'Vereinsverwaltung'}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-red-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-800"
            onClick={() => switchToAdministration()}
          >
            {availableModes.includes('platform_admin')
              ? 'Zur Plattformverwaltung wechseln'
              : 'Zur Vereinsverwaltung wechseln'}
          </button>
          <Link
            to="/manager"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Zur Trainerübersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Navigate
      to="/manager"
      replace
      state={{
        accessDenied: true,
        message: 'Für diesen Bereich fehlen dir die erforderlichen Rechte.',
      }}
    />
  );
}

/** Banner nach Redirect für reine Trainer. */
export function ManagerAccessDeniedBanner(): React.ReactElement | null {
  const location = useLocation();
  const state = location.state as { accessDenied?: boolean; message?: string } | null;
  if (!state?.accessDenied) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
      {state.message ?? 'Für diesen Bereich fehlen dir die erforderlichen Rechte.'}
    </div>
  );
}
