import { ManagerSeasonLifecycleAssistant } from './components/ManagerSeasonLifecycleAssistant';
import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ManagerComparisonHeader } from './components/ManagerComparisonHeader';
import { ManagerSidebar } from './components/ManagerSidebar';
import { ManagerAccessGate } from './ManagerAccessGate';
import {CommunicationAccessProvider} from './CommunicationAccessContext';
import { ManagerWorkModeProvider } from './ManagerWorkModeContext';
import { ManagerClubModulesProvider } from './ManagerClubModulesContext';
import { ManagerAccessDeniedBanner, ManagerRouteGuard } from './ManagerRouteGuard';
import { useSession } from '../auth/useSession';
import { getSeasonStatusLabel, isSeasonArchived } from '../lib/seasonLifecycle';
import { ManagerMobileNav } from './components/ManagerMobileNav';
import { ManagerTeamScope } from './ManagerTeamScope';
import './managerShell.css';
import './managerDesktopWorkspace.css';
import './managerSeasonWorkspace.css';
import './managerMobile.css';
import { ManagerAppearance } from './appearance/ManagerAppearance';
import './appearance/managerAppearance.css';
import './modern/managerModern.css';

/**
 * Shell für alle /manager-Seiten: volle Fensterbreite, dunkle Navigation, helle Arbeitsfläche.
 * max-width gilt nur für den Content — nie für Sidebar+Header gemeinsam.
 */
export function ManagerComparisonLayout(): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { viewTeamSeason, selectedTeamSeason } = useSession();
  const context = viewTeamSeason ?? selectedTeamSeason;
  const viewingArchive = context ? isSeasonArchived(context.status) : false;
  const seasonWorkspace = /^\/manager\/saisons\/(verwaltung|meisterschaft)$/.test(location.pathname);
  const mobileAppRoute =
    location.pathname === '/manager' ||
    location.pathname === '/manager/dashboard' ||
    location.pathname === '/manager/plattform' ||
    location.pathname.startsWith('/manager/termine') ||
    location.pathname.startsWith('/manager/platzbelegung') ||
    location.pathname.startsWith('/manager/teams') ||
    location.pathname.startsWith('/manager/mehr');

  return (
    <ManagerAccessGate>
      <ManagerWorkModeProvider>
        <CommunicationAccessProvider><ManagerClubModulesProvider>
        <ManagerAppearance modern>
          <ManagerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#F4F5F7]">
            <ManagerComparisonHeader onOpenSidebar={() => setSidebarOpen(true)} />
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
              'manager-mobile-workspace min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-20 md:pb-0',
              seasonWorkspace ? 'manager-season-workspace' : '',
              seasonWorkspace ? 'bg-[#050506]' : mobileAppRoute ? 'bg-[#050506] md:bg-[#F4F5F7]' : 'bg-[#F4F5F7]',
            ].join(' ')}>
              <div className={[
                'manager-shell__content',
                mobileAppRoute
                  ? 'px-0 py-0 md:px-5 md:py-6 lg:px-8 xl:px-10 2xl:px-12'
                  : 'px-3 py-5 sm:px-5 sm:py-6 lg:px-8 xl:px-10 2xl:px-12',
              ].join(' ')}>
                <ManagerRouteGuard>
                  <ManagerAccessDeniedBanner />
                  <ManagerTeamScope><ManagerSeasonLifecycleAssistant seasonId={context?.id} /><Outlet key={context?.id ?? 'platform'} /></ManagerTeamScope>
                </ManagerRouteGuard>
              </div>
            </main>
            <ManagerMobileNav />
          </div>
        </ManagerAppearance>
        </ManagerClubModulesProvider></CommunicationAccessProvider>
      </ManagerWorkModeProvider>
    </ManagerAccessGate>
  );
}
