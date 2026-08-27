import React from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { useSession } from '../../auth/useSession';
import { normalizeRole } from '../../lib/roles';
import { useAppHasLiveMatch, useAppLiveMatchState } from '../../hooks/useAppHasLiveMatch';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import { useDemoMode } from '../../demo/DemoContext';

/** Akzent wie Zielbild / Welcome (#FF2D2D, weich nutzbar). */
const ACCENT = '#FF2D2D';
/** Gleicher Name wie in LiveMatchScreen — kein Import aus der Page (Bundle). */
const LIVE_NAV_RESET_EVENT = 'spielzeit:live-nav-reset';

function navAssetBase(): string {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
}

/**
 * Bottom Navigation — nur UI.
 * Reihenfolge: Home | Termine | Team | Live | Mehr
 */
const appTabs = [
  { to: '/app/home', end: true as const, label: 'Home', iconFile: 'home-ball.png', live: false as const },
  { to: '/app/termine', end: false as const, label: 'Termine', iconFile: 'pitch.svg', live: false as const },
  { to: '/app/team', end: true as const, label: 'Team', iconFile: 'team.svg', live: false as const },
  { to: '/app/live', end: false as const, label: 'Live', iconFile: 'live.svg', live: true as const },
  { to: '/app/mehr', end: false as const, label: 'Mehr', iconFile: 'more.svg', live: false as const },
] as const;

const demoTabs = [
  { to: '/demo/home', end: true as const, label: 'Home', iconFile: 'home-ball.png', live: false as const },
  { to: '/demo/termine', end: false as const, label: 'Termine', iconFile: 'pitch.svg', live: false as const },
  { to: '/demo/team', end: true as const, label: 'Team', iconFile: 'team.svg', live: false as const },
  { to: '/demo/live', end: false as const, label: 'Live', iconFile: 'live.svg', live: true as const },
  { to: '/demo/mehr', end: false as const, label: 'Mehr', iconFile: 'more.svg', live: false as const },
] as const;

const publicTabs = [
  { to: '/', end: true as const, label: 'Home', iconFile: 'home-ball.png', live: false as const },
  { to: '/schedule', end: false as const, label: 'Spielplan', iconFile: 'pitch.svg', live: false as const },
] as const;

function NavItem({
  to,
  end,
  label,
  iconFile,
  isLiveTab,
  liveMatchActive,
  badgeCount,
  onReclick,
}: {
  to: string;
  end?: boolean;
  label: string;
  iconFile: string;
  isLiveTab: boolean;
  /** Nur true bei Tab „Live“ UND DB-Status `live` (kein Puls/Label bei beendetem Spiel). */
  liveMatchActive?: boolean;
  badgeCount?: number;
  onReclick?: () => void;
}) {
  const base = navAssetBase();
  const { pathname } = useLocation();
  const isHomeBall = iconFile === 'home-ball.png';
  const showLiveIndicators = Boolean(isLiveTab && liveMatchActive);
  const isOnTargetRoute = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <NavLink
      to={to}
      end={end}
      onClick={(e) => {
        if (onReclick && isOnTargetRoute) {
          e.preventDefault();
          onReclick();
        }
      }}
      className="group relative flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 overflow-visible px-0.5 pb-1 pt-0.5 transition-transform duration-75 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D2D]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {({ isActive }) => (
        <>
          <div
            className={['tab', 'flex', 'min-w-0', 'flex-col', 'items-center', 'gap-1', isHomeBall ? 'home' : '', isActive ? 'active' : '']
              .filter(Boolean)
              .join(' ')}
          >
            {badgeCount != null && badgeCount > 0 ? (
              <div
                className="pointer-events-none absolute right-0 top-0 z-[3] flex min-h-[17px] min-w-[17px] translate-x-[3px] -translate-y-[3px] items-center justify-center rounded-full px-[5px] text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[#0a0a0a]"
                style={{ backgroundColor: ACCENT }}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </div>
            ) : null}
            {showLiveIndicators ? (
              <span
                className="pointer-events-none absolute left-1/2 top-0 z-[4] whitespace-nowrap text-[7px] font-bold uppercase leading-none tracking-[0.14em] text-[#FF2D2D] sm:text-[8px]"
                style={{
                  transform: 'translate(-50%, calc(-100% - 3px))',
                  textShadow: '0 0 10px rgba(255, 0, 0, 0.72)',
                }}
              >
                LIVE JETZT
              </span>
            ) : null}
            <img
              src={`${base}icons/${iconFile}`}
              className="nav-icon"
              alt=""
              decoding="async"
              draggable={false}
            />
            <span
              className={[
                'max-w-[4.5rem] text-center text-[11px] font-medium leading-none tracking-tight transition-colors duration-200 sm:text-xs sm:font-semibold',
                isActive ? 'font-semibold text-white' : 'text-zinc-400 group-hover:text-zinc-300',
              ].join(' ')}
            >
              {label}
            </span>
            {showLiveIndicators ? <div className="live-dot live-dot--pulse" aria-hidden /> : null}
          </div>
          <span
            className={[
              'mt-1 h-1 w-5 shrink-0 rounded-[2px] transition-opacity duration-200',
              isActive ? 'opacity-100 shadow-[0_0_14px_rgba(255,45,45,0.42)]' : 'bg-transparent opacity-0',
            ].join(' ')}
            style={isActive ? { backgroundColor: ACCENT, height: '4px', width: '20px' } : undefined}
            aria-hidden
          />
        </>
      )}
    </NavLink>
  );
}

