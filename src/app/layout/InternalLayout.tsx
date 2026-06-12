import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppBackground } from './AppBackground';
import { Header } from './Header';
import { BottomNav } from '../components/BottomNav';
import { AppFab } from '../components/AppFab';
import { TopNav } from '../components/TopNav';
import { useIsTouchLayout } from '../../hooks/useMediaQuery';
import { useAuth } from '../../auth/AuthProvider';
import { useSession, normalizeRole as normalizeSessionRole } from '../../auth/useSession';
import { useSyncPendingProfile } from '../../auth/useSyncPendingProfile';
import { useSyncProfileFromUserMetadata } from '../../auth/useSyncProfileFromUserMetadata';
import { supabase } from '../../lib/supabaseClient';
import { TabletSidebar } from '../components/TabletSidebar';
import { PushOnboardingPrompt } from '../../components/PushOnboardingPrompt';
import { canManageMatches, normalizeRole as normalizeRoleKey } from '../../lib/roles';

const ONBOARDING_EXEMPT_PATHS = [
  '/app/parent-onboarding',
  '/app/role-choice',
  '/app/set-password',
  '/app/player-onboarding',
] as const;

function isOnboardingExemptPath(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function hasStaffAccess(backendRole: string, memberships: { role?: string | null }[]): boolean {
  const backendKey = normalizeRoleKey(backendRole);
  if (backendKey === 'admin' || backendKey === 'trainer') return true;
  return memberships.some((m) => canManageMatches(normalizeRoleKey(m.role)));
}

/**
 * Layout für den internen Bereich /app/*.
 * Immer mit Header, TopNav/BottomNav (keine öffentliche Reduktion).
 *
 * E2E Parent flow:
 * - First time: register → /app → role-choice → parent-onboarding (team + child) → App.
 * - Second login: email + password → /app/home (onboarding skipped if memberships + player_guardians exist).
 */
export const InternalLayout: React.FC = () => {
  const isTouchLayout = useIsTouchLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { memberships, loading: sessionLoading, backendRole, previewRole } = useSession();
  const isLiveRoute = location.pathname.startsWith('/app/live');
  const pathClean = location.pathname.replace(/\/+$/, '') || '/';
  /** Wie Home/Termine: kein doppeltes Horizontal-Padding zur Shell — Seite steuert px-3/sm:px-4, ab md wie üblich Shell-Padding. */
  const isWideMobileShellRoute =
    pathClean === '/app/home' ||
    pathClean === '/app/team' ||
    pathClean.startsWith('/app/team/') ||
    pathClean === '/app/mehr' ||
    pathClean.startsWith('/app/mehr/');

  useSyncPendingProfile(user ?? null);
  useSyncProfileFromUserMetadata(user ?? null);

  /** Onboarding-Gate: neue Nutzer zur Rollenwahl / Eltern-Onboarding; Staff nicht blockieren. */
  useEffect(() => {
    let alive = true;

    async function gate() {
      if (isOnboardingExemptPath(location.pathname)) {
        return;
      }

      if (!user || sessionLoading) return;

      const membershipList = memberships ?? [];
      if (hasStaffAccess(backendRole, membershipList)) return;

      const preview = normalizeSessionRole(previewRole ?? '') ?? '';
      const hasParentMembership = membershipList.some(
        (m) => normalizeSessionRole(m.role) === 'parent',
      );
      const hasPlayerMembership = membershipList.some(
        (m) => normalizeSessionRole(m.role) === 'player',
      );

      const pgRes = await supabase
        .from('player_guardians')
        .select('player_id')
        .eq('user_id', user.id)
        .limit(1);
      const hasGuardian = !pgRes.error && (pgRes.data ?? []).length > 0;

      if (!alive) return;

      if (hasParentMembership && hasGuardian) return;

      if (preview === 'fan' && !hasParentMembership && !hasGuardian) return;

      if (preview === 'player' && !hasPlayerMembership) {
        navigate('/app/player-onboarding', { replace: true });
        return;
      }
      if (hasPlayerMembership) return;

      const needsParentOnboarding =
        preview === 'parent' ||
        normalizeSessionRole(backendRole) === 'parent' ||
        hasParentMembership ||
        hasGuardian;

      if (needsParentOnboarding) {
        navigate('/app/parent-onboarding', { replace: true });
        return;
      }

      if (membershipList.length === 0 && !hasGuardian) {
        navigate('/app/role-choice', { replace: true });
      }
    }

    gate().catch((e) => {
      console.error('[OnboardingGate]', e);
    });

    return () => {
      alive = false;
    };
  }, [
    location.pathname,
    user,
    sessionLoading,
    backendRole,
    previewRole,
    memberships,
    navigate,
  ]);

  return (
    <AppBackground>
      {isTouchLayout ? null : <TopNav />}

      <div className="app min-h-screen bg-black text-white">
        <Header />
        <main
          className={`app__content appMain pt-[var(--app-header-offset)] ${
            isTouchLayout
              ? 'pb-[max(10rem,calc(7.5rem+env(safe-area-inset-bottom,0px)))] lg:pb-24'
              : 'pb-24'
          }`}
        >
          <div
            className={`mx-auto w-full min-w-0 ${
              isLiveRoute
                ? 'max-w-none px-2 md:px-3 lg:px-4'
                : isWideMobileShellRoute
                  ? 'max-w-none px-0 md:max-w-[96rem] md:px-6 lg:px-8'
                  : 'max-w-[96rem] px-3 md:px-6 lg:px-8'
            }`}
          >
            <div className="lg:flex lg:items-start lg:gap-6">
              <TabletSidebar compact={isLiveRoute} />
              <div className="min-w-0 flex-1">
                <Outlet />
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="lg:hidden">{isTouchLayout ? <BottomNav /> : null}</div>
      <div className="lg:hidden">{isTouchLayout ? <AppFab /> : null}</div>
      <PushOnboardingPrompt />
    </AppBackground>
  );
};
