import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { canAccessManager } from './canAccessManager';
import {
  filterTrainerStaffTeamSeasonIds,
  hasTrainerStaffMembership,
  resolveAvailableWorkModes,
  resolveEffectiveWorkMode,
} from './managerWorkMode';

type Props = {
  children: React.ReactNode;
};

function GatePanel({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="manager-shell flex min-h-[100dvh] w-full min-w-0 flex-1 items-center justify-center bg-[#F4F5F7] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700/80">Spielzeit Manager</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{body}</p>
        {actions ? <div className="mt-5 flex flex-col gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/**
 * Zustände: Laden, keine Berechtigung, kein Team.
 * Saison-Hinweise erscheinen im Dashboard (nicht als Block).
 */
export function ManagerAccessGate({ children }: Props): React.ReactElement {
  const { user: authUser } = useAuth();
  const { loading, memberships, backendRole, teamSeasons } = useSession();

  const membershipInputs = memberships.map((m) => ({
    team_season_id: m.team_season_id,
    role: m.role,
  }));

  const availableModes = resolveAvailableWorkModes({
    backendRole,
    memberships: membershipInputs,
  });

  const effectiveMode = resolveEffectiveWorkMode({
    userId: authUser?.id,
    backendRole,
    memberships: membershipInputs,
  });

  const trainerSeasonIds = filterTrainerStaffTeamSeasonIds(membershipInputs);
  const hasTrainerContext =
    hasTrainerStaffMembership(membershipInputs) && trainerSeasonIds.length > 0;

  if (loading) {
    return (
      <GatePanel
        title="Manager wird geladen…"
        body="Sitzung, Rollen und Mannschaftskontext werden geprüft."
      />
    );
  }

  if (!canAccessManager(backendRole, memberships)) {
    return (
      <GatePanel
        title="Kein Zugriff auf den Manager"
        body="Der Spielzeit Manager ist für Trainer, Co-Trainer und Vereinsadmin vorgesehen. Eltern und Spieler ohne Verwaltungsrecht nutzen die mobile App."
        actions={
          <>
            <Link
              to="/app/home"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
            >
              Zur mobilen App
            </Link>
            <Link
              to="/app/mehr"
              className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Mehr-Bereich öffnen
            </Link>
          </>
        }
      />
    );
  }

  const platformAdminModeAvailable = availableModes.includes('platform_admin');

  if (effectiveMode === 'trainer' && !hasTrainerContext) {
    return (
      <GatePanel
        title="Keine Mannschaft zugeordnet"
        body="Deinem Konto ist noch keine Trainer-Mannschaftssaison zugeordnet. Bitte schließe die Teamzuordnung in der App ab oder kontaktiere einen Administrator."
        actions={
          platformAdminModeAvailable ? (
            <Link
              to="/manager/vereine"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
            >
              Zur Plattformverwaltung
            </Link>
          ) : (
            <Link
              to="/app/role-choice"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
            >
              Zur App
            </Link>
          )
        }
      />
    );
  }

  if (
    effectiveMode !== 'platform_admin' &&
    !platformAdminModeAvailable &&
    (memberships.length === 0 || teamSeasons.length === 0)
  ) {
    return (
      <GatePanel
        title="Keine Mannschaft zugeordnet"
        body="Deinem Konto ist noch keine Mannschaftssaison zugeordnet. Bitte schließe die Teamzuordnung in der App ab oder kontaktiere einen Administrator."
        actions={
          <Link
            to="/app/role-choice"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
          >
            Zur App
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