export const BottomNav: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { effectiveRole } = useSession();
  const demo = useDemoMode();
  const unreadCount = useUnreadCount(user?.id);
  const termineNavLabel = normalizeRole(effectiveRole) === 'fan' ? 'Spielplan' : 'Termine';
  const isDemo = Boolean(demo) || pathname.startsWith('/demo');
  const appTabsResolved =
    termineNavLabel === 'Termine'
      ? appTabs
      : appTabs.map((t) => (t.to === '/app/termine' ? { ...t, label: termineNavLabel } : t));
  const tabs = isDemo
    ? demoTabs
    : pathname.startsWith('/app')
      ? appTabsResolved
      : publicTabs;
  const mehrBadge = isDemo ? undefined : unreadCount;
  const isApp = pathname.startsWith('/app') || isDemo;
  /** Echtes laufendes Spiel: eine Zeile mit status === 'live' (beendet → kein Eintrag, Indikatoren aus). */
  const hasLiveMatch = useAppHasLiveMatch();
  const { liveMatchId } = useAppLiveMatchState();
  /** Demo: Puls nur wenn die lokale Live-Runtime tatsächlich läuft (DEMO.2F). */
  const demoLiveActive = demo?.liveRuntimeStatus === 'live';
  const liveActiveForNav = isDemo ? Boolean(demoLiveActive) : hasLiveMatch;

  const handleLiveTabReclick = () => {
    if (isDemo) {
      window.dispatchEvent(new CustomEvent(LIVE_NAV_RESET_EVENT));
      navigate('/demo/live');
      return;
    }
    window.dispatchEvent(new CustomEvent(LIVE_NAV_RESET_EVENT));
    const fromUrl = searchParams.get('matchId')?.trim() || '';
    const matchId = liveMatchId || fromUrl;
    navigate(matchId ? `/app/live?matchId=${encodeURIComponent(matchId)}` : '/app/live');
  };

  return (
    <nav
      data-app-bottom-nav
      className="pointer-events-none fixed bottom-0 left-0 z-50 w-full px-3 pb-1 pt-2 sm:px-5"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Hauptnavigation"
    >
      <div
        className={[
          'pointer-events-auto relative mx-auto max-w-md overflow-visible rounded-[28px] border border-white/[0.06]',
          'shadow-[0_28px_64px_-12px_rgba(0,0,0,0.88),0_12px_32px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.65)]',
          'backdrop-blur-[20px] backdrop-saturate-150',
          isApp ? 'min-h-[76px]' : 'min-h-[68px]',
        ].join(' ')}
        style={{ backgroundColor: 'rgba(8,8,10,0.88)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,45,45,0.12) 0%, rgba(255,30,30,0.04) 28%, transparent 48%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[28px] bg-gradient-to-r from-transparent via-white/14 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-3 top-0 h-10 rounded-full bg-gradient-to-b from-[#FF2D2D]/18 to-transparent blur-xl"
          aria-hidden
        />
        <div
          className={[
            'relative grid h-full min-h-[inherit] items-center overflow-visible px-1.5 py-2 sm:px-2',
            isApp ? 'grid-cols-5' : 'grid-cols-2',
          ].join(' ')}
        >
          {tabs.map((t) => (
            <NavItem
              key={t.to}
              to={t.to}
              end={t.end}
              label={t.label}
              iconFile={t.iconFile}
              isLiveTab={t.live}
              liveMatchActive={t.live ? liveActiveForNav : false}
              badgeCount={t.to === '/app/mehr' || t.to === '/demo/mehr' ? mehrBadge : undefined}
              onReclick={t.live ? handleLiveTabReclick : undefined}
            />
          ))}
        </div>
      </div>
    </nav>
  );
};

/** @deprecated Prefer BottomNav; Alias fuer bestehende Imports */
export const BottomTabs = BottomNav;
