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

/**
 * Layout für den internen Bereich /app/*.
 * Immer mit Header, TopNav/BottomNav (keine öffentliche Reduktion).
 *
 * E2E Parent flow:
 * - First time: register → /app → role-choice → parent-onboarding (team + child) → set-password → schedule.
 * - Second login: email + password → /app/home (onboarding skipped if memberships + player_guardians exist).
 */
export const InternalLayout: React.FC = () => {
  const isTouchLayout = useIsTouchLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { memberships, loading: sessionLoading, backendRole } = useSession();
  const isLiveRoute = location.pathname.startsWith('/app/live');
  const pathClean = location.pathname.replace(/\/+$/, '') || '/';
  const isHomeRoute = pathClean === '/app/home';

  useSyncPendingProfile(user ?? null);
  useSyncProfileFromUserMetadata(user ?? null);

  /** Parent-Onboarding-Gate: nur navigieren, Shell nie blockieren (kein globaler „Laden…“-Deadlock). */
  useEffect(() => {
    let alive = true;

    async function gate() {
      if (
        location.pathname === '/app/parent-onboarding' ||
        location.pathname === '/app/role-choice' ||
        location.pathname === '/app/set-password'
      ) {
        return;
      }

      if (!user || sessionLoading) return;

      const backend = normalizeSessionRole(backendRole);
      const isStaff = backend === 'trainer' || backend === 'admin';
      const isParentGlobal = backend === 'parent';
      if (isStaff || !isParentGlobal) {
        return;
      }

      if ((memberships ?? []).length === 0) {
        navigate('/app/role-choice', { replace: true });
        return;
      }

      const hasParentMembership =
        (memberships ?? []).some((m) => normalizeSessionRole(m.role) === 'parent');
      const pgRes = await supabase
        .from('player_guardians')
        .select('player_id')
        .eq('user_id', user.id)
        .limit(1);
      const hasGuardian = !pgRes.error && (pgRes.data ?? []).length > 0;

      if (!alive) return;

      if (!hasParentMembership || !hasGuardian) {
        navigate('/app/parent-onboarding', { replace: true });
        return;
      }
    }

    gate().catch((e) => {
      console.error('[ParentOnboardingGate]', e);
    });

    return () => {
      alive = false;
    };
  }, [location.pathname, user, sessionLoading, backendRole, memberships, navigate]);

  return (
    <AppBackground>
      {isTouchLayout ? null : <TopNav />}

      <div className="app min-h-screen bg-black text-white">
        <Header />
        <main
          className={`app__content appMain pt-[max(5.75rem,calc(3.75rem+env(safe-area-inset-top,0px)))] ${
            isTouchLayout
              ? 'pb-[max(10rem,calc(7.5rem+env(safe-area-inset-bottom,0px)))] lg:pb-24'
              : 'pb-24'
          }`}
        >
          <div
            className={`mx-auto w-full min-w-0 ${
              isLiveRoute
                ? 'max-w-none px-2 md:px-3 lg:px-4'
                : isHomeRoute
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
    </AppBackground>
  );
};
