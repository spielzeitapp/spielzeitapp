import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useSession } from './useSession';

interface RequireAuthProps {
  children: React.ReactNode;
  /** Wenn gesetzt: Zugriff nur mit einer dieser Backend-Rollen (prüft backendRole, nicht effectiveRole). */
  allowedBackendRoles?: string[];
}

/** Auth loading max. ~3s (AuthProvider); kein Block auf Membership/Session-Daten. */
export const RequireAuth: React.FC<RequireAuthProps> = ({ children, allowedBackendRoles }) => {
  const { user, loading } = useAuth();
  const { backendRole } = useSession();
  const location = useLocation();

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
