import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '../../auth/useSession';

/**
 * Floating + für Trainer/Admin: Schnellzugriff Termine (Event anlegen dort).
 */
export const AppFab: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { backendRole, effectiveRole } = useSession();
  const staff =
    backendRole === 'admin' ||
    backendRole === 'trainer' ||
    effectiveRole === 'trainer' ||
    effectiveRole === 'admin';

  if (!staff) return null;

  if (pathname === '/app/home') return null;
  if (pathname === '/app/team' || pathname.startsWith('/app/team/')) return null;
  if (pathname === '/app/termine' || pathname.startsWith('/app/termine/')) return null;
  if (pathname === '/app/events' || pathname.startsWith('/app/events/')) return null;
  if (pathname === '/app/live' || pathname.startsWith('/app/live/')) return null;
  if (pathname === '/app/profile' || pathname.startsWith('/app/mehr')) return null;

  const isPrematchLineup = pathname === '/app/match-lineup';

  return (
    <button
      type="button"
      onClick={() => navigate('/app/termine')}
      className={
        isPrematchLineup
          ? 'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] right-3 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-red-600/88 text-white shadow-md transition-transform hover:scale-[1.02] hover:bg-red-500/92 focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:ring-offset-2 focus:ring-offset-black md:bottom-8 md:right-8 md:h-14 md:w-14 md:border-0 md:bg-red-600 md:shadow-lg'
          : 'fixed bottom-24 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black md:bottom-8 md:right-8'
      }
      aria-label="Termin oder Nachricht – zu Termine"
      title="Termine"
    >
      <Plus className={isPrematchLineup ? 'h-5 w-5' : 'h-7 w-7'} strokeWidth={isPrematchLineup ? 2.25 : 2.5} />
    </button>
  );
};
