import React from 'react';
import { CalendarDays, Home, MapPinned, Menu, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

type Props = {
  onOpenMenu: () => void;
};

function activeFor(pathname: string, target: string): boolean {
  if (target === '/manager') return pathname === '/manager' || pathname === '/manager/dashboard';
  return pathname.startsWith(target);
}

export function ManagerMobileNav({ onOpenMenu }: Props): React.ReactElement {
  const { pathname } = useLocation();
  const links = [
    { label: 'Übersicht', to: '/manager', icon: Home },
    { label: 'Termine', to: '/app/termine', icon: CalendarDays },
    { label: 'Plätze', to: '/manager/platzbelegung', icon: MapPinned },
    { label: 'Teams', to: '/manager/saisons', icon: Users },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex min-h-[72px] items-start justify-around border-t border-red-500/20 bg-gradient-to-b from-[#210b0f]/[0.98] to-[#08080a]/[0.99] px-1 pb-[env(safe-area-inset-bottom)] pt-2 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md md:hidden"
      aria-label="Mobile Manager-Navigation"
    >
      {links.map(({ label, to, icon: Icon }) => {
        const active = activeFor(pathname, to);
        return (
          <Link
            key={label}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex min-h-[52px] min-w-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium',
              active ? 'text-red-400' : 'text-white/50',
            ].join(' ')}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
            <span>{label}</span>
            {active ? <span className="h-0.5 w-5 rounded-full bg-red-500" aria-hidden /> : null}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex min-h-[52px] min-w-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium text-white/50"
      >
        <Menu className="h-5 w-5" aria-hidden />
        <span>Mehr</span>
      </button>
    </nav>
  );
}
