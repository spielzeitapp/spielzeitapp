import React from 'react';
import { BookOpen, Building2, Dumbbell, Home, MapPinned, MoreHorizontal, CalendarDays, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useManagerWorkMode } from '../ManagerWorkModeContext';

function activeFor(pathname: string, target: string): boolean {
  if (target === '/manager') return pathname === '/manager' || pathname === '/manager/dashboard';
  return pathname.startsWith(target);
}

export function ManagerMobileNav(): React.ReactElement {
  const { pathname } = useLocation();
  const { workMode, supportSession } = useManagerWorkMode();
  const platformGlobal = workMode === 'platform_admin' && !supportSession;
  const links = platformGlobal ? [
    { label: 'Plattform', to: '/manager/plattform', icon: Home },
    { label: 'Vereine', to: '/manager/vereine', icon: Building2 },
    { label: 'Mehr', to: '/manager/mehr', icon: MoreHorizontal },
  ] : workMode === 'trainer' ? [
    { label: 'Planung', to: '/manager/training/einheiten', icon: Dumbbell },
    { label: 'Übungen', to: '/manager/training/bibliothek', icon: BookOpen },
    { label: 'Plätze', to: '/manager/platzbelegung', icon: MapPinned },
    { label: 'Mehr', to: '/manager/mehr', icon: MoreHorizontal },
  ] : [
    { label: 'Home', to: '/manager', icon: Home },
    { label: 'Termine', to: '/manager/termine', icon: CalendarDays },
    { label: 'Teams', to: '/manager/teams', icon: Users },
    { label: 'Mehr', to: '/manager/mehr', icon: MoreHorizontal },
  ] as const;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-1 pt-2 text-white md:hidden"
      style={{ paddingBottom: 'max(0.125rem, calc(env(safe-area-inset-bottom, 0px) - 1.5rem))' }}
      aria-label="Mobile Manager-Navigation"
    >
      <div className={`pointer-events-auto relative mx-auto grid min-h-[76px] w-full max-w-md ${platformGlobal ? 'grid-cols-3' : 'grid-cols-4'} items-center overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#08080a]/[0.88] px-2 py-2 shadow-[0_28px_64px_-12px_rgba(0,0,0,0.88),0_12px_32px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.65)] backdrop-blur-[20px] backdrop-saturate-150`}>
        <span className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-b from-[rgb(var(--club-accent-rgb,220_38_38)/0.12)] via-[rgb(var(--club-accent-rgb,220_38_38)/0.04)] to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-x-3 top-0 h-10 rounded-full bg-[rgb(var(--club-accent-rgb,220_38_38)/0.12)] blur-xl" aria-hidden />
        {links.map(({ label, to, icon: Icon }) => {
        const active = activeFor(pathname, to) || (
          workMode === 'trainer' && label === 'Mehr' &&
          (pathname.startsWith('/manager/training/vorlagen') || pathname.startsWith('/manager/training/chronik'))
        );
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
            {active ? <span className="mt-0.5 h-1 w-5 rounded-sm bg-[rgb(var(--club-accent-rgb,220_38_38))] shadow-[0_0_14px_rgb(var(--club-accent-rgb,220_38_38)/0.5)]" aria-hidden /> : <span className="mt-0.5 h-1 w-5" />}
          </Link>
        );
        })}
      </div>
    </nav>
  );
}
