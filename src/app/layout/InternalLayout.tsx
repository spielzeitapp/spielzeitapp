import React, { useEffect, useState } from 'react';
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
import {
  isParentLinkDeferred,
  isParentOnboardingSatisfied,
  isParentRoleChosen,
  userHasPlayerGuardian,
} from '../../lib/parentChildLink';
import {
  hasOpenParentEmailInviteForMe,
  markPendingParentEmailInvite,
  readPendingParentEmailInviteFlag,
  resolvePendingParentInvitePath,
} from '../../lib/parentLinkInvites';

const ONBOARDING_EXEMPT_PATHS = [
  '/app/parent-onboarding',
  '/app/fan-onboarding',
  '/app/role-choice',
  '/app/set-password',
  '/app/player-onboarding',
  '/app/player-access',
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
 * Persönliche Eltern-Einladung hat Vorrang vor Splash, Rollenwahl und Kind-Selbstverknüpfung.
 */
export const InternalLayout: React.FC = () => {
  const isTouchLayout = useIsTouchLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { memberships, loading: sessionLoading, backendRole, previewRole } = useSession();
  const [gateChecking, setGateChecking] = useState(true);
  const isLiveRoute = location.pathname.startsWith('/app/live');
  const pathClean = location.pathname.replace(/\/+$/, '') || '/';
  const isWideMobileShellRoute =
    pathClean === '/app/home' ||
    pathClean === '/app/team' ||
    pathClean.startsWith('/app/team/') ||
    pathClean === '/app/mehr' ||
    pathClean.startsWith('/app/mehr/');

  useSyncPendingProfile(user ?? null);
  useSyncProfileFromUserMetadata(user ?? null);

  useEffect(() => {
    let alive = true;

    async function gate() {
      const pendingInvitePath = resolvePendingParentInvitePath();
      const onInvitePage =
        location.pathname === '/app/parent-invite' ||
        location.pathname.startsWith('/app/parent-invite/');
      if (pendingInvitePath && !onInvitePage) {
        if (alive) setGateChecking(false);
        window.location.replace(pendingInvitePath);
        return;
      }
      if (!onInvitePage && readPendingParentEmailInviteFlag()) {
        if (alive) setGateChecking(false);
        window.location.replace('/app/parent-invite');
        return;
      }

      if (isOnboardingExemptPath(location.pathname)) {
        if (alive) setGateChecking(false);
        return;
      }

      if (!user || sessionLoading) {
        if (alive) setGateChecking(true);
        return;
      }

      if (alive) setGateChecking(true);

      const membershipList = memberships ?? [];
      if (hasStaffAccess(backendRole, membershipList)) {
        if (alive) setGateChecking(false);
        return;
      }

      const preview = normalizeSessionRole(previewRole ?? '') ?? '';
      const hasParentMembership = membershipList.some(
        (m) => normalizeSessionRole(m.role) === 'parent',
      );
      const hasPlayerMembership = membershipList.some(
        (m) => normalizeSessionRole(m.role) === 'player',
      );
      const hasFanMembership = membershipList.some(
        (m) => normalizeSessionRole(m.role) === 'fan',
      );

      const guardianRes = await userHasPlayerGuardian(user.id);
      const hasGuardian = guardianRes.hasGuardian;

      if (!hasGuardian && !onInvitePage) {
        const openEmailInvite = await hasOpenParentEmailInviteForMe();
        if (!alive) return;
        if (openEmailInvite) {
          markPendingParentEmailInvite();
          setGateChecking(false);
          window.location.replace('/app/parent-invite');
          return;
        }
      }

      let gateUser = user;
      try {
        const { data: fresh } = await supabase.auth.getUser();
        if (fresh?.user) gateUser = fresh.user;
      } catch {
        // ignore — Fallback auf Context-User
      }
      const deferred = isParentLinkDeferred(gateUser);

      if (!alive) return;

      if (hasGuardian) {
        setGateChecking(false);
        return;
      }

      if (hasFanMembership) {
        setGateChecking(false);
        return;
      }

      if (
        preview === 'fan' &&
        !hasParentMembership &&
        !hasPlayerMembership &&
        !hasGuardian
      ) {
        setGateChecking(false);
        navigate('/app/fan-onboarding', { replace: true });
        return;
      }

      if (preview === 'player' && !hasPlayerMembership) {
        setGateChecking(false);
        navigate('/app/player-onboarding', { replace: true });
        return;
      }
      if (hasPlayerMembership) {
        setGateChecking(false);
        return;
      }

      const parentSat = isParentOnboardingSatisfied({
        hasGuardian,
        hasParentMembership,
        deferred,
        previewIsParent: preview === 'parent',
        backendIsParent: normalizeSessionRole(backendRole) === 'parent',
        parentRoleChosen: isParentRoleChosen(gateUser),
      });

      if (parentSat.needsOnboardingUi) {
        setGateChecking(false);
        navigate('/app/parent-onboarding', { replace: true });
        return;
      }

      if (parentSat.complete && (deferred || hasParentMembership || preview === 'parent')) {
        setGateChecking(false);
        return;
      }

      if (membershipList.length === 0 && !hasGuardian && !deferred) {
        setGateChecking(false);
        navigate('/app/role-choice', { replace: true });
        return;
      }

      setGateChecking(false);
    }

    gate().catch((e) => {
      console.error('[OnboardingGate]', e);
      if (alive) setGateChecking(false);
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

  const blockContent =
    !isOnboardingExemptPath(location.pathname) &&
    (sessionLoading || gateChecking);

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
                {blockContent ? (
                  <p className="px-4 py-8 text-sm text-white/55">Lade…</p>
                ) : (
                  <Outlet />
                )}
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
