import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Radio, Home, Menu, Users } from 'lucide-react';

/**
 * Bottom Navigation — nur UI; Routen: /app/home, /app/team, /app/termine, /app/live, /app/mehr
 */
const appTabs = [
  { to: '/app/home', end: true as const, label: 'Home', Icon: Home, live: false as const },
  { to: '/app/team', end: true as const, label: 'Team', Icon: Users, live: false as const },
  { to: '/app/termine', end: false as const, label: 'Termine', Icon: CalendarDays, live: false as const },
  { to: '/app/live', end: false as const, label: 'Live', Icon: Radio, live: true as const },
  { to: '/app/mehr', end: false as const, label: 'Mehr', Icon: Menu, live: false as const },
] as const;

const publicTabs = [
  { to: '/', end: true as const, label: 'Home', Icon: Home, live: false as const },
  { to: '/schedule', end: false as const, label: 'Spielplan', Icon: CalendarDays, live: false as const },
] as const;

function NavItem({
  to,
  end,
  label,
  Icon,
  isLiveTab,
}: {
  to: string;
  end?: boolean;
  label: string;
  Icon: LucideIcon;
  isLiveTab: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              'relative flex min-h-[48px] w-full max-w-[4.5rem] items-center justify-center rounded-2xl transition-all duration-200 ease-out',
              isActive
                ? isLiveTab
                  ? 'bg-gradient-to-b from-red-600 to-red-800 text-white shadow-[0_6px_24px_rgba(220,38,38,0.4)] ring-2 ring-red-400/40'
                  : 'bg-red-600/30 text-red-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-red-500/40'
                : isLiveTab
                  ? 'text-red-400/90 ring-1 ring-red-600/25 bg-red-950/40'
                  : 'text-zinc-500 group-hover:bg-white/5 group-hover:text-zinc-300',
            ].join(' ')}
            aria-hidden
          >
            {isLiveTab && (
              <span
                className={
                  isActive
                    ? 'absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white shadow-sm ring-2 ring-red-700 animate-pulse'
                    : 'absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                }
              />
            )}
            <Icon
              className={[
                'shrink-0 transition-transform duration-200',
                isActive
                  ? isLiveTab
                    ? 'h-6 w-6'
                    : 'h-[22px] w-[22px]'
                  : isLiveTab
                    ? 'h-[22px] w-[22px]'
                    : 'h-5 w-5',
              ].join(' ')}
              strokeWidth={isActive && !isLiveTab ? 2.35 : isLiveTab && !isActive ? 2.25 : 2}
            />
          </div>
          <span
            className={[
              'max-w-[4.75rem] truncate px-0.5 text-center text-[10px] font-bold uppercase tracking-[0.06em]',
              isActive ? 'text-white' : isLiveTab ? 'text-red-400/80' : 'text-zinc-500 group-hover:text-zinc-400',
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
  const tabs = pathname.startsWith('/app') ? appTabs : publicTabs;

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 z-50 w-full px-3 pb-0 pt-2 sm:px-5"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Hauptnavigation"
    >
      <div
        className="pointer-events-auto mx-auto flex max-w-[560px] items-end justify-between gap-0.5 rounded-2xl border border-white/[0.08] bg-zinc-950/92 px-1.5 py-2.5 shadow-[0_-4px_24px_rgba(0,0,0,0.45),0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:gap-1 sm:px-2.5 sm:py-3"
      >
        {tabs.map((t) => (
          <NavItem
            key={t.to}
            to={t.to}
            end={t.end}
            label={t.label}
            Icon={t.Icon}
            isLiveTab={t.live}
          />
        ))}
      </div>
    </nav>
  );
};

/** @deprecated Prefer BottomNav; Alias für bestehende Imports */
export const BottomTabs = BottomNav;
