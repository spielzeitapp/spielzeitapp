import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Smartphone, Trophy } from 'lucide-react';
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
  children,
  onClick,
}: {
  /** Liveticker: dezentes Pulsieren des roten Glows */
  pulseGlow?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'welcome-intro-cta group relative flex w-full min-h-[58px] items-center gap-3.5 overflow-hidden rounded-2xl px-4 py-4 text-left',
        pulseGlow ? 'welcome-intro-cta--pulse' : '',
        'active:scale-[0.99]',
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
      className="fixed inset-0 z-[90] flex flex-col overflow-y-auto overflow-x-hidden text-white"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <style>{`
        .welcome-intro-cta {
          background: linear-gradient(180deg, #2a0000 0%, #120000 100%);
          border: 1px solid rgba(255, 0, 0, 0.25);
          box-shadow:
            0 0 25px rgba(255, 0, 0, 0.25),
            inset 0 0 20px rgba(255, 0, 0, 0.15);
          transition: box-shadow 0.2s ease, filter 0.2s ease;
        }
        .welcome-intro-cta:hover {
          box-shadow:
            0 0 34px rgba(255, 0, 0, 0.38),
            inset 0 0 24px rgba(255, 0, 0, 0.22);
        }
        .welcome-intro-cta:active {
          box-shadow:
            0 0 40px rgba(255, 0, 0, 0.45),
            inset 0 0 18px rgba(255, 0, 0, 0.2);
        }
        .welcome-intro-icon-shell {
          width: 80px;
          height: 80px;
          flex-shrink: 0;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.35);
          box-shadow:
            0 0 20px rgba(255, 0, 0, 0.4),
            inset 0 0 10px rgba(255, 0, 0, 0.2);
        }
        @keyframes pulse-red {
          0%,
          100% {
            box-shadow:
              0 0 25px rgba(255, 0, 0, 0.25),
              inset 0 0 20px rgba(255, 0, 0, 0.15);
          }
          50% {
            box-shadow:
              0 0 36px rgba(255, 0, 0, 0.4),
              inset 0 0 26px rgba(255, 0, 0, 0.26);
          }
        }
        .welcome-intro-cta--pulse {
          animation: pulse-red 2s ease-in-out infinite;
        }
        .welcome-intro-cta--pulse:hover {
          animation: none;
          box-shadow:
            0 0 34px rgba(255, 0, 0, 0.38),
            inset 0 0 24px rgba(255, 0, 0, 0.22);
        }
        .welcome-intro-cta--pulse:active {
          animation: none;
          box-shadow:
            0 0 40px rgba(255, 0, 0, 0.45),
            inset 0 0 18px rgba(255, 0, 0, 0.2);
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

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col px-5 pb-3 pt-6">
        <header className="flex flex-col items-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-white/78 [text-shadow:0_1px_0_rgba(0,0,0,0.85),0_2px_14px_rgba(0,0,0,0.75)]">
            Willkommen in der
          </p>

          <h1 className="mt-3 font-black italic leading-[0.95] tracking-tight" style={{ transform: 'skewX(-5deg)' }}>
            <span
              className="text-[clamp(2.45rem,9.5vw,3.35rem)] text-[#fafafa]"
              style={{
                textShadow:
                  '0 1px 0 rgba(0,0,0,0.55), 0 3px 12px rgba(0,0,0,0.75), 0 8px 32px rgba(0,0,0,0.88), 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              Spielzeit
            </span>
            <span
              className="text-[clamp(2.45rem,9.5vw,3.35rem)] text-[#f87171]"
              style={{
                textShadow:
                  '0 1px 0 rgba(0,0,0,0.45), 0 4px 18px rgba(0,0,0,0.82), 0 0 22px rgba(220,38,38,0.22), 0 0 40px rgba(127,29,29,0.12)',
              }}
            >
              App
            </span>
          </h1>

          <p className="mt-4 max-w-[300px] text-[15px] font-medium leading-snug text-white/88 [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_3px_16px_rgba(0,0,0,0.65)]">
            Alle Termine. Alle Infos.
          </p>

          <p
            className="mt-5 text-[12px] font-bold uppercase italic tracking-[0.1em] text-white/94 [text-shadow:0_2px_12px_rgba(0,0,0,0.88)] sm:text-[13px]"
            style={{ transform: 'skewX(-3deg)' }}
          >
            <span className="text-white">#GEMEINSAM</span>
            <span className="text-red-500">EINTEAM</span>
          </p>
        </header>

        {/* Platz für Bildwirkung / Atmosphäre — kein SVG-Icon */}
        <div className="min-h-[min(28vh,220px)] flex-1" aria-hidden />

        <div className="relative mt-auto w-full space-y-3.5 pt-2">
          <PremiumIntroButton onClick={goHome}>
            <span className="welcome-intro-icon-shell relative z-10">
              <img
                src={`${iconBase}icons/home-ball.png`}
                className="h-12 w-12 max-h-[48px] max-w-[48px] object-contain"
                alt=""
                width={48}
                height={48}
                decoding="async"
                draggable={false}
              />
            </span>
            <span className="relative z-10 min-w-0 flex-1 text-[17px] font-bold text-white">Zur App</span>
            <ChevronRight
              className="relative z-10 h-5 w-5 shrink-0 text-white/55 transition group-hover:text-white/90"
              strokeWidth={2.6}
              aria-hidden
            />
          </PremiumIntroButton>

          <PremiumIntroButton pulseGlow onClick={goLive}>
            <span className="relative z-10 flex shrink-0 items-center gap-2.5">
              <span className="welcome-intro-icon-shell">
                <img
                  src={`${iconBase}icons/live.svg`}
                  className="h-9 w-9 shrink-0 opacity-95"
                  alt=""
                  width={36}
                  height={36}
                  decoding="async"
                  draggable={false}
                />
              </span>
              <span className="flex items-center gap-1 rounded border border-red-500/40 bg-red-950/70 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_12px_rgba(220,38,38,0.25)]">
                <span className="text-[10px] leading-none text-red-300">●</span> Live
              </span>
            </span>
            <span className="relative z-10 min-w-0 flex-1 text-[17px] font-bold text-white/95">Liveticker</span>
            <ChevronRight
              className="relative z-10 h-5 w-5 shrink-0 text-white/45 transition group-hover:text-white/80"
              strokeWidth={2.6}
              aria-hidden
            />
          </PremiumIntroButton>
        </div>

        <footer className="relative mt-10 flex flex-col items-center gap-3.5 px-1 pb-1">
          <div className="flex w-full max-w-[320px] items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/14 to-white/5" />
            <Trophy className="h-4 w-4 shrink-0 text-red-500/80" strokeWidth={2} aria-hidden />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/14 to-white/5" />
          </div>
          <div className="flex max-w-[320px] items-start gap-2.5 text-left text-[12px] leading-relaxed text-zinc-400 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
            <Smartphone className="mt-0.5 h-[1.05rem] w-[1.05rem] shrink-0 text-zinc-400" strokeWidth={2.15} aria-hidden />
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
