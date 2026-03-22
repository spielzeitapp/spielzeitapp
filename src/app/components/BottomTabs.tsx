import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Users, CalendarDays, Radio, MoreHorizontal } from 'lucide-react';

/** Interne MVP-Navigation: genau 5 Tabs (mobile-first). */
const appTabs = [
  { to: '/app/home', end: true as const, label: 'Home', icon: Home },
  { to: '/app/team', end: true as const, label: 'Team', icon: Users },
  { to: '/app/termine', end: false as const, label: 'Termine', icon: CalendarDays },
  { to: '/app/live', end: false as const, label: 'Live', icon: Radio },
  { to: '/app/mehr', end: false as const, label: 'Mehr', icon: MoreHorizontal },
] as const;

const publicTabs = [
  { to: '/', end: true as const, label: 'Home', icon: Home },
  { to: '/schedule', end: false as const, label: 'Spielplan', icon: CalendarDays },
];

function NavItem({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
            <Icon size={24} strokeWidth={2} />
          </div>
          <span className="mt-1 max-w-[4.5rem] truncate text-center">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export const BottomTabs: React.FC = () => {
  const { pathname } = useLocation();
  const tabs = pathname.startsWith('/app') ? appTabs : publicTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full border-t border-white/10 bg-black/60 backdrop-blur-lg"
      aria-label="Hauptnavigation"
    >
      <div className="mx-auto flex max-w-[560px] justify-between px-2 py-2 sm:px-4 sm:py-3">
        {tabs.map((t) => (
          <NavItem key={t.to} to={t.to} end={t.end} label={t.label} icon={t.icon} />
        ))}
      </div>
    </nav>
  );
};
