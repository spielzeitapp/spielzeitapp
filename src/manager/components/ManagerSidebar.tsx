import React, { useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  CalendarDays,
  Dumbbell,
  History,
  Home,
  LayoutDashboard,
  MapPinned,
  Menu,
  Shield,
  Trophy,
  Users,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import spielzeitappHeader from '../../assets/branding/spielzeitapp-header.png';
import { MANAGER_NAV_SECTIONS } from '../managerNav';
import { navItemVisibleForWorkMode } from '../managerWorkMode';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { useManagerClubModules } from '../ManagerClubModulesContext';

/** Bestehende mobile App-Startseite (ohne Logout). */
export const MANAGER_TO_APP_HOME_PATH = '/app/home';

function appHomeIconSrc(): string {
  const b = import.meta.env.BASE_URL || '/';
  const base = b.endsWith('/') ? b : `${b}/`;
  return `${base}icons/home-ball.png`;
}

export function AppHomeIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <img
      src={appHomeIconSrc()}
      alt=""
      aria-hidden
      draggable={false}
      className={className ?? 'h-5 w-5 shrink-0 object-contain'}
    />
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: Home,
  events: CalendarDays,
  venues: MapPinned,
  facilities: MapPinned,
  training: Dumbbell,
  'training-lib': BookOpen,
  'training-tpl': LayoutDashboard,
  'training-chronik': History,
  matches: LayoutDashboard,
  tournaments: Trophy,
  squad: Users,
  players: Users,
  parents: Users,
  seasons: CalendarDays,
  video: Video,
  clubs: Shield,
  'platform-dashboard': LayoutDashboard,
  equipment: Building2,
};

function navItemActive(pathname: string, search: string, to: string): boolean {
  const [path, query = ''] = to.split('?');
  const pathMatch =
    pathname === path ||
    (path !== '/manager' && path.startsWith('/manager/') && pathname.startsWith(`${path}/`));
  if (!pathMatch) return false;
  if (!query) {
    // Haupt-Platzbelegung ohne Tab: aktiv außer bei tab=facilities
    if (path === '/manager/platzbelegung') {
      const tab = new URLSearchParams(search).get('tab');
      return tab !== 'facilities';
    }
    return true;
  }
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(search);
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false;
  }
  return true;
}

/**
 * Feste dunkle Desktop-Sidebar; auf schmalen Viewports als Drawer.
 */
export function ManagerSidebar({ open, onClose }: Props): React.ReactElement {
  const closeOnNav = useCallback(() => {
    onClose();
  }, [onClose]);
  const location = useLocation();
  const { workMode, supportSession } = useManagerWorkMode();
  const { isModuleEnabled } = useManagerClubModules();
  const platformGlobal = workMode === 'platform_admin' && !supportSession;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-40 bg-slate-900/30 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!open}
        onClick={onClose}
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r border-white/10 bg-[#090909] text-white shadow-xl transition-transform duration-200',
          'lg:static lg:z-0 lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        aria-label="Manager-Navigation"
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-white/10 px-5 pt-[env(safe-area-inset-top)] lg:pt-0">
          <Link to={platformGlobal ? '/manager/plattform' : '/manager'} className="flex min-w-0 items-center gap-2" onClick={closeOnNav}>
            <img
              src={spielzeitappHeader}
              alt="SpielzeitApp"
              className="h-9 w-auto max-w-[13rem] object-contain object-left"
              decoding="async"
            />
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Menü schließen"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Mobile: klarer App-Wechsel ganz oben */}
        <div className="border-b border-white/10 p-3 lg:hidden">
          <Link
            to={MANAGER_TO_APP_HOME_PATH}
            onClick={closeOnNav}
            className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg border border-red-500/40 bg-red-600 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700"
          >
            <AppHomeIcon className="h-5 w-5 shrink-0 object-contain" />
            Zur SpielzeitApp
          </Link>
        </div>

        <p className="px-5 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-red-400">
          {workMode === 'trainer' ? 'Trainer' : supportSession ? 'Support' : workMode === 'platform_admin' ? 'Plattform' : 'Verein'}
        </p>

        <nav className="mt-2 flex-1 overflow-y-auto px-2.5 pb-4 manager-sidebar-scroll">
          {MANAGER_NAV_SECTIONS.filter((section) => {
            if (platformGlobal) return section.id === 'platform';
            if (section.id === 'platform') return false;
            return !(workMode === 'trainer' && section.hideInTrainerMode);
          }).map((section) => {
            const items = section.items.filter(
              (item) =>
                navItemVisibleForWorkMode(item, workMode) &&
                !item.platformGlobalOnly &&
                isModuleEnabled(item.moduleKey),
            );
            if (items.length === 0) return null;
            return (
            <div key={section.id} className="mb-4">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  if (item.status === 'ready' && item.to) {
                    const isActive = navItemActive(location.pathname, location.search, item.to);
                    const ItemIcon = NAV_ICONS[item.id] ?? LayoutDashboard;
                    return (
                      <li key={item.id}>
                        <Link
                          to={item.to}
                          onClick={closeOnNav}
                          aria-current={isActive ? 'page' : undefined}
                          className={[
                            'flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
                            isActive
                              ? 'bg-red-600 text-white shadow-[0_8px_22px_rgba(220,38,38,0.25)]'
                              : 'text-white/80 hover:bg-white/10 hover:text-white',
                          ].join(' ')}
                        >
                          <ItemIcon
                            className={[
                              'h-5 w-5 shrink-0',
                              isActive ? 'text-white' : 'text-white/70',
                            ].join(' ')}
                            aria-hidden
                          />
                          {item.label}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={item.id}>
                      <span
                        className="flex cursor-default items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] text-white/35"
                        title="Demnächst"
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/45">
                          Demnächst
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })}
        </nav>

        <div className="hidden shrink-0 space-y-1 border-t border-white/10 p-3 lg:block">
          <Link
            to={MANAGER_TO_APP_HOME_PATH}
            onClick={closeOnNav}
            className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          >
            <AppHomeIcon className="h-4 w-4 shrink-0 object-contain" />
            Zur SpielzeitApp
          </Link>
        </div>
      </aside>
    </>
  );
}

export function ManagerMenuButton({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white shadow-sm hover:bg-white/10 lg:hidden"
      aria-label="Menü öffnen"
    >
      <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
