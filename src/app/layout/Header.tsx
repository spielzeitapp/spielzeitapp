import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useSession } from '../../auth/useSession';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabaseClient';
import { getClubLogo } from '../../lib/teamLogos';

const logo = import.meta.env.BASE_URL + 'logos/nsg-goelsental.png';

const iconBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md transition-colors hover:border-white/28 hover:bg-white/[0.11] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:h-10 sm:w-10';

function AppWordmark({ compact }: { compact?: boolean }) {
  const sz = compact
    ? 'text-[clamp(0.95rem,4.2vw,1.2rem)]'
    : 'text-[clamp(1.05rem,4.5vw,1.35rem)]';
  return (
    <h1
      className={`font-black italic leading-[1.02] tracking-tight ${sz}`}
      style={{ transform: 'skewX(-3deg)' }}
    >
      <span
        className="text-[#fafafa]"
        style={{
          textShadow: '0 1px 0 rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.5)',
        }}
      >
        Spielzeit
      </span>
      <span
        className="text-[#f87171]"
        style={{
          textShadow: '0 1px 0 rgba(0,0,0,0.45), 0 2px 12px rgba(0,0,0,0.55), 0 0 14px rgba(220,38,38,0.2)',
        }}
      >
        App
      </span>
    </h1>
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
    selectedTeamSeason,
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

  const teamLineApp = useMemo(() => {
    const tn = (selectedTeamSeason?.team?.name ?? '').trim();
    const sn = (selectedTeamSeason?.season?.name ?? '').trim();
    if (tn && sn) return `${tn} · ${sn}`;
    if (tn) return tn;
    return '';
  }, [selectedTeamSeason?.team?.name, selectedTeamSeason?.season?.name]);

  const teamSubline =
    pathname.startsWith('/app') && teamLineApp.length > 0 ? teamLineApp : 'NSG Gölsental';

  const headerTeamLogo = useMemo(() => {
    const tn = (selectedTeamSeason?.team?.name ?? '').trim();
    if (pathname.startsWith('/app') && tn) return getClubLogo(tn);
    return logo;
  }, [pathname, selectedTeamSeason?.team?.name]);

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
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/[0.07] bg-gradient-to-b from-zinc-950/[0.97] via-black/[0.9] to-black/[0.82] pt-[env(safe-area-inset-top,0px)] shadow-[0_10px_36px_-10px_rgba(0,0,0,0.72),inset_0_-1px_0_rgba(220,38,38,0.06)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex min-h-[3.25rem] w-full max-w-screen-2xl items-center justify-between gap-2 px-3 py-1.5 md:px-8 md:py-2">
        {/* Links: Logo + Branding (im internen Bereich klickbar → /app/home) */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          {pathname.startsWith('/app') ? (
            <Link to="/app/home" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
              <img
                src={headerTeamLogo}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-contain ring-2 ring-white/12 ring-offset-2 ring-offset-zinc-950/80 sm:h-10 sm:w-10"
                width={40}
                height={40}
              />
              <div className="min-w-0 pr-1">
                <AppWordmark compact />
                <div className="mt-0.5 truncate text-[9px] font-medium leading-tight text-white/50 sm:text-[10px]">
                  {teamSubline}
                </div>
                {membershipError ? (
                  <span className="mt-0.5 block truncate text-[9px] text-amber-400/95" role="alert">
                    {membershipError}
                  </span>
                ) : null}
              </div>
            </Link>
          ) : (
            <>
              <img
                src={logo}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                width={36}
                height={36}
              />
              <div className="min-w-0">
                <AppWordmark />
                <div className="text-xs text-white/60">
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

        {/* Rechts: Staff-Navigation (Anfragen), Profil + Login (kein Logout im Header) + kompakte Rollen-Badge */}
        {!publicView && (
          <div className="flex shrink-0 flex-col items-end justify-center gap-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isStaff && (
                <button
                  type="button"
                  onClick={() => navigate('/admin/join-requests')}
                  className="hidden rounded-full border border-white/14 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition-colors hover:bg-white/[0.1] sm:inline-flex"
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
                  className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:bg-white/[0.1]"
                >
                  Login
                </button>
              )}
              {authLoading || !user ? null : pathname.startsWith('/app') ? (
                <Link to="/app/nachrichten" className={iconBtnClass} aria-label="Nachrichten">
                  <Bell className="h-[1.05rem] w-[1.05rem] sm:h-[1.15rem] sm:w-[1.15rem]" strokeWidth={2} aria-hidden />
                </Link>
              ) : null}
              {authLoading || !user ? null : (
                <Link
                  to={pathname.startsWith('/app') ? APP_PROFILE : '/profile'}
                  className={iconBtnClass}
                  aria-label="Profil"
                >
                  <svg viewBox="0 0 24 24" className="h-[1.05rem] w-[1.05rem] sm:h-5 sm:w-5" stroke="currentColor" strokeWidth="1.85" fill="none" aria-hidden>
                    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
              {authLoading || !user || !isStaff || !staffBackendBadge ? null : (
                <span
                  className="max-w-[4.5rem] truncate rounded-full border border-red-500/25 bg-red-950/30 px-1.5 py-0.5 text-[7px] font-semibold uppercase leading-none tracking-wider text-red-200/88 sm:max-w-[5.5rem] sm:px-2 sm:text-[8px]"
                  title={staffBackendBadge}
                >
                  {staffBackendBadge}
                </span>
              )}
            </div>
            {!sessionLoading && !authLoading && !isStaff && roleLabel ? (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-white/55 sm:text-[9px]">
                {roleLabel}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
};
