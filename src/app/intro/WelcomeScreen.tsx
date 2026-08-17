import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Compass, PlayCircle, Smartphone, Trophy } from 'lucide-react';
import { useAppHasLiveMatch } from '../../hooks/useAppHasLiveMatch';
import { markIntroFlowCompleted } from './introFlowSession';
import {
  readPendingParentEmailInviteFlag,
  resolvePendingParentInvitePath,
} from '../../lib/parentLinkInvites';
import { DEMO_TOUR_WHAT_PATH, DEMO_TOUR_WELCOME_BENEFIT, DEMO_TOUR_WELCOME_HEADLINE, DEMO_TOUR_WELCOME_PRIMARY, DEMO_TOUR_WELCOME_PROBLEM } from '../../demo/demoTourConfig';
import { isStandaloneDisplayMode } from '../../lib/pwaDisplayMode';
import welcomeHeroBg from '../../assets/branding/spielzeitapp-welcome-bg-neu.jpg';
import spielzeitappIcon from '../../assets/branding/spielzeitapp-icon.png';

/** Primär „Zur App“: gleiche Route wie BottomNav „Home“ (`AppHomePage`). */
const ROUTE_APP_HOME = '/app/home';

/** Liveticker: gleiche Route wie BottomNav „Live“ (`LiveMatchScreen`). */
const ROUTE_LIVE_TICKER = '/app/live';

/** Öffentliche Trainer-Demo — kein Login, gemeinsame App-Oberfläche. */
const ROUTE_DEMO_HOME = '/demo/home';
const ROUTE_DEMO_WELCOME = '/demo/intro/welcome';

function appIconBase(): string {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
}

