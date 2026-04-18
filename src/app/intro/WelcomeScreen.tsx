import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Radio, Smartphone, Trophy } from 'lucide-react';
import { markIntroFlowCompleted } from './introFlowSession';

/** Primär „Zur App“: gleiche Route wie BottomNav „Home“ (`AppHomePage`). */
const ROUTE_APP_HOME = '/app/home';

/** Liveticker: gleiche Route wie BottomNav „Live“ (`LiveMatchScreen`). */
const ROUTE_LIVE_TICKER = '/app/live';

/**
 * Vollbild-Hintergrund: `public/intro/welcome-hero.PNG` (einfach ersetzbar).
 * Motiv: Stadion/Fußball, Nacht, emotional — roter Look kommt aus den UI-Overlays.
 * Kein App-Screenshot, nur Foto unter Text und Buttons.
 */
function welcomeHeroSrc(): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = 'intro/welcome-hero.PNG';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" className="text-white/95" />
      <path
        d="M12 3.5v17M5.8 7.4l12.4 9.2M18.2 7.4L5.8 16.6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        className="text-white/78"
      />
    </svg>
  );
}

function PremiumIntroButton({
  variant,
  children,
  onClick,
}: {
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick: () => void;
}) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex w-full min-h-[58px] items-center gap-3.5 overflow-hidden rounded-2xl px-4 py-4 text-left transition',
        'active:scale-[0.99] active:brightness-[0.96]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        isPrimary
          ? [
              'border border-red-500/40',
              'bg-gradient-to-b from-[#1e1e22] via-[#0f0f12] to-[#040404]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.095),inset_0_-2px_0_rgba(0,0,0,0.58),0_0_0_1px_rgba(0,0,0,0.82),0_12px_36px_-6px_rgba(0,0,0,0.88),0_20px_60px_-10px_rgba(220,38,38,0.38)]',
            ].join(' ')
          : [
              'border border-red-600/36',
              'bg-gradient-to-b from-[#151518] to-[#020202]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.055),inset_0_-2px_0_rgba(0,0,0,0.52),0_0_0_1px_rgba(0,0,0,0.78),0_14px_44px_-8px_rgba(0,0,0,0.92),0_16px_52px_-12px_rgba(127,29,29,0.32)]',
            ].join(' '),
      ].join(' ')}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/28 to-transparent"
        aria-hidden
      />
      {isPrimary ? (
        <span
          className="pointer-events-none absolute inset-x-3 -top-2 h-[5.25rem] bg-gradient-to-b from-red-500/20 via-red-700/8 to-transparent blur-2xl"
          aria-hidden
        />
      ) : (
        <span
          className="pointer-events-none absolute inset-x-7 top-0 h-14 bg-gradient-to-b from-red-600/14 to-transparent blur-xl"
          aria-hidden
        />
      )}
      <span
        className={[
          'pointer-events-none absolute -inset-px rounded-2xl',
          isPrimary ? 'shadow-[inset_0_0_0_1px_rgba(252,165,165,0.14)]' : 'shadow-[inset_0_0_0_1px_rgba(185,28,28,0.12)]',
        ].join(' ')}
        aria-hidden
      />
      {children}
    </button>
  );
}

export const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const heroSrc = welcomeHeroSrc();

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
      {/* —— Vollbild-Foto —— */}
      <img
        src={heroSrc}
        alt=""
        className="pointer-events-none fixed inset-0 h-full min-h-[100dvh] w-full object-cover object-[center_36%] sm:object-[center_40%]"
        decoding="async"
        fetchPriority="high"
      />

      {/* Basis-Abdunkelung — dunkler, emotionaler */}
      <div
        className="pointer-events-none fixed inset-0 bg-black/56"
        style={{ mixBlendMode: 'multiply' }}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/82 via-black/42 to-black/[0.91]" aria-hidden />

      {/* Roter Premium-Nacht-Look */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 128% 78% at 50% 8%, rgba(220,38,38,0.42), transparent 54%), radial-gradient(ellipse 100% 60% at 90% 26%, rgba(127,29,29,0.32), transparent 48%), radial-gradient(ellipse 88% 55% at 6% 30%, rgba(69,10,10,0.45), transparent 46%)',
        }}
        aria-hidden
      />

      {/* Vignette + Lesbarkeit unten */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 96% 88% at 50% 38%, transparent 18%, rgba(0,0,0,0.62) 100%), linear-gradient(180deg, transparent 0%, transparent 38%, rgba(0,0,0,0.86) 100%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col px-5 pb-3 pt-6">
        <header className="flex flex-col items-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-white/78 [text-shadow:0_1px_0_rgba(0,0,0,0.85),0_2px_14px_rgba(0,0,0,0.75)]">
            Willkommen in der
          </p>

          <h1
            className="mt-3 font-black italic leading-[0.95] tracking-tight [text-shadow:0_2px_0_rgba(0,0,0,0.55),0_6px_28px_rgba(0,0,0,0.92)]"
            style={{ transform: 'skewX(-5deg)' }}
          >
            <span className="text-[clamp(2.45rem,9.5vw,3.35rem)] text-[#fafafa]">Spielzeit</span>
            <span className="text-[clamp(2.45rem,9.5vw,3.35rem)] text-[#f87171] [text-shadow:0_0_28px_rgba(185,28,28,0.35)]">
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
          <PremiumIntroButton variant="primary" onClick={goHome}>
            <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/60 ring-1 ring-white/12">
              <SoccerBallIcon className="h-6 w-6" />
            </span>
            <span className="relative z-10 min-w-0 flex-1 text-[17px] font-bold text-white">Zur App</span>
            <ChevronRight
              className="relative z-10 h-5 w-5 shrink-0 text-white/55 transition group-hover:text-white/90"
              strokeWidth={2.6}
              aria-hidden
            />
          </PremiumIntroButton>

          <PremiumIntroButton variant="secondary" onClick={goLive}>
            <span className="relative z-10 flex shrink-0 items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/65 ring-1 ring-red-900/55">
                <Radio className="h-5 w-5 text-white/92" strokeWidth={2.25} aria-hidden />
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
          <div className="flex max-w-[320px] items-start gap-2.5 text-left text-[12px] leading-relaxed text-zinc-500 [text-shadow:0_1px_8px_rgba(0,0,0,0.88)]">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500/95" strokeWidth={2} aria-hidden />
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
