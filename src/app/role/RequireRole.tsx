import React from 'react';
import type { ReactNode } from 'react';
import type { UiRole } from '../auth/role';
import { useRole } from './RoleContext';

interface RequireRoleProps {
  allowed: UiRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({
  allowed,
  children,
  fallback = null,
}) => {
  const { role } = useRole();

  if (!allowed.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

