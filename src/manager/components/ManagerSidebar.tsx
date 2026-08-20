import React, { useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import spielzeitappHeader from '../../assets/branding/spielzeitapp-header.png';
import { MANAGER_NAV_SECTIONS } from '../managerNav';
import { navItemVisibleForWorkMode } from '../managerWorkMode';
import { useManagerWorkMode } from '../ManagerWorkModeContext';

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
 * Feste helle Desktop-Sidebar; auf schmalen Viewports als Drawer.
 */
export function ManagerSidebar({ open, onClose }: Props): React.ReactElement {
  const closeOnNav = useCallback(() => {
    onClose();
  }, [onClose]);
  const location = useLocation();
  const { workMode } = useManagerWorkMode();

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
          'fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col border-r border-slate-200 bg-white text-slate-900 shadow-xl transition-transform duration-200',
          'lg:static lg:z-0 lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        aria-label="Manager-Navigation"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 pt-[env(safe-area-inset-top)] lg:pt-0">
          <Link to="/manager" className="flex min-w-0 items-center gap-2" onClick={closeOnNav}>
            <img
              src={spielzeitappHeader}
              alt="SpielzeitApp"
              className="h-7 w-auto max-w-[9.5rem] object-contain object-left"
              decoding="async"
            />
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            onClick={onClose}
            aria-label="Menü schließen"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Mobile: klarer App-Wechsel ganz oben */}
        <div className="border-b border-slate-200 p-3 lg:hidden">
          <Link
            to={MANAGER_TO_APP_HOME_PATH}
            onClick={closeOnNav}
            className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-800 hover:bg-red-100"
          >
            <AppHomeIcon className="h-5 w-5 shrink-0 object-contain" />
            Zur SpielzeitApp
          </Link>
        </div>

        <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-red-700/90">
          {workMode === 'trainer' ? 'Trainer' : workMode === 'platform_admin' ? 'Plattform' : 'Verein'}
        </p>

        <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-4">
          {MANAGER_NAV_SECTIONS.filter(
            (section) => !(workMode === 'trainer' && section.hideInTrainerMode),
          ).map((section) => {
            const items = section.items.filter((item) => navItemVisibleForWorkMode(item, workMode));
            if (items.length === 0) return null;
            return (
            <div key={section.id} className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  if (item.status === 'ready' && item.to) {
                    const isActive = navItemActive(location.pathname, location.search, item.to);
                    return (
                      <li key={item.id}>
                        <Link
                          to={item.to}
                          onClick={closeOnNav}
                          aria-current={isActive ? 'page' : undefined}
                          className={[
                            'flex min-h-[40px] items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
                            isActive
                              ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                          ].join(' ')}
                        >
                          <LayoutDashboard
                            className={[
                              'h-4 w-4 shrink-0',
                              isActive ? 'text-red-700' : 'text-slate-500',
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
                        className="flex cursor-default items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-400"
                        title="Demnächst"
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
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

        <div className="hidden shrink-0 space-y-1 border-t border-slate-200 p-3 lg:block">
          <Link
            to={MANAGER_TO_APP_HOME_PATH}
            onClick={closeOnNav}
            className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
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
      className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
      aria-label="Menü öffnen"
    >
      <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
