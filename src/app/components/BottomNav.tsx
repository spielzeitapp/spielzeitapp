import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CircleDot, LayoutGrid, MoreHorizontal, Radio, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useUnreadCount } from '../../hooks/useUnreadCount';

/**
 * Bottom Navigation — nur UI; Routen und Reihenfolge bleiben unveraendert.
 */
const appTabs = [
  { to: '/app/home', end: true as const, label: 'Home', Icon: CircleDot, live: false as const },
  { to: '/app/team', end: true as const, label: 'Team', Icon: Users, live: false as const },
  { to: '/app/termine', end: false as const, label: 'Termine', Icon: LayoutGrid, live: false as const },
  { to: '/app/live', end: false as const, label: 'Live', Icon: Radio, live: true as const },
  { to: '/app/mehr', end: false as const, label: 'Mehr', Icon: MoreHorizontal, live: false as const },
] as const;

const publicTabs = [
  { to: '/', end: true as const, label: 'Home', Icon: CircleDot, live: false as const },
  { to: '/schedule', end: false as const, label: 'Spielplan', Icon: LayoutGrid, live: false as const },
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
  Icon: LucideIcon;
  isLiveTab: boolean;
  badgeCount?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className="group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-visible px-0.5 pb-1 pt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              'relative flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-2xl transition-all duration-200 ease-out',
              isActive
                ? 'text-white shadow-[0_0_22px_-2px_rgba(220,38,38,0.45),0_0_0_1px_rgba(248,113,113,0.12)]'
                : 'text-[#777777] group-hover:bg-white/[0.04] group-hover:text-zinc-400',
            ].join(' ')}
            aria-hidden
          >
            {isActive ? (
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-red-500/18 to-red-950/10 opacity-90"
                aria-hidden
              />
            ) : null}
            {isLiveTab && (
              <span
                className={[
                  'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#0a0a0a]',
                  isActive ? 'animate-pulse' : '',
                ].join(' ')}
              />
            )}
            {badgeCount != null && badgeCount > 0 && (
              <div className="pointer-events-none absolute right-0 top-0 z-[2] flex min-h-[17px] min-w-[17px] translate-x-[3px] -translate-y-[3px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[#0a0a0a]">
                {badgeCount > 99 ? '99+' : badgeCount}
              </div>
            )}
            <Icon
              className={[
                'relative z-[1] shrink-0 transition-all duration-200 ease-out',
                isActive ? 'h-[1.65rem] w-[1.65rem]' : 'h-6 w-6',
              ].join(' ')}
              strokeWidth={isActive ? 2.35 : isLiveTab ? 2.15 : 2.05}
            />
          </div>
          <span
            className={[
              'text-center text-[11px] font-medium leading-none tracking-tight transition-colors duration-200',
              isActive ? 'text-white' : 'text-[#777777] group-hover:text-zinc-400',
            ].join(' ')}
          >
            {label}
          </span>
          <span
            className={[
              'mt-0.5 h-1 w-5 shrink-0 rounded-full transition-opacity duration-200',
              isActive ? 'bg-red-500 opacity-100 shadow-[0_0_10px_rgba(239,68,68,0.35)]' : 'bg-transparent opacity-0',
            ].join(' ')}
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
      className="pointer-events-none fixed bottom-0 left-0 z-50 w-full px-3 pt-2 sm:px-5"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Hauptnavigation"
    >
      <div
        className={[
          'pointer-events-auto relative mx-auto max-w-md overflow-visible rounded-[1.75rem] border border-white/[0.06]',
          'bg-[rgba(10,10,10,0.88)] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(0,0,0,0.65)]',
          'backdrop-blur-[20px] backdrop-saturate-150',
          isApp ? 'min-h-[76px]' : 'min-h-[68px]',
        ].join(' ')}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[1.75rem] bg-gradient-to-r from-transparent via-red-500/25 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-3 top-0 h-8 rounded-full bg-gradient-to-b from-red-500/12 to-transparent blur-xl"
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
