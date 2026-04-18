import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Radio, Smartphone, Trophy } from 'lucide-react';
import { markIntroFlowCompleted } from './introFlowSession';

/** Primär „Zur App“: gleiche Route wie BottomNav „Home“ (`AppHomePage`). */
const ROUTE_APP_HOME = '/app/home';

/** Liveticker: gleiche Route wie BottomNav „Live“ (`LiveMatchScreen`). */
const ROUTE_LIVE_TICKER = '/app/live';

/**
 * Vollbild-Hintergrund: `public/intro/welcome-hero.jpg` (einfach ersetzbar).
 * Motiv: Stadion/Fußball, Nacht, emotional — roter Look kommt aus den UI-Overlays.
 * Kein App-Screenshot, nur Foto unter Text und Buttons.
 */
function welcomeHeroSrc(): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = 'intro/welcome-hero.jpg';
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
              'border border-red-500/45',
              'bg-gradient-to-b from-[#222226] via-[#121214] to-[#050505]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-2px_0_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.8),0_10px_32px_-6px_rgba(0,0,0,0.85),0_18px_56px_-10px_rgba(220,38,38,0.42)]',
            ].join(' ')
          : [
              'border border-red-600/40',
              'bg-gradient-to-b from-[#18181b] to-[#030303]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,0,0,0.75),0_12px_40px_-8px_rgba(0,0,0,0.9),0_14px_48px_-12px_rgba(127,29,29,0.28)]',
            ].join(' '),
      ].join(' ')}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/28 to-transparent"
        aria-hidden
      />
      {isPrimary ? (
        <span
          className="pointer-events-none absolute inset-x-4 -top-2 h-20 bg-gradient-to-b from-red-500/22 via-red-600/10 to-transparent blur-2xl"
          aria-hidden
        />
      ) : (
        <span
          className="pointer-events-none absolute inset-x-8 top-0 h-12 bg-gradient-to-b from-red-600/12 to-transparent blur-xl"
          aria-hidden
        />
      )}
      <span
        className={[
          'pointer-events-none absolute -inset-px rounded-2xl',
          isPrimary ? 'shadow-[inset_0_0_0_1px_rgba(248,113,113,0.18)]' : 'shadow-[inset_0_0_0_1px_rgba(185,28,28,0.14)]',
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
        className="pointer-events-none fixed inset-0 h-full min-h-[100dvh] w-full object-cover object-[center_38%] sm:object-center"
        decoding="async"
        fetchPriority="high"
      />

      {/* Basis-Abdunkelung */}
      <div
        className="pointer-events-none fixed inset-0 bg-black/50"
        style={{ mixBlendMode: 'multiply' }}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/88" aria-hidden />

      {/* Roter Stadion-Glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 125% 75% at 50% 10%, rgba(220,38,38,0.38), transparent 52%), radial-gradient(ellipse 95% 58% at 88% 28%, rgba(127,29,29,0.28), transparent 46%), radial-gradient(ellipse 85% 52% at 8% 32%, rgba(69,10,10,0.4), transparent 44%)',
        }}
        aria-hidden
      />

      {/* Vignette + Lesbarkeit unten für Buttons */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 85% at 50% 40%, transparent 22%, rgba(0,0,0,0.55) 100%), linear-gradient(180deg, transparent 0%, transparent 42%, rgba(0,0,0,0.82) 100%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col px-5 pb-3 pt-6">
        <header className="flex flex-col items-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-white/75 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            Willkommen in der
          </p>

          <h1
            className="mt-3 font-black italic leading-[0.95] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]"
            style={{ transform: 'skewX(-5deg)' }}
          >
            <span className="text-[clamp(2.45rem,9.5vw,3.35rem)] text-white">Spielzeit</span>
            <span className="text-[clamp(2.45rem,9.5vw,3.35rem)] text-[#f87171]">App</span>
          </h1>

          <p className="mt-4 max-w-[300px] text-[15px] font-medium leading-snug text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            Alle Termine. Alle Infos.
          </p>

          <p
            className="mt-5 text-[12px] font-bold uppercase italic tracking-[0.1em] text-white/92 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] sm:text-[13px]"
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
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/18 to-white/6" />
            <Trophy className="h-4 w-4 shrink-0 text-red-500/85" strokeWidth={2} aria-hidden />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/18 to-white/6" />
          </div>
          <div className="flex max-w-[320px] items-start gap-2.5 text-left text-[12px] leading-relaxed text-zinc-400 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" strokeWidth={2} aria-hidden />
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
