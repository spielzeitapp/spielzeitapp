import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useSession } from './useSession';

/** Nach dieser Zeit wird der interne Bereich trotzdem gerendert (kein endloses „Laden…“). */
const SESSION_LOAD_BYPASS_MS = 12000;

interface RequireAuthProps {
  children: React.ReactNode;
  /** Wenn gesetzt: Zugriff nur mit einer dieser Backend-Rollen (prüft backendRole, nicht effectiveRole). */
  allowedBackendRoles?: string[];
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, allowedBackendRoles }) => {
  const { user, loading } = useAuth();
  const { backendRole, loading: sessionLoading } = useSession();
  const location = useLocation();
  const [sessionWaitTimedOut, setSessionWaitTimedOut] = useState(false);

  useEffect(() => {
    if (!sessionLoading) {
      setSessionWaitTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => {
      console.warn('[RequireAuth] session loading bypass after', SESSION_LOAD_BYPASS_MS, 'ms');
      setSessionWaitTimedOut(true);
    }, SESSION_LOAD_BYPASS_MS);
    return () => window.clearTimeout(t);
  }, [sessionLoading]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-white/70">
        Laden…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (sessionLoading && !sessionWaitTimedOut) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-white/70">
        Laden…
      </div>
    );
  }

  if (allowedBackendRoles != null && allowedBackendRoles.length > 0) {
    if (!allowedBackendRoles.includes(backendRole)) {
      return (
        <div className="flex min-h-[200px] items-center justify-center text-white/70">
          Keine Berechtigung für diese Seite.
        </div>
      );
    }
  }

  return <>{children}</>;
};
