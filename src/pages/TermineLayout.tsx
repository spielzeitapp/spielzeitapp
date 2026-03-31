import React from 'react';
import { Outlet } from 'react-router-dom';
import { useSession } from '../auth/useSession';

/**
 * Termine: Liste (Schedule) + Kalender – Toggle oberhalb des Outlets.
 * Fans: nur Liste (Kalender-Redirect in CalendarPage).
 */
export const TermineLayout: React.FC = () => {
  const { effectiveRole } = useSession();
  const isFan = effectiveRole === 'fan';

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[720px] px-4 pt-2">
        <h1 className="text-4xl font-bold text-white tracking-tight leading-none [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
          {isFan ? 'Spielplan' : 'Termine'}
        </h1>
      </div>
      <Outlet />
    </div>
  );
};
