import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppBackground } from './AppBackground';
import { Header } from './Header';
import { BottomTabs } from '../components/BottomTabs';
import { TopNav } from '../components/TopNav';
import { useIsTouchLayout } from '../../hooks/useMediaQuery';
import { useAuth } from '../../auth/AuthProvider';
import { useSession, normalizeRole as normalizeSessionRole } from '../../auth/useSession';
import { supabase } from '../../lib/supabaseClient';

/**
 * Layout für den internen Bereich /app/*.
 * Immer mit Header, TopNav/BottomTabs (keine öffentliche Reduktion).
 */
export const InternalLayout: React.FC = () => {
  const isTouchLayout = useIsTouchLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { memberships, loading: sessionLoading, backendRole } = useSession();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;

    async function gate() {
      // Onboarding- / Rollenauswahl-Seiten selbst nie blocken.
      if (
        location.pathname === '/app/parent-onboarding' ||
        location.pathname === '/app/role-choice'
      ) {
        if (alive) setChecked(true);
        return;
      }

      if (!user || sessionLoading) return;

      // Trainer/Admin (globalRole) nie zum Parent-Onboarding zwingen.
      // Parent-Onboarding nur für echte Parent-User (backendRole = 'parent'), nicht für Fans.
      const backend = normalizeSessionRole(backendRole);
      const isStaff = backend === 'trainer' || backend === 'admin';
      const isParentGlobal = backend === 'parent';
      if (isStaff || !isParentGlobal) {
        if (alive) setChecked(true);
        return;
      }

      // Wenn keine Memberships vorhanden sind (neuer User), zuerst Rollenauswahl anzeigen.
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

      // Redirect wenn Parent-Setup unvollständig: keine parent-membership ODER keine player_guardians.
      if (!hasParentMembership || !hasGuardian) {
        navigate('/app/parent-onboarding', { replace: true });
        return;
      }

      if (alive) setChecked(true);
    }

    gate().catch((e) => {
      console.error('[ParentOnboardingGate]', e);
      if (alive) setChecked(true);
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
        <main className="app__content appMain pt-24 pb-24">
          {!user || sessionLoading || checked ? <Outlet /> : (
            <div className="flex min-h-[200px] items-center justify-center text-white/70">
              Laden…
            </div>
          )}
        </main>
      </div>

      {isTouchLayout ? <BottomTabs /> : null}
    </AppBackground>
  );
};