function PremiumIntroButton({
  pulseGlow,
  liveActive,
  children,
  onClick,
}: {
  /** Liveticker: dezentes Pulsieren des roten Glows */
  pulseGlow?: boolean;
  /** Liveticker: verstärkter Live-Zustand (Glow, Border, Verlauf) */
  liveActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'welcome-intro-cta group relative z-20 flex w-full min-h-[44px] touch-manipulation items-center gap-2.5 overflow-hidden rounded-xl px-4 py-2 text-left',
        liveActive ? 'welcome-intro-cta--live' : '',
        pulseGlow ? 'welcome-intro-cta--pulse' : '',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

export const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDemoWelcome =
    location.pathname.startsWith('/demo') || location.pathname === ROUTE_DEMO_WELCOME;
  const iconBase = appIconBase();
  /** Gemeinsamer Einstieg: gleiche Live-Anzeige wie Produktion (nur Lesen). */
  const hasLiveMatch = useAppHasLiveMatch({ fetchOutsideApp: !isDemoWelcome });
  const standaloneApp = isStandaloneDisplayMode();

  /** „Zur App“ — Pending Invite hat Vorrang vor Home. */
  const goHome = () => {
    markIntroFlowCompleted();
    const pending = resolvePendingParentInvitePath();
    if (pending) {
      window.location.replace(pending);
      return;
    }
    if (readPendingParentEmailInviteFlag()) {
      window.location.replace('/app/parent-invite');
      return;
    }
    navigate(ROUTE_APP_HOME, { replace: true });
  };

  const goLive = () => {
    markIntroFlowCompleted();
    navigate(ROUTE_LIVE_TICKER, { replace: true });
  };

  /** Demo frei erkunden — ohne Rundgang. */
  const goDemoExplore = () => {
    navigate(ROUTE_DEMO_HOME, { replace: true });
  };

  /** Geführte Demo — WHY → WHAT, dann HOW-Tour. */
  const goDemoGuided = () => {
    navigate(DEMO_TOUR_WHAT_PATH, { replace: true });
  };

  return (
    <div className="welcome-screen fixed inset-0 z-[90] flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-black text-white [-webkit-overflow-scrolling:touch]">
      <style>{`
        .welcome-intro-cta {
          background: linear-gradient(180deg, rgba(42, 0, 0, 0.78) 0%, rgba(18, 0, 0, 0.84) 100%);
          border: 1px solid rgba(255, 0, 0, 0.25);
          box-shadow:
            0 0 32px rgba(255, 0, 0, 0.34),
            0 1px 0 rgba(255, 255, 255, 0.05),
            inset 0 0 16px rgba(255, 0, 0, 0.1);
          transition: transform 120ms ease-out, filter 120ms ease-out, box-shadow 0.2s ease;
          transform: translateY(0) scale(1);
          filter: brightness(1);
        }
        @media (hover: hover) and (pointer: fine) {
          .welcome-intro-cta:hover {
            transform: translateY(-2px);
            box-shadow:
              0 0 44px rgba(255, 0, 0, 0.46),
              0 1px 0 rgba(255, 255, 255, 0.06),
              inset 0 0 22px rgba(255, 0, 0, 0.15);
          }
          .welcome-intro-cta:hover:active {
            transform: translateY(-2px) scale(0.97);
            filter: brightness(1.07);
            box-shadow:
              0 0 44px rgba(255, 0, 0, 0.48),
              inset 0 0 14px rgba(255, 0, 0, 0.16);
          }
        }
        .welcome-intro-cta:active {
          transform: scale(0.97);
          filter: brightness(1.07);
          box-shadow:
            0 0 44px rgba(255, 0, 0, 0.48),
            inset 0 0 14px rgba(255, 0, 0, 0.16);
        }
        .welcome-intro-cta--live {
          background: linear-gradient(180deg, rgba(66, 12, 12, 0.82) 0%, rgba(24, 3, 3, 0.88) 100%);
          border: 1px solid rgba(255, 45, 45, 0.58);
          box-shadow:
            0 0 20px rgba(255, 0, 0, 0.4),
            0 0 36px rgba(255, 0, 0, 0.32),
            0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 0 18px rgba(255, 0, 0, 0.14);
        }
        @media (hover: hover) and (pointer: fine) {
          .welcome-intro-cta--live:hover {
            box-shadow:
              0 0 24px rgba(255, 0, 0, 0.48),
              0 0 44px rgba(255, 0, 0, 0.38),
              0 1px 0 rgba(255, 255, 255, 0.07),
              inset 0 0 22px rgba(255, 0, 0, 0.18);
          }
          .welcome-intro-cta--live:hover:active {
            box-shadow:
              0 0 22px rgba(255, 0, 0, 0.45),
              0 0 40px rgba(255, 0, 0, 0.36),
              inset 0 0 14px rgba(255, 0, 0, 0.18);
          }
        }
        .welcome-intro-cta--live:active {
          box-shadow:
            0 0 22px rgba(255, 0, 0, 0.45),
            0 0 40px rgba(255, 0, 0, 0.36),
            inset 0 0 14px rgba(255, 0, 0, 0.18);
        }
        .welcome-intro-icon-shell {
          width: 60px;
          height: 60px;
          flex-shrink: 0;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(32, 14, 14, 0.45);
          box-shadow:
            0 0 20px rgba(255, 0, 0, 0.4),
            inset 0 0 14px rgba(255, 70, 60, 0.14),
            inset 0 2px 18px rgba(255, 120, 100, 0.07);
        }
        @keyframes pulse-red {
          0%,
          100% {
            box-shadow:
              0 0 20px rgba(255, 0, 0, 0.38),
              0 0 34px rgba(255, 0, 0, 0.3),
              0 1px 0 rgba(255, 255, 255, 0.06),
              inset 0 0 16px rgba(255, 0, 0, 0.12);
          }
          50% {
            box-shadow:
              0 0 26px rgba(255, 0, 0, 0.52),
              0 0 46px rgba(255, 0, 0, 0.38),
              0 1px 0 rgba(255, 255, 255, 0.07),
              inset 0 0 22px rgba(255, 0, 0, 0.2);
          }
        }
        .welcome-intro-cta--pulse {
          animation: pulse-red 2s ease-in-out infinite;
        }
        .welcome-intro-cta--pulse:hover {
          animation: none;
          box-shadow:
            0 0 20px rgba(255, 0, 0, 0.4),
            0 0 40px rgba(255, 0, 0, 0.42),
            0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 0 20px rgba(255, 0, 0, 0.14);
        }
        @media (hover: hover) and (pointer: fine) {
          .welcome-intro-cta--pulse:hover {
            transform: translateY(-2px);
            box-shadow:
              0 0 24px rgba(255, 0, 0, 0.48),
              0 0 48px rgba(255, 0, 0, 0.44),
              0 1px 0 rgba(255, 255, 255, 0.06),
              inset 0 0 22px rgba(255, 0, 0, 0.16);
          }
          .welcome-intro-cta--pulse:hover:active {
            transform: translateY(-2px) scale(0.97);
            filter: brightness(1.07);
          }
          .welcome-intro-cta--live.welcome-intro-cta--pulse:hover {
            box-shadow:
              0 0 26px rgba(255, 0, 0, 0.52),
              0 0 50px rgba(255, 0, 0, 0.46),
              0 1px 0 rgba(255, 255, 255, 0.07),
              inset 0 0 22px rgba(255, 0, 0, 0.18);
          }
        }
        .welcome-intro-cta--pulse:active {
          animation: none;
          transform: scale(0.97);
          filter: brightness(1.07);
          box-shadow:
            0 0 22px rgba(255, 0, 0, 0.45),
            0 0 40px rgba(255, 0, 0, 0.36),
            inset 0 0 14px rgba(255, 0, 0, 0.18);
        }
        @keyframes welcome-live-badge-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
        .welcome-live-badge {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          border-radius: 0.375rem;
          border: 1px solid rgba(255, 90, 90, 0.55);
          background: linear-gradient(180deg, #dc2626 0%, #991b1b 55%, #7f1d1d 100%);
          padding: 0.4rem 0.65rem;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #fef2f2;
          box-shadow:
            0 0 12px rgba(255, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
          transform-origin: center center;
        }
        @media (min-width: 640px) {
          .welcome-intro-icon-shell {
            width: 68px;
            height: 68px;
          }
          .welcome-live-badge {
            font-size: 11px;
            padding: 0.45rem 0.7rem;
          }
        }
        .welcome-live-badge--anim {
          animation: welcome-live-badge-pulse 1.2s ease-in-out infinite;
        }
      `}</style>

      <div
        className="relative mx-auto grid h-full min-h-[100dvh] w-full max-w-md grid-rows-[minmax(10rem,1fr)_auto_auto] px-5"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <img
          src={welcomeHeroBg}
          alt=""
          className="pointer-events-none absolute inset-0 h-full min-h-full w-full object-cover object-center"
          decoding="async"
          fetchPriority="high"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
          aria-hidden
        />

        {/* Hero oben: Branding + Personengruppe. 1fr füllt den Zwischenraum. */}
        <div className="relative z-10 min-h-[10rem]" aria-hidden />

        <div className="relative z-20 w-full space-y-[6px] pointer-events-auto max-[667px]:space-y-[5px]">
          {isDemoWelcome ? (
            <>
              <div className="mb-1 px-0.5">
                <p className="text-[17px] font-bold leading-tight text-white sm:text-[19px]">
                  {DEMO_TOUR_WELCOME_HEADLINE}
                </p>
                <p className="mt-1.5 text-[12px] font-medium leading-snug text-white/65 sm:text-[13px]">
                  {DEMO_TOUR_WELCOME_PROBLEM}
                </p>
                <p className="mt-1.5 text-[12px] font-medium leading-snug text-white/75 sm:text-[13px]">
                  {DEMO_TOUR_WELCOME_BENEFIT}
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                  Kein Login erforderlich · Änderungen bleiben lokal · keine echten Nachrichten
                </p>
              </div>

              <PremiumIntroButton onClick={goDemoGuided}>
                <span className="welcome-intro-icon-shell relative z-10">
                  <PlayCircle className="h-8 w-8 text-white/90 sm:h-9 sm:w-9" strokeWidth={2} aria-hidden />
                </span>
                <span className="relative z-10 min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-tight text-white sm:text-[17px]">
                    {DEMO_TOUR_WELCOME_PRIMARY}
                  </span>
                  <span className="mt-0.5 block text-[12px] font-medium leading-snug text-white/58 sm:text-[13px]">
                    Vom Trainingstermin bis zur Saisonbilanz – in ca. 5 Minuten.
                  </span>
                </span>
                <ChevronRight
                  className="relative z-10 h-5 w-5 shrink-0 text-white/55 transition group-hover:text-white/90"
                  strokeWidth={2.6}
                  aria-hidden
                />
              </PremiumIntroButton>

              <PremiumIntroButton onClick={goDemoExplore}>
                <span className="welcome-intro-icon-shell relative z-10">
                  <Compass className="h-8 w-8 text-white/90 sm:h-9 sm:w-9" strokeWidth={2} aria-hidden />
                </span>
                <span className="relative z-10 min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-tight text-white sm:text-[17px]">
                    Demo frei erkunden
                  </span>
                  <span className="mt-0.5 block text-[12px] font-medium leading-snug text-white/58 sm:text-[13px]">
                    Ohne Führung durch die echte Demo navigieren.
                  </span>
                </span>
                <ChevronRight
                  className="relative z-10 h-5 w-5 shrink-0 text-white/55 transition group-hover:text-white/90"
                  strokeWidth={2.6}
                  aria-hidden
                />
              </PremiumIntroButton>
            </>
          ) : (
            <>
              <PremiumIntroButton onClick={goHome}>
                <span className="welcome-intro-icon-shell relative z-10">
                  <img
                    src={spielzeitappIcon}
                    className="h-10 w-10 object-contain sm:h-11 sm:w-11"
                    alt=""
                    width={44}
                    height={44}
                    decoding="async"
                    draggable={false}
                  />
                </span>
                <span className="relative z-10 min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-tight text-white sm:text-[17px]">
                    Zur App
                  </span>
                  <span className="mt-0.5 block text-[12px] font-medium leading-snug text-white/58 sm:text-[13px]">
                    Alle Teams. Alle Funktionen.
                  </span>
                </span>
                <ChevronRight
                  className="relative z-10 h-5 w-5 shrink-0 text-white/55 transition group-hover:text-white/90"
                  strokeWidth={2.6}
                  aria-hidden
                />
              </PremiumIntroButton>

              <PremiumIntroButton pulseGlow={hasLiveMatch} liveActive={hasLiveMatch} onClick={goLive}>
                <span className="relative z-10 flex shrink-0 items-center gap-2.5">
                  <span className="welcome-intro-icon-shell">
                    <img
                      src={`${iconBase}icons/live.svg`}
                      className="h-8 w-8 shrink-0 opacity-95 sm:h-9 sm:w-9"
                      alt=""
                      width={36}
                      height={36}
                      decoding="async"
                      draggable={false}
                    />
                  </span>
                  {hasLiveMatch ? (
                    <span className="welcome-live-badge welcome-live-badge--anim">
                      <span className="text-[11px] leading-none text-red-100 sm:text-xs">●</span> Live
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded border border-red-500/40 bg-red-950/70 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_12px_rgba(220,38,38,0.25)]">
                      <span className="text-[10px] leading-none text-red-300">●</span> Live
                    </span>
                  )}
                </span>
                <span className="relative z-10 min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-tight text-white/95 sm:text-[17px]">
                    Liveticker
                  </span>
                  <span className="mt-0.5 block text-[12px] font-medium leading-snug text-white/58 sm:text-[13px]">
                    Live dabei. Kein Tor verpassen.
                  </span>
                </span>
                <ChevronRight
                  className="relative z-10 h-5 w-5 shrink-0 text-white/45 transition group-hover:text-white/80"
                  strokeWidth={2.6}
                  aria-hidden
                />
              </PremiumIntroButton>
            </>
          )}

          {!isDemoWelcome ? (
            standaloneApp ? (
              <p className="px-0.5 pt-1 text-center text-[11px] leading-[1.35] text-zinc-300 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)] sm:text-[12px] sm:leading-snug">
                App-Modus aktiv.
              </p>
            ) : (
              <div className="flex items-start gap-1.5 px-0.5 pt-1 text-left text-[11px] leading-[1.35] text-zinc-300 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)] sm:text-[12px] sm:leading-snug">
                <Smartphone
                  className="mt-px h-3.5 w-3.5 shrink-0 text-zinc-300 sm:mt-0.5 sm:h-4 sm:w-4"
                  strokeWidth={2.15}
                  aria-hidden
                />
                <p>
                  <span className="font-semibold text-red-500">Tipp:</span> Teilen → Zum Home-Bildschirm
                  hinzufügen.
                </p>
              </div>
            )
          ) : null}
        </div>

        <footer className="relative z-10 mt-2.5 flex shrink-0 flex-col items-center gap-1 px-1 pb-1 max-[667px]:mt-2 max-[667px]:gap-0.5">
          <div className="flex w-full max-w-[320px] items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/14 to-white/5" />
            <Trophy className="h-3.5 w-3.5 shrink-0 text-red-500/80 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/14 to-white/5" />
          </div>
          {isDemoWelcome ? (
            <p className="max-w-[320px] text-center text-[11px] leading-[1.35] text-zinc-300 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)] sm:text-[12px] sm:leading-snug">
              Alle Daten sind fiktiv. Änderungen bleiben nur lokal in dieser Browser-Session. Es werden
              keine Nachrichten oder Benachrichtigungen verschickt.
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
};
