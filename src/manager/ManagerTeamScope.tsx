import React from 'react';
import { useLocation } from 'react-router-dom';
import { SessionViewProvider, useSession } from '../auth/useSession';
import { RoleProvider } from '../app/role/RoleContext';
import { useManagerWorkMode } from './ManagerWorkModeContext';
import { resolveManagerTeamScope } from './resolveManagerTeamScope';

export function ManagerTeamScope({ children }: { children: React.ReactNode }): React.ReactElement {
  const session = useSession();
  const { workMode, contextTeamSeasons } = useManagerWorkMode();
  const { pathname } = useLocation();
  // Platform settings do not need a team. All team workspaces require an authorized context.
  if (pathname.startsWith('/manager/plattform') || pathname.startsWith('/manager/vereine') || pathname === '/manager/mehr' || pathname === '/manager/teams') return <>{children}</>;
  if (session.loading) return <p role="status">Mannschaft wird geladen…</p>;
  const scope = resolveManagerTeamScope(session, workMode, contextTeamSeasons);
  if (!scope) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900">
    <h1 className="text-xl font-semibold">Mannschaft auswählen</h1>
    <p className="mt-2 text-sm text-slate-600">Wähle oben eine freigegebene Mannschaft und Saison. Als Admin kannst du weitere Mannschaften unter „Vereine“ über „Verein verwalten“ öffnen.</p>
  </section>;
  return <SessionViewProvider value={scope}><RoleProvider>{children}</RoleProvider></SessionViewProvider>;
}
