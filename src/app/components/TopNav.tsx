import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../../auth/useSession';

/** Standard-Nav: Kein "Trainer"-Button/Badge. Nur Links. */
const links = [
  { to: '/', label: 'Home' },
  { to: '/schedule', label: 'Spielplan' },
  { to: '/live', label: 'Live' },
  { to: '/team', label: 'Team' },
  { to: '/table', label: 'Tabelle' },
];

export const TopNav: React.FC = () => {
  const { role } = useSession();
  const isAdmin = (role ?? '').toString().toLowerCase() === 'admin';

  return (
    <nav className="flex sticky top-0 z-40 w-full bg-[rgba(11,11,15,0.9)] border-b border-[var(--border)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 md:px-8 py-2 text-sm">
        <div className="flex items-center gap-1">
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
          {isAdmin && (
            <NavLink
              to="/roles-admin"
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

