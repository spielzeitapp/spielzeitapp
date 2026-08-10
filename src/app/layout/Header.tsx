import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useSession } from '../../auth/useSession';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabaseClient';
import { dsGlassIconButtonClass, dsTrainerPillClass } from '../../lib/premiumDesignSystem';
import spielzeitappHeader from '../../assets/branding/spielzeitapp-header.png';
import { TeamSwitcher } from '../components/TeamSwitcher';
import { isStagingApp } from '../../lib/appEnvironment';

const APP_HEADER_ALT = 'SpielzeitApp – TEAMS LIVE MOMENTE';

/** App-Wortmarke (PNG); object-cover zeigt Logo + Schriftzug ohne Unterzeile. */
function AppHeaderBrand() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <img
        src={spielzeitappHeader}
        alt={APP_HEADER_ALT}
        className="h-11 w-[10.25rem] max-w-[min(50vw,10.25rem)] shrink-0 object-cover object-[50%_32%] sm:h-12 sm:w-[12rem] sm:max-w-[12rem]"
        width={192}
        height={48}
        decoding="async"
      />
      {isStagingApp() ? (
        <span
          className="shrink-0 rounded border border-amber-400/45 bg-amber-950/55 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100"
          title="Testumgebung — nicht die Live-App"
        >
          TEST
        </span>
      ) : null}
    </span>
  );
}

const ROLE_LABEL_DE: Record<string, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  head_coach: 'Cheftrainer',
  co_trainer: 'Co-Trainer',
  parent: 'Eltern',
  player: 'Spieler',
  fan: 'Fan',
};

const BACKEND_STAFF_BADGE_DE: Record<string, string> = {
  admin: 'Admin',
  head_coach: 'Cheftrainer',
  trainer: 'Trainer',
  co_trainer: 'Co-Trainer',
};

/** Öffentliche Routen: nur Logo + App-Name (Header wird dort nicht gerendert). */
function isPublicRoute(pathname: string): boolean {
  return pathname === '/' || pathname === '/schedule' || pathname === '/live';
}

/** Interner Bereich: Links mit /app-Prefix. */
const APP_PROFILE = '/app/profile';
const APP_LOGIN_REDIRECT = '/login';

export const Header: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    membershipError,
    effectiveRole,
    loading: sessionLoading,
    backendRole,
    teamSeasons,
  } = useSession();
  const { user, loading: authLoading } = useAuth();
  const publicView = isPublicRoute(pathname);
  const isRoleChoice = pathname === '/app/role-choice';
  const roleLabel =
    !isRoleChoice && effectiveRole
      ? (ROLE_LABEL_DE[effectiveRole] ?? effectiveRole)
      : null;

  const isStaff =
    !!backendRole &&
    ['admin', 'head_coach', 'trainer', 'co_trainer'].includes(backendRole.toLowerCase());

  const staffBackendBadge =
    isStaff && backendRole
      ? (BACKEND_STAFF_BADGE_DE[backendRole.toLowerCase()] ?? backendRole)
      : null;

  const [pendingRequestsCount, setPendingRequestsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isStaff) {
      setPendingRequestsCount(null);
      return;
    }

    let cancelled = false;
    async function loadPendingCount() {
      try {
        const { count, error } = await supabase
          .from('join_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (cancelled) return;
        if (error) {
          console.warn('[HEADER] join_requests pending count error', error);
          setPendingRequestsCount(null);
        } else {
          setPendingRequestsCount(typeof count === 'number' ? count : 0);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[HEADER] join_requests pending count exception', e);
          setPendingRequestsCount(null);
        }
      }
    }

    loadPendingCount();
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  return (
    <header className="app-header fixed left-0 top-0 w-full border-b border-transparent bg-[rgba(6,6,8,0.88)] pt-[env(safe-area-inset-top,0px)] shadow-[0_10px_32px_-8px_rgba(0,0,0,0.65),inset_0_-1px_0_rgba(255,30,30,0.05)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[rgba(6,6,8,0.72)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(ellipse_70%_100%_at_18%_0%,rgba(255,30,30,0.07),transparent_68%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-[2.75rem] w-full max-w-screen-2xl items-center justify-between gap-2 px-3 py-0.5 md:px-8 md:py-1">
        {/* Links: Logo + Branding (im internen Bereich klickbar → /app/home) */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          {pathname.startsWith('/app') ? (
            <Link to="/app/home" className="flex min-w-0 flex-col items-start gap-0.5">
              <AppHeaderBrand />
              {membershipError ? (
                <span className="max-w-[min(50vw,10.25rem)] truncate text-[9px] text-amber-400/95 sm:max-w-[12rem]" role="alert">
                  {membershipError}
                </span>
              ) : null}
            </Link>
          ) : (
            <>
              <AppHeaderBrand />
              <div className="min-w-0">
                <div className="text-xs text-zinc-400">
                  NSG Gölsental
                </div>
                {!publicView && membershipError && (
                  <span className="text-xs text-amber-400" role="alert">
                    {membershipError}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {!publicView && (teamSeasons?.length ?? 0) > 1 ? (
          <div className="flex shrink-0 justify-center px-1">
            <TeamSwitcher compact hideWhenSingle />
          </div>
        ) : null}

        {/* Rechts: Staff-Navigation (Anfragen), Profil + Login (kein Logout im Header) + kompakte Rollen-Badge */}
        {!publicView && (
          <div className="flex shrink-0 flex-col items-end justify-center gap-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isStaff && (
                <button
                  type="button"
                  onClick={() => navigate('/admin/join-requests')}
                  className="hidden rounded-full border border-white/14 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-colors hover:bg-white/[0.1] sm:inline-flex"
                >
                  Anfragen
                  {typeof pendingRequestsCount === 'number' && pendingRequestsCount > 0 && (
                    <span className="ml-1 rounded-full bg-red-600/85 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {pendingRequestsCount}
                    </span>
                  )}
                </button>
              )}
              {!authLoading && !user && (
                <button
                  type="button"
                  onClick={() => navigate(APP_LOGIN_REDIRECT)}
                  className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-white/[0.1]"
                >
                  Login
                </button>
              )}
              {authLoading || !user ? null : pathname.startsWith('/app') ? (
                <Link to="/app/nachrichten" className={dsGlassIconButtonClass()} aria-label="Nachrichten">
                  <Bell className="h-[1.1rem] w-[1.1rem] sm:h-[1.15rem] sm:w-[1.15rem]" strokeWidth={2} aria-hidden />
                </Link>
              ) : null}
              {authLoading || !user ? null : (
                <div className="flex flex-col items-end gap-0.5">
                  <Link
                    to={pathname.startsWith('/app') ? APP_PROFILE : '/profile'}
                    className={dsGlassIconButtonClass()}
                    aria-label="Profil"
                  >
                    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem] sm:h-[1.15rem] sm:w-[1.15rem]" stroke="currentColor" strokeWidth="1.85" fill="none" aria-hidden>
                      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                  {isStaff && staffBackendBadge ? (
                    <span className={dsTrainerPillClass()} title={staffBackendBadge}>
                      {staffBackendBadge}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            {!sessionLoading && !authLoading && !isStaff && roleLabel ? (
              <span className={dsTrainerPillClass()}>
                {roleLabel}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
};
