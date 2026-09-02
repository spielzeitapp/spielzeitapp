import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ManagerHeader } from './components/ManagerHeader';
import { ManagerSidebar } from './components/ManagerSidebar';
import { ManagerAccessGate } from './ManagerAccessGate';
import { ManagerWorkModeProvider } from './ManagerWorkModeContext';
import { ManagerClubModulesProvider } from './ManagerClubModulesContext';
import { ManagerAccessDeniedBanner, ManagerRouteGuard } from './ManagerRouteGuard';
import { useSession } from '../auth/useSession';
import { getSeasonStatusLabel, isSeasonArchived } from '../lib/seasonLifecycle';
import { ManagerMobileNav } from './components/ManagerMobileNav';
import './managerShell.css';

/**
 * Shell für alle /manager-Seiten: volle Fensterbreite, dunkle Navigation, helle Arbeitsfläche.
 * max-width gilt nur für den Content — nie für Sidebar+Header gemeinsam.
 */
export function ManagerLayout(): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { viewTeamSeason, selectedTeamSeason } = useSession();
  const context = viewTeamSeason ?? selectedTeamSeason;
  const viewingArchive = context ? isSeasonArchived(context.status) : false;
  const dashboardRoute = location.pathname === '/manager' || location.pathname === '/manager/dashboard';

  return (
    <ManagerAccessGate>
      <ManagerWorkModeProvider>
        <ManagerClubModulesProvider>
        <div className="manager-shell flex min-h-[100dvh] w-full min-w-0 flex-1 bg-[#F4F5F7] text-slate-900">
          <ManagerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col bg-[#F4F5F7]">
            <ManagerHeader onOpenSidebar={() => setSidebarOpen(true)} />
            {viewingArchive && context ? (
              <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950 sm:px-5 lg:px-8 xl:px-10">
                Du siehst eine abgeschlossene Saison ({getSeasonStatusLabel(context.status)}
                {context.season?.name ? ` · ${context.season.name}` : ''}
                {context.age_group ? ` · ${context.age_group}` : ''}). Neue Planungen gehören in die
                aktive Saison.{' '}
                <Link to="/manager/saisons" className="font-semibold text-red-700 underline">
                  Saisonen
                </Link>
              </div>
            ) : null}
            <main className={[
              'min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-0',
              dashboardRoute ? 'bg-[#050506] md:bg-[#F4F5F7]' : 'bg-[#F4F5F7]',
            ].join(' ')}>
              <div className={[
                'manager-shell__content',
                dashboardRoute
                  ? 'px-0 py-0 md:px-5 md:py-6 lg:px-8 xl:px-10 2xl:px-12'
                  : 'px-3 py-5 sm:px-5 sm:py-6 lg:px-8 xl:px-10 2xl:px-12',
              ].join(' ')}>
                <ManagerRouteGuard>
                  <ManagerAccessDeniedBanner />
                  <Outlet />
                </ManagerRouteGuard>
              </div>
            </main>
            <ManagerMobileNav onOpenMenu={() => setSidebarOpen(true)} />
          </div>
        </div>
        </ManagerClubModulesProvider>
      </ManagerWorkModeProvider>
    </ManagerAccessGate>
  );
}
