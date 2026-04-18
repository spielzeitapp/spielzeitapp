import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import {
  NavBroadcastIcon,
  NavMoreDotsIcon,
  NavSoccerBallIcon,
  NavSoccerFieldIcon,
  NavTeamGroupIcon,
  type FootballIconProps,
} from './footballIcons';

/** Akzent wie Zielbild / Welcome (#FF2D2D, weich nutzbar). */
const ACCENT = '#FF2D2D';

type TabIcon = React.FC<FootballIconProps>;

/**
 * Bottom Navigation — nur UI.
 * Reihenfolge: Home | Termine | Team | Live | Mehr
 */
const appTabs = [
  { to: '/app/home', end: true as const, label: 'Home', Icon: NavSoccerBallIcon, live: false as const },
  { to: '/app/termine', end: false as const, label: 'Termine', Icon: NavSoccerFieldIcon, live: false as const },
  { to: '/app/team', end: true as const, label: 'Team', Icon: NavTeamGroupIcon, live: false as const },
  { to: '/app/live', end: false as const, label: 'Live', Icon: NavBroadcastIcon, live: true as const },
  { to: '/app/mehr', end: false as const, label: 'Mehr', Icon: NavMoreDotsIcon, live: false as const },
] as const;

const publicTabs = [
  { to: '/', end: true as const, label: 'Home', Icon: NavSoccerBallIcon, live: false as const },
  { to: '/schedule', end: false as const, label: 'Spielplan', Icon: NavSoccerFieldIcon, live: false as const },
] as const;

function NavItem({
  to,
  end,
  label,
  Icon,
  isLiveTab,
  badgeCount,
}: {
  to: string;
  end?: boolean;
  label: string;
  Icon: TabIcon;
  isLiveTab: boolean;
  badgeCount?: number;
}) {
  const strokeInactive = 2.15;
  const strokeActive = 2.35;

  return (
    <NavLink
      to={to}
      end={end}
      className="group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-visible px-0.5 pb-1 pt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D2D]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              'relative flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-2xl transition-all duration-200 ease-out',
              isActive
                ? 'text-white shadow-[0_0_32px_-5px_rgba(255,45,45,0.48),0_0_0_1px_rgba(255,45,45,0.14)]'
                : 'text-[#777777] group-hover:bg-white/[0.03] group-hover:text-[#8a8a8a]',
            ].join(' ')}
            aria-hidden
          >
            {isActive ? (
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-[#FF2D2D]/18 to-red-950/12 opacity-95"
                aria-hidden
              />
            ) : null}
            {isLiveTab && (
              <span
                className={[
                  'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0a0a0a]',
                  isActive ? 'animate-pulse' : '',
                ].join(' ')}
                style={{ backgroundColor: ACCENT }}
              />
            )}
            {badgeCount != null && badgeCount > 0 && (
              <div
                className="pointer-events-none absolute right-0 top-0 z-[2] flex min-h-[17px] min-w-[17px] translate-x-[3px] -translate-y-[3px] items-center justify-center rounded-full px-[5px] text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[#0a0a0a]"
                style={{ backgroundColor: ACCENT }}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </div>
            )}
            <span
              className={[
                'relative z-[1] flex shrink-0 items-center justify-center transition-transform duration-200 ease-out',
                isActive ? 'scale-[1.09]' : 'scale-100',
              ].join(' ')}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? strokeActive : strokeInactive} />
            </span>
          </div>
          <span
            className={[
              'max-w-[4.5rem] text-center text-[11px] font-medium leading-none tracking-tight transition-colors duration-200 sm:text-xs sm:font-semibold',
              isActive ? 'font-semibold text-white' : 'text-[#777777] group-hover:text-[#8a8a8a]',
            ].join(' ')}
          >
            {label}
          </span>
          <span
            className={[
              'mt-0.5 h-1 w-5 shrink-0 rounded-[2px] transition-opacity duration-200',
              isActive ? 'opacity-100 shadow-[0_0_12px_rgba(255,45,45,0.35)]' : 'bg-transparent opacity-0',
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
  const { user } = useAuth();
  const unreadCount = useUnreadCount(user?.id);
  const tabs = pathname.startsWith('/app') ? appTabs : publicTabs;
  const mehrBadge = unreadCount;
  const isApp = pathname.startsWith('/app');

  return (
    <nav
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
        style={{ backgroundColor: 'rgba(10,10,10,0.85)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px]"
          style={{
            background: 'linear-gradient(180deg, rgba(255,45,45,0.14) 0%, transparent 42%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[28px] bg-gradient-to-r from-transparent via-white/14 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-3 top-0 h-9 rounded-full bg-gradient-to-b from-[#FF2D2D]/16 to-transparent blur-2xl"
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
              Icon={t.Icon}
              isLiveTab={t.live}
              badgeCount={t.to === '/app/mehr' ? mehrBadge : undefined}
            />
          ))}
        </div>
      </div>
    </nav>
  );
};

/** @deprecated Prefer BottomNav; Alias fuer bestehende Imports */
export const BottomTabs = BottomNav;
