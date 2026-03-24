import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CircleDot, LayoutGrid, MoreHorizontal, Radio, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useUnreadCount } from '../../hooks/useUnreadCount';

/**
 * Bottom Navigation — nur UI; Routen bleiben unveraendert.
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
      className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 focus:outline-none"
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200',
              isActive
                ? 'bg-red-500/10 text-red-500 shadow-[0_0_18px_rgba(239,68,68,0.25)]'
                : 'text-gray-400 group-hover:bg-white/5',
            ].join(' ')}
            aria-hidden
          >
            {isLiveTab && (
              <span
                className={[
                  'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-neutral-900',
                  isActive ? 'animate-pulse' : '',
                ].join(' ')}
              />
            )}
            {badgeCount != null && badgeCount > 0 && (
              <div className="absolute -right-1 -top-1 z-[1] flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-none text-white">
                {badgeCount > 9 ? '9+' : badgeCount}
              </div>
            )}
            <Icon
              className={[
                'shrink-0 transition-all duration-200',
                isActive ? 'h-6 w-6 scale-110' : 'h-5.5 w-5.5',
              ].join(' ')}
              strokeWidth={isActive ? 2.4 : isLiveTab ? 2.25 : 2.1}
            />
          </div>
          <span
            className={[
              'text-center text-xs font-semibold leading-none transition-colors',
              isActive ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-300',
            ].join(' ')}
          >
            {label}
          </span>
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

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 z-50 w-full px-3 pt-2 sm:px-5"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Hauptnavigation"
    >
      <div
        className="pointer-events-auto mx-auto max-w-md h-20 rounded-t-2xl bg-neutral-900/80 backdrop-blur-lg shadow-lg"
      >
        <div className="grid h-full grid-cols-5 items-center px-3 py-2">
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
