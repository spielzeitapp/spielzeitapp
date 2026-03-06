import type { ReactNode } from 'react';
import React from 'react';
import { useSession } from './useSession';

export type Role = 'fan' | 'parent' | 'player' | 'trainer' | 'co_trainer' | 'head_coach' | 'admin';

export type FeatureKey = 'rsvp' | 'training' | 'match_admin' | 'roles_admin';

export interface User {
  id: string;
  name: string;
  role: Role;
}

const roleFeatures: Record<Role, FeatureKey[]> = {
  fan: [],
  parent: ['rsvp', 'training'],
  player: ['rsvp', 'training'],
  trainer: ['rsvp', 'training', 'match_admin'],
  co_trainer: ['rsvp', 'training', 'match_admin'],
  head_coach: ['rsvp', 'training', 'match_admin', 'roles_admin'],
  admin: ['rsvp', 'training', 'match_admin', 'roles_admin'],
};

export function hasRole(user: User | null | undefined, allowedRoles: Role[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

export function canAccess(user: User | null | undefined, feature: FeatureKey): boolean {
  if (!user) return false;
  const features = roleFeatures[user.role] ?? [];
  return features.includes(feature);
}

interface RequireFeatureProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}

export const RequireFeature: React.FC<RequireFeatureProps> = ({ feature, children, fallback = null }) => {
  const { user } = useSession();

  if (!canAccess(user, feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
