import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CircleDot, Grid3X3, Play, Users, BarChart3 } from 'lucide-react';
import { useSession } from '../../auth/useSession';

/** Interne Tabs: /app/* (wird in InternalLayout verwendet). */
const appTabsBase = [
  { to: '/app/schedule', end: false as const, label: 'Spielplan', icon: <Grid3X3 size={24} /> },
  { to: '/app/live', end: false as const, label: 'Live', icon: <Play size={24} /> },
  { to: '/app/team', end: false as const, label: 'Team', icon: <Users size={24} /> },
  { to: '/app/table', end: false as const, label: 'Tabelle', icon: <BarChart3 size={24} /> },
];

function NavItem({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center text-xs transition-all ${
          isActive ? 'text-white' : 'text-white/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`rounded-xl p-3 transition-all ${
              isActive ? 'bg-red-600 shadow-lg' : ''
            }`}
          >
            {icon}
          </div>
          <span className="mt-1">{label}</span>
        </>
      )}
    </NavLink>
  );
}

const publicTabs = [
  { to: '/', end: true as const, label: 'Home', icon: <CircleDot size={24} /> },
  { to: '/schedule', end: false as const, label: 'Spielplan', icon: <Grid3X3 size={24} /> },
];

export const BottomTabs: React.FC = () => {
  const { pathname } = useLocation();
  const { effectiveRole } = useSession();

  const tabs = pathname.startsWith('/app')
    ? appTabsBase.map((t) =>
        t.to === '/app/schedule'
          ? {
              ...t,
              label: effectiveRole === 'fan' ? 'Spielplan' : 'Termine',
            }
          : t,
      )
    : publicTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full border-t border-white/10 bg-black/60 backdrop-blur-lg"
      aria-label="Hauptnavigation"
    >
      <div className="mx-auto flex max-w-[560px] justify-between px-6 py-3">
        {tabs.map((t) => (
          <NavItem key={t.to} to={t.to} end={t.end} label={t.label} icon={t.icon} />
        ))}
      </div>
    </nav>
  );
};
