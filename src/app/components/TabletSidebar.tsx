import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Users, Radio, Grid2x2 } from 'lucide-react';
import { useSession } from '../../auth/useSession';
import { normalizeRole } from '../../lib/roles';
import { useDemoMode } from '../../demo/DemoContext';

const appItems = [
  { to: '/app/home', label: 'Home', icon: Home, end: true },
  { to: '/app/termine', label: 'Termine', icon: CalendarDays },
  { to: '/app/team', label: 'Team', icon: Users, end: true },
  { to: '/app/live', label: 'Live', icon: Radio },
  { to: '/app/mehr', label: 'Mehr', icon: Grid2x2 },
] as const;

const demoItems = [
  { to: '/demo/home', label: 'Home', icon: Home, end: true },
  { to: '/demo/termine', label: 'Termine', icon: CalendarDays },
  { to: '/demo/team', label: 'Team', icon: Users, end: true },
  { to: '/demo/live', label: 'Live', icon: Radio },
  { to: '/demo/mehr', label: 'Mehr', icon: Grid2x2 },
] as const;

export const TabletSidebar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { pathname } = useLocation();
  const demo = useDemoMode();
  const isDemo = Boolean(demo) || pathname.startsWith('/demo');
  const { effectiveRole } = useSession();
  const termineLabel = normalizeRole(effectiveRole) === 'fan' ? 'Spielplan' : 'Termine';
  const baseItems = isDemo ? demoItems : appItems;
  const navItems = useMemo(
    () =>
      baseItems.map((item) =>
        item.to.endsWith('/termine') ? { ...item, label: isDemo ? 'Termine' : termineLabel } : item,
      ),
    [baseItems, termineLabel, isDemo],
  );
  return (
    <aside className={`hidden lg:block lg:shrink-0 ${compact ? 'lg:w-20' : 'lg:w-64'}`}>
      <div className="sticky top-28 rounded-2xl border border-white/10 bg-black/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_36px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <nav className="space-y-1.5" aria-label="Tablet Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    `flex items-center ${compact ? 'justify-center gap-0 px-2' : 'gap-3 px-3'} rounded-xl py-2.5 text-sm font-medium transition-colors`,
                    isActive
                      ? 'border border-red-500/35 bg-red-950/45 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]'
                      : 'border border-transparent text-white/75 hover:border-white/10 hover:bg-white/5 hover:text-white',
                  ].join(' ')
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                {compact ? null : <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
