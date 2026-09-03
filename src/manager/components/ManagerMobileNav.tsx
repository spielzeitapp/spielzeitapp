import React from 'react';
import { CalendarDays, MoreHorizontal } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

function activeFor(pathname: string, target: string): boolean {
  if (target === '/manager') return pathname === '/manager' || pathname === '/manager/dashboard' || pathname.startsWith('/manager/termine');
  return pathname.startsWith(target);
}

export function ManagerMobileNav(): React.ReactElement {
  const { pathname } = useLocation();
  const links = [
    { label: 'Spielplan', to: '/manager', icon: CalendarDays },
    { label: 'Mehr', to: '/manager/mehr', icon: MoreHorizontal },
  ] as const;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-1 pt-2 text-white md:hidden"
      aria-label="Mobile Manager-Navigation"
    >
      <div className="pointer-events-auto relative mx-auto grid min-h-[76px] max-w-md grid-cols-2 items-center overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#08080a]/90 px-8 py-2 shadow-[0_28px_64px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[20px]">
        <span className="pointer-events-none absolute inset-x-3 top-0 h-10 rounded-full bg-gradient-to-b from-red-500/20 to-transparent blur-xl" />
        {links.map(({ label, to, icon: Icon }) => {
        const active = activeFor(pathname, to);
        return (
          <Link
            key={label}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={[
              'relative z-10 flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium',
              active ? 'font-semibold text-white' : 'text-zinc-400',
            ].join(' ')}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
            <span>{label}</span>
            {active ? <span className="mt-0.5 h-1 w-5 rounded-sm bg-[#ff2d38] shadow-[0_0_14px_rgba(255,45,56,0.5)]" aria-hidden /> : <span className="mt-0.5 h-1 w-5" />}
          </Link>
        );
        })}
      </div>
    </nav>
  );
}
