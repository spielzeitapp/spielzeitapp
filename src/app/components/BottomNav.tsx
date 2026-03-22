import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, CircleDot, Home, Menu, Users } from 'lucide-react';

/**
 * Bottom Navigation (mobile-first, 5 Tabs) — Fußball-App-Look, Routen unverändert.
 */
const appTabs = [
  { to: '/app/home', end: true as const, label: 'Home', Icon: Home, live: false as const },
  { to: '/app/team', end: true as const, label: 'Team', Icon: Users, live: false as const },
  { to: '/app/termine', end: false as const, label: 'Termine', Icon: CalendarDays, live: false as const },
  { to: '/app/live', end: false as const, label: 'Live', Icon: CircleDot, live: true as const },
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
      className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {({ isActive }) => (
          <>
            <div
              className={[
                'relative flex h-11 w-[4.25rem] max-w-full items-center justify-center rounded-2xl transition-all duration-200',
                isActive
                  ? isLiveTab
                    ? 'bg-gradient-to-b from-red-600 to-red-700 text-white shadow-[0_4px_20px_rgba(220,38,38,0.45)] ring-2 ring-red-500/50'
                    : 'bg-red-600/25 text-red-400 shadow-inner ring-1 ring-red-500/30'
                  : 'text-zinc-500 group-hover:text-zinc-300',
              ].join(' ')}
              aria-hidden
            >
              {isLiveTab && (
                <span
                  className={
                    isActive
                      ? 'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-white shadow-sm ring-2 ring-red-600 animate-pulse'
                      : 'absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500/80 opacity-80'
                  }
                />
              )}
              <Icon
                className={[
                  'shrink-0 transition-transform duration-200',
                  isActive ? (isLiveTab ? 'h-6 w-6 scale-105' : 'h-[22px] w-[22px] text-red-400') : 'h-5 w-5',
                ].join(' ')}
                strokeWidth={isActive && !isLiveTab ? 2.25 : 2}
              />
            </div>
            <span
              className={[
                'max-w-[4.5rem] truncate text-center text-[10px] font-semibold uppercase tracking-wide',
                isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-400',
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
      className="pointer-events-none fixed bottom-0 left-0 z-50 w-full px-2 pb-0 pt-1 sm:px-4"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Hauptnavigation"
    >
      <div
        className="pointer-events-auto mx-auto flex max-w-[560px] items-stretch justify-between gap-1 rounded-t-3xl border border-white/10 bg-gradient-to-b from-zinc-900/95 to-black/95 px-1 py-2 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:gap-2 sm:px-2 sm:py-2.5"
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
