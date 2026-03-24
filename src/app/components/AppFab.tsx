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
  if (pathname === '/app/profile' || pathname.startsWith('/app/mehr')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/app/termine')}
      className="fixed bottom-24 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black md:bottom-8 md:right-8"
      aria-label="Termin oder Nachricht – zu Termine"
      title="Termine"
    >
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
};
