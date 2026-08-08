import React, { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ManagerHeader } from './components/ManagerHeader';
import { ManagerSidebar } from './components/ManagerSidebar';
import { ManagerAccessGate } from './ManagerAccessGate';
import { useSession } from '../auth/useSession';
import { getSeasonStatusLabel, isSeasonArchived } from '../lib/seasonLifecycle';

/**
 * Shell für alle /manager-Seiten: dunkle Sidebar, heller Arbeitsbereich.
 */
export function ManagerLayout(): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { viewTeamSeason, selectedTeamSeason } = useSession();
  const context = viewTeamSeason ?? selectedTeamSeason;
  const viewingArchive = context ? isSeasonArchived(context.status) : false;

  return (
    <ManagerAccessGate>
      <div className="flex min-h-[100dvh] bg-[#F4F5F7] text-slate-900">
        <ManagerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ManagerHeader onOpenSidebar={() => setSidebarOpen(true)} />
          {viewingArchive && context ? (
            <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950 sm:px-5 lg:px-8">
              Du siehst eine abgeschlossene Saison ({getSeasonStatusLabel(context.status)}
              {context.season?.name ? ` · ${context.season.name}` : ''}
              {context.age_group ? ` · ${context.age_group}` : ''}). Neue Planungen gehören in die
              aktive Saison.{' '}
              <Link to="/manager/saisons" className="font-semibold text-red-700 underline">
                Saisonen
              </Link>
            </div>
          ) : null}
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 sm:py-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ManagerAccessGate>
  );
}
