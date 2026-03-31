import React from 'react';
import { Outlet } from 'react-router-dom';
import { useSession } from '../auth/useSession';

/**
 * Termine: Liste (Schedule) + Kalender – Toggle oberhalb des Outlets.
 * Fans: nur Liste (Kalender-Redirect in CalendarPage).
 */
export const TermineLayout: React.FC = () => {
  const { effectiveRole } = useSession();

  return (
    <div className="w-full">
      <Outlet />
    </div>
  );
};
