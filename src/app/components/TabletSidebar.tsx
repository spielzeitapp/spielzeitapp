import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, Users, Radio, Grid2x2 } from 'lucide-react';

const items = [
  { to: '/app/home', label: 'Home', icon: Home, end: true },
  { to: '/app/termine', label: 'Termine', icon: CalendarDays },
  { to: '/app/team', label: 'Team', icon: Users, end: true },
  { to: '/app/live', label: 'Live', icon: Radio },
  { to: '/app/mehr', label: 'Mehr', icon: Grid2x2 },
] as const;

export const TabletSidebar: React.FC = () => {
  return (
    <aside className="hidden lg:block lg:w-64 lg:shrink-0">
      <div className="sticky top-28 rounded-2xl border border-white/10 bg-black/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_36px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <nav className="space-y-1.5" aria-label="Tablet Navigation">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border border-red-500/35 bg-red-950/45 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]'
                      : 'border border-transparent text-white/75 hover:border-white/10 hover:bg-white/5 hover:text-white',
                  ].join(' ')
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

