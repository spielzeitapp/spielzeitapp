import React, { useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Menu, X } from 'lucide-react';
import spielzeitappHeader from '../../assets/branding/spielzeitapp-header.png';
import { MANAGER_NAV_SECTIONS } from '../managerNav';

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
 * Feste Desktop-Sidebar; auf schmalen Viewports als Drawer.
 */
export function ManagerSidebar({ open, onClose }: Props): React.ReactElement {
  const closeOnNav = useCallback(() => {
    onClose();
  }, [onClose]);
  const location = useLocation();

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
          'fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!open}
        onClick={onClose}
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col border-r border-white/10 bg-[#0F1012] text-white shadow-xl transition-transform duration-200',
          'lg:static lg:z-0 lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        aria-label="Manager-Navigation"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4">
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Menü schließen"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-red-400/90">
          Manager
        </p>

        <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-4">
          {MANAGER_NAV_SECTIONS.map((section) => (
            <div key={section.id} className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.status === 'ready' && item.to) {
                    const isActive = navItemActive(location.pathname, location.search, item.to);
                    return (
                      <li key={item.id}>
                        <Link
                          to={item.to}
                          onClick={closeOnNav}
                          aria-current={isActive ? 'page' : undefined}
                          className={[
                            'flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
                            isActive
                              ? 'bg-red-600/20 text-white ring-1 ring-red-500/40'
                              : 'text-white/70 hover:bg-white/8 hover:text-white',
                          ].join(' ')}
                        >
                          <LayoutDashboard className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={item.id}>
                      <span
                        className="flex cursor-default items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] text-white/35"
                        title="Demnächst"
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span className="shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">
                          Demnächst
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
          <Link
            to="/app/home"
            onClick={closeOnNav}
            className="flex w-full items-center justify-center rounded-lg border border-white/15 px-3 py-2.5 text-[12px] font-semibold text-white/80 hover:bg-white/8 hover:text-white"
          >
            Zur mobilen App
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
      aria-label="Menü öffnen"
    >
      <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}
