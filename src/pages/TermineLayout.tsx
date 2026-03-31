import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../auth/useSession';

/**
 * Termine: Liste (Schedule) + Kalender – Toggle oberhalb des Outlets.
 * Fans: nur Liste (Kalender-Redirect in CalendarPage).
 */
export const TermineLayout: React.FC = () => {
  const { effectiveRole } = useSession();
  const isFan = effectiveRole === 'fan';

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-2.5 py-1.5 text-center text-xs font-medium transition-colors ${
      active ? 'bg-red-600/90 text-white' : 'bg-white/5 text-white/65 hover:bg-white/10'
    }`;

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[720px] px-4 pt-2">
        <h1 className="text-4xl font-bold text-white tracking-tight leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
          {isFan ? 'Spielplan' : 'Termine'}
        </h1>
      </div>
      {!isFan && (
        <div className="mx-auto mt-2 mb-2 flex max-w-[420px] gap-1.5 px-4">
          <NavLink to="/app/termine" end className={({ isActive }) => tabClass(isActive)}>
            Liste
          </NavLink>
          <NavLink to="/app/termine/calendar" className={({ isActive }) => tabClass(isActive)}>
            Kalender
          </NavLink>
        </div>
      )}
      <Outlet />
    </div>
  );
};
