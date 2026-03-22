import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../auth/useSession';

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/schedule', label: 'Spielplan' },
];

/** Desktop: schlanke Links zum internen MVP (5 Bereiche + Kalender-Unterseite über Termine). */
const appLinks = [
  { to: '/app/home', label: 'Home' },
  { to: '/app/termine', label: 'Termine' },
  { to: '/app/live', label: 'Live' },
  { to: '/app/team', label: 'Team' },
  { to: '/app/mehr', label: 'Mehr' },
];

export const TopNav: React.FC = () => {
  const { pathname } = useLocation();
  const { role } = useSession();
  const isApp = pathname.startsWith('/app');
  const isAdmin = (role ?? '').toString().toLowerCase() === 'admin';
  const links = isApp ? appLinks : publicLinks;

  return (
    <nav className="flex sticky top-0 z-40 w-full bg-[rgba(11,11,15,0.9)] border-b border-[var(--border)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 md:px-8 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                [
                  'px-2 py-1 rounded-full transition-colors',
                  isActive
                    ? 'text-[var(--primary)] bg-white/5 font-semibold'
                    : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-white/5',
                ].join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
          {isApp && isAdmin && (
            <NavLink
              to="/admin/roles"
              className={({ isActive }) =>
                [
                  'px-2 py-1 rounded-full transition-colors',
                  isActive
                    ? 'text-[var(--primary)] bg-white/5 font-semibold'
                    : 'text-[var(--text-sub)] hover:text-[var(--text-main)] hover:bg-white/5',
                ].join(' ')
              }
            >
              Admin
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  );
};
