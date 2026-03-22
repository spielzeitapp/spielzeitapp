import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

/**
 * MVP Bottom Navigation (mobile-first, 5 Tabs).
 * Canonical routes: /app/home, /app/team, /app/termine, /app/live, /app/mehr
 * Short URLs (/home, /team, …, /more) werden in App.tsx nach /app/… umgeleitet.
 */
const appTabs = [
  { to: '/app/home', end: true as const, label: 'Home', emoji: '🏠' },
  { to: '/app/team', end: true as const, label: 'Team', emoji: '👥' },
  { to: '/app/termine', end: false as const, label: 'Termine', emoji: '📅' },
  { to: '/app/live', end: false as const, label: 'Live', emoji: '🔴' },
  { to: '/app/mehr', end: false as const, label: 'Mehr', emoji: '⚙️' },
] as const;

const publicTabs = [
  { to: '/', end: true as const, label: 'Home', emoji: '🏠' },
  { to: '/schedule', end: false as const, label: 'Spielplan', emoji: '📅' },
];

function NavItem({
  to,
  end,
  emoji,
  label,
}: {
  to: string;
  end?: boolean;
  emoji: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-0 flex-1 flex-col items-center text-xs transition-all ${
          isActive ? 'text-white' : 'text-white/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl leading-none transition-all ${
              isActive ? 'bg-red-600 shadow-lg' : ''
            }`}
            aria-hidden
          >
            {emoji}
          </div>
          <span className="mt-1 max-w-[4.5rem] truncate text-center">{label}</span>
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
      className="fixed bottom-0 left-0 z-50 w-full border-t border-white/10 bg-black/60 backdrop-blur-lg"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Hauptnavigation"
    >
      <div className="mx-auto flex max-w-[560px] justify-between gap-0.5 px-1 py-2 sm:gap-1 sm:px-3 sm:py-3">
        {tabs.map((t) => (
          <NavItem key={t.to} to={t.to} end={t.end} label={t.label} emoji={t.emoji} />
        ))}
      </div>
    </nav>
  );
};

/** @deprecated Prefer BottomNav; Alias für bestehende Imports */
export const BottomTabs = BottomNav;
