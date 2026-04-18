import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Smartphone, Trophy } from 'lucide-react';
import { useAppHasLiveMatch } from '../../hooks/useAppHasLiveMatch';
import { markIntroFlowCompleted } from './introFlowSession';

/** Primär „Zur App“: gleiche Route wie BottomNav „Home“ (`AppHomePage`). */
const ROUTE_APP_HOME = '/app/home';

/** Liveticker: gleiche Route wie BottomNav „Live“ (`LiveMatchScreen`). */
const ROUTE_LIVE_TICKER = '/app/live';

/**
 * Vollbild-Hintergrund: `public/intro/welcome-hero.png` (einfach ersetzbar).
 * Motiv: Stadion/Fußball, Nacht, emotional — roter Look kommt aus den UI-Overlays.
 * Kein App-Screenshot, nur Foto unter Text und Buttons.
 */
function welcomeHeroSrc(): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = 'intro/welcome-hero.png';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

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
        'welcome-intro-cta group relative flex w-full min-h-[40px] items-center gap-2.5 overflow-hidden rounded-xl px-4 py-2 text-left',
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
  const heroSrc = welcomeHeroSrc();
  const iconBase = appIconBase();
  const hasLiveMatch = useAppHasLiveMatch({ fetchOutsideApp: true });
  const [welcomeEntered, setWelcomeEntered] = useState(false);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setWelcomeEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const goHome = () => {
    markIntroFlowCompleted();
    navigate(ROUTE_APP_HOME, { replace: true });
  };

  const goLive = () => {
    markIntroFlowCompleted();
    navigate(ROUTE_LIVE_TICKER, { replace: true });
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex max-h-[100dvh] flex-col overflow-x-hidden overflow-y-hidden text-white"
      style={{
        paddingTop: 'max(0.375rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <style>{`
        .welcome-intro-cta {
          background: linear-gradient(180deg, #2a0000 0%, #120000 100%);
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
          background: linear-gradient(180deg, #420c0c 0%, #180303 100%);
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
          width: 68px;
          height: 68px;
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
          .welcome-live-badge {
            font-size: 11px;
            padding: 0.45rem 0.7rem;
          }
        }
        .welcome-live-badge--anim {
          animation: welcome-live-badge-pulse 1.2s ease-in-out infinite;
        }
      `}</style>
      {/* —— Vollbild-Foto —— */}
      <img
        src={heroSrc}
        alt=""
        className="pointer-events-none fixed inset-0 h-full min-h-[100dvh] w-full object-cover object-[center_43%] sm:object-[center_45%]"
        decoding="async"
        fetchPriority="high"
      />

      {/* Basis-Abdunkelung */}
      <div
        className="pointer-events-none fixed inset-0 bg-black/54"
        style={{ mixBlendMode: 'multiply' }}
        aria-hidden
      />
      {/* Tiefenstaffelung: oben schwärzer — Mitte emotional — unten wieder dunkel */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 18%, rgba(0,0,0,0.22) 38%, rgba(0,0,0,0.28) 58%, rgba(0,0,0,0.78) 78%, rgba(0,0,0,0.94) 100%)',
        }}
        aria-hidden
      />

      {/* Rot eher mittig / emotional, oben etwas ruhiger */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 118% 68% at 50% 52%, rgba(220,38,38,0.32), transparent 58%), radial-gradient(ellipse 70% 48% at 88% 48%, rgba(127,29,29,0.11), transparent 50%), radial-gradient(ellipse 65% 45% at 10% 46%, rgba(69,10,10,0.14), transparent 48%)',
        }}
        aria-hidden
      />

      {/* Zusätzliche Abdunkelung oben: Lesbarkeit Branding, weniger „busy“ */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.16) 12%, rgba(0,0,0,0.06) 24%, transparent 38%)',
        }}
        aria-hidden
      />

      {/* Vignette verstärkt + unterer Lesbarkeits-Gradient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 94% 92% at 50% 40%, transparent 12%, rgba(0,0,0,0.72) 100%), linear-gradient(180deg, transparent 0%, transparent 32%, rgba(0,0,0,0.88) 100%)',
        }}
        aria-hidden
      />

      {/* Dezent: Hintergrund zurücknehmen, CTAs visuell nach vorne */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.09) 72%, rgba(0,0,0,0.14) 100%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-5 pb-1 pt-3">
        <header
          className={[
            'flex shrink-0 flex-col items-center text-center transition-[opacity,transform] duration-300 ease-out',
            welcomeEntered ? 'translate-y-0 opacity-100' : 'translate-y-[10px] opacity-0',
          ].join(' ')}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-white/78 [text-shadow:0_1px_0_rgba(0,0,0,0.85),0_2px_14px_rgba(0,0,0,0.75)]">
            Willkommen in der
          </p>

          <h1 className="mt-1.5 font-black italic leading-[0.95] tracking-tight" style={{ transform: 'skewX(-5deg)' }}>
            <span
              className="text-[clamp(2.35rem,9.2vw,3.25rem)] text-[#fafafa]"
              style={{
                textShadow:
                  '0 1px 0 rgba(0,0,0,0.55), 0 3px 12px rgba(0,0,0,0.75), 0 8px 32px rgba(0,0,0,0.88), 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              Spielzeit
            </span>
            <span
              className="text-[clamp(2.35rem,9.2vw,3.25rem)] text-[#f87171]"
              style={{
                textShadow:
                  '0 1px 0 rgba(0,0,0,0.45), 0 4px 18px rgba(0,0,0,0.82), 0 0 22px rgba(220,38,38,0.22), 0 0 40px rgba(127,29,29,0.12)',
              }}
            >
              App
            </span>
          </h1>

          <p className="mt-2 max-w-[300px] text-[15px] font-medium leading-snug text-white/88 [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_3px_16px_rgba(0,0,0,0.65)]">
            Alle Termine. Alle Infos.
          </p>

          <p
            className="mt-2.5 text-[12px] font-bold uppercase italic tracking-[0.1em] text-white/94 [text-shadow:0_2px_12px_rgba(0,0,0,0.88)] sm:text-[13px]"
            style={{ transform: 'skewX(-3deg)' }}
          >
            <span className="text-white">#GEMEINSAM</span>
            <span className="text-red-500">EINTEAM</span>
          </p>
        </header>

        {/* Flexibler Luftpolster — schrumpft auf kleinen Viewports, kein Scroll */}
        <div className="min-h-0 flex-1 basis-0" aria-hidden />

        <div
          className={[
            'relative mt-auto w-full shrink-0 space-y-[7px] pt-0 transition-[opacity,transform] duration-300 ease-out delay-75',
            welcomeEntered ? 'translate-y-0 opacity-100' : 'translate-y-[10px] opacity-0',
          ].join(' ')}
        >
          <PremiumIntroButton onClick={goHome}>
            <span className="welcome-intro-icon-shell relative z-10">
              <img
                src={`${iconBase}icons/home-ball.png`}
                className="-translate-y-px object-contain h-11 w-11 max-h-[44px] max-w-[44px] sm:h-[52px] sm:w-[52px] sm:max-h-[52px] sm:max-w-[52px]"
                alt=""
                width={48}
                height={48}
                decoding="async"
                draggable={false}
              />
            </span>
            <span className="relative z-10 min-w-0 flex-1 text-[16px] font-bold leading-tight text-white sm:text-[17px]">
              Zur App
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
            <span className="relative z-10 min-w-0 flex-1 text-[16px] font-bold leading-tight text-white/95 sm:text-[17px]">
              Liveticker
            </span>
            <ChevronRight
              className="relative z-10 h-5 w-5 shrink-0 text-white/45 transition group-hover:text-white/80"
              strokeWidth={2.6}
              aria-hidden
            />
          </PremiumIntroButton>
        </div>

        <footer className="relative mt-4 flex shrink-0 flex-col items-center gap-1.5 px-1 pb-0">
          <div className="flex w-full max-w-[320px] items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/14 to-white/5" />
            <Trophy className="h-3.5 w-3.5 shrink-0 text-red-500/80 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/14 to-white/5" />
          </div>
          <div className="flex max-w-[320px] items-start gap-1.5 text-left text-[11px] leading-[1.35] text-zinc-300 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)] sm:text-[12px] sm:leading-snug">
            <Smartphone className="mt-px h-3.5 w-3.5 shrink-0 text-zinc-300 sm:mt-0.5 sm:h-4 sm:w-4" strokeWidth={2.15} aria-hidden />
            <p>
              <span className="font-semibold text-red-500">Tipp:</span> Zum Home-Bildschirm hinzufügen für den vollen
              App-Modus.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
