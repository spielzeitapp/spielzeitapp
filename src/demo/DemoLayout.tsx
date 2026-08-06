import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { DemoProvider, useDemo } from './DemoContext';
import { DemoWelcomeModal } from './components/DemoWelcomeModal';
import { DemoTour } from './components/DemoTour';
import { DemoBadge } from './components/DemoBadge';
import {
  dsPageAtmosphereAbsoluteClass,
  dsPageShellClass,
} from '../lib/premiumDesignSystem';

function navAssetBase(): string {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
}

const demoTabs = [
  { to: '/demo/home', end: true as const, label: 'Home', iconFile: 'home-ball.png' },
  { to: '/demo/termine', end: false as const, label: 'Termine', iconFile: 'pitch.svg' },
  { to: '/demo/team', end: true as const, label: 'Team', iconFile: 'team.svg' },
  { to: '/demo/live', end: false as const, label: 'Live', iconFile: 'live.svg', live: true as const },
  { to: '/demo/mehr', end: false as const, label: 'Mehr', iconFile: 'more.svg' },
] as const;

function DemoBottomNav(): React.ReactElement {
  const base = navAssetBase();
  const { live } = useDemo();
  const liveActive = live.status === 'live';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="Demo-Navigation"
    >
      <div className="mx-auto flex h-[64px] max-w-lg items-stretch justify-between px-1">
        {demoTabs.map((tab) => {
          const isLiveTab = 'live' in tab && tab.live;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-visible px-0.5 pb-1 pt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D2D]/35"
            >
              {({ isActive }) => (
                <>
                  {isLiveTab && liveActive ? (
                    <span
                      className="pointer-events-none absolute left-1/2 top-0 z-[4] whitespace-nowrap text-[7px] font-bold uppercase leading-none tracking-[0.14em] text-[#FF2D2D]"
                      style={{
                        transform: 'translate(-50%, calc(-100% - 3px))',
                        textShadow: '0 0 10px rgba(255, 0, 0, 0.72)',
                      }}
                    >
                      LIVE JETZT
                    </span>
                  ) : null}
                  <img
                    src={`${base}icons/${tab.iconFile}`}
                    alt=""
                    className={[
                      'h-6 w-6 object-contain transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-55',
                      isLiveTab && liveActive ? 'drop-shadow-[0_0_8px_rgba(255,45,45,0.85)]' : '',
                    ].join(' ')}
                    draggable={false}
                  />
                  <span
                    className={[
                      'max-w-full truncate text-[10px] font-semibold tracking-wide',
                      isActive ? 'text-white' : 'text-white/55',
                      isLiveTab && liveActive ? 'text-[#FF2D2D]' : '',
                    ].join(' ')}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function DemoShell(): React.ReactElement {
  const location = useLocation();
  const { fixtures, welcomeOpen, dismissWelcome, tourStep, skipTour, nextTourStep } = useDemo();

  useEffect(() => {
    document.title = 'SpielzeitApp Trainer-Demo';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'Teste SpielzeitApp mit einem vollständig vorbereiteten U12-Demoteam.',
    );

    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');

    return () => {
      document.title = 'Spielzeit';
    };
  }, []);

  return (
    <div className={dsPageShellClass('min-h-[100dvh] text-white')}>
      <div className={dsPageAtmosphereAbsoluteClass()} aria-hidden />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FF2D2D]/90">
              SpielzeitApp
            </p>
            <h1 className="truncate text-sm font-semibold text-white">{fixtures.teamName}</h1>
            <p className="truncate text-[11px] text-white/55">Saison {fixtures.seasonLabel}</p>
          </div>
          <DemoBadge />
        </div>
      </header>

      <main
        key={location.pathname}
        className="relative z-10 mx-auto w-full max-w-lg px-3 pb-[calc(72px+env(safe-area-inset-bottom))] pt-3 sm:px-4"
      >
        <Outlet />
      </main>

      <DemoBottomNav />
      {welcomeOpen ? (
        <DemoWelcomeModal
          onStart={() => dismissWelcome(true)}
          onLater={() => dismissWelcome(false)}
        />
      ) : null}
      {tourStep != null ? (
        <DemoTour step={tourStep} onNext={nextTourStep} onSkip={skipTour} />
      ) : null}
    </div>
  );
}

/** Öffentliche Demo-Shell inkl. Provider – kein Auth, keine Supabase-Writes. */
export function DemoLayout(): React.ReactElement {
  return (
    <DemoProvider>
      <DemoShell />
    </DemoProvider>
  );
}
