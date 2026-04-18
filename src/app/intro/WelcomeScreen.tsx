import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Smartphone, Trophy } from 'lucide-react';
import { markIntroFlowCompleted } from './introFlowSession';

/** Primär „Zur App“: gleiche Route wie BottomNav „Home“ (`AppHomePage`). */
const ROUTE_APP_HOME = '/app/home';

/** Liveticker: gleiche Route wie BottomNav „Live“ (`LiveMatchScreen`). */
const ROUTE_LIVE_TICKER = '/app/live';

function appIconBase(): string {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
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
        'group relative flex w-full min-h-[60px] items-center gap-3.5 overflow-hidden rounded-2xl px-4 py-4 text-left transition',
        'active:scale-[0.99] active:brightness-[0.97]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        isPrimary
          ? [
              'border border-red-500/32 ring-1 ring-red-950/35',
              'bg-gradient-to-b from-[#141010] via-[#0a0707] to-[#020101]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-2px_0_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.88),0_16px_44px_-8px_rgba(0,0,0,0.88),0_0_32px_-8px_rgba(185,28,28,0.22)]',
            ].join(' ')
          : [
              'border border-red-600/30 ring-1 ring-red-950/40',
              'bg-gradient-to-b from-[#120e0e] via-[#080606] to-[#010101]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-2px_0_rgba(0,0,0,0.52),0_0_0_1px_rgba(0,0,0,0.88),0_14px_40px_-8px_rgba(0,0,0,0.9),0_0_28px_-8px_rgba(127,29,29,0.2)]',
            ].join(' '),
      ].join(' ')}
    >
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent"
        aria-hidden
      />
      {isPrimary ? (
        <span
          className="pointer-events-none absolute inset-x-2 -top-2 h-[5.5rem] bg-gradient-to-b from-red-600/14 via-red-950/6 to-transparent blur-[2rem]"
          aria-hidden
        />
      ) : (
        <span
          className="pointer-events-none absolute inset-x-5 top-0 h-[3.5rem] bg-gradient-to-b from-red-700/12 to-transparent blur-[1.25rem]"
          aria-hidden
        />
      )}
      <span
        className={[
          'pointer-events-none absolute -inset-px rounded-2xl',
          isPrimary
            ? 'shadow-[inset_0_0_0_1px_rgba(248,113,113,0.1)]'
            : 'shadow-[inset_0_0_0_1px_rgba(185,28,28,0.1)]',
        ].join(' ')}
        aria-hidden
      />
      {children}
    </button>
  );
}

export const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
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
      <img
        src="/intro/welcome-hero.png"
        alt=""
        className="pointer-events-none fixed inset-0 h-full min-h-[100dvh] w-full object-cover object-[center_40%] sm:object-[center_42%]"
        decoding="async"
        fetchPriority="high"
      />

      {/* Leichte Basis-Tönung — Mitte möglichst offen lassen */}
      <div
        className="pointer-events-none fixed inset-0 bg-black/28"
        style={{ mixBlendMode: 'multiply' }}
        aria-hidden
      />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.14) 12%, rgba(0,0,0,0.04) 32%, rgba(0,0,0,0.06) 52%, rgba(0,0,0,0.48) 72%, rgba(0,0,0,0.78) 88%, rgba(0,0,0,0.88) 100%)',
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 115% 58% at 50% 46%, rgba(220,38,38,0.11), transparent 52%)',
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 88% 65% at 50% 38%, transparent 25%, rgba(0,0,0,0.18) 100%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col px-5 pb-3 pt-6">
        <header className="flex flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/92 [text-shadow:0_1px_2px_rgba(0,0,0,0.85),0_2px_12px_rgba(0,0,0,0.55)] sm:text-[12px] sm:tracking-[0.36em]">
            Willkommen in der
          </p>

          <h1 className="mt-3.5 font-black italic leading-[0.92] tracking-tight" style={{ transform: 'skewX(-5deg)' }}>
            <span
              className="text-[clamp(2.85rem,10.5vw,3.85rem)] text-[#fafafa]"
              style={{
                textShadow:
                  '0 1px 0 rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.65), 0 10px 36px rgba(0,0,0,0.75), 0 0 1px rgba(255,255,255,0.08)',
              }}
            >
              Spielzeit
            </span>
            <span
              className="text-[clamp(2.85rem,10.5vw,3.85rem)] text-[#f87171]"
              style={{
                textShadow:
                  '0 1px 0 rgba(0,0,0,0.4), 0 4px 18px rgba(0,0,0,0.75), 0 0 24px rgba(220,38,38,0.2), 0 0 44px rgba(127,29,29,0.12)',
              }}
            >
              App
            </span>
          </h1>

          <p className="mt-5 max-w-[320px] text-[16px] font-semibold leading-snug text-white/92 [text-shadow:0_1px_3px_rgba(0,0,0,0.88),0_4px_18px_rgba(0,0,0,0.55)] sm:text-[17px]">
            Alle Termine. Alle Infos.
          </p>

          <p
            className="mt-5 text-[13px] font-bold uppercase italic tracking-[0.12em] text-white/96 [text-shadow:0_2px_14px_rgba(0,0,0,0.82)] sm:text-[14px]"
            style={{ transform: 'skewX(-3deg)' }}
          >
            <span className="text-white">#GEMEINSAM</span>
            <span className="text-red-400">EINTEAM</span>
          </p>
        </header>

        <div className="min-h-[min(26vh,200px)] flex-1" aria-hidden />

        <div className="relative mt-auto w-full space-y-3.5 pt-2">
          <PremiumIntroButton variant="primary" onClick={goHome}>
            <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/55 ring-1 ring-white/14">
              <img
                src={`${iconBase}icons/home-ball.png`}
                className="button-icon"
                alt=""
                width={34}
                height={34}
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

          <PremiumIntroButton variant="secondary" onClick={goLive}>
            <span className="relative z-10 flex shrink-0 items-center gap-2.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-black/55 ring-1 ring-red-900/45">
                <img
                  src={`${iconBase}icons/live.svg`}
                  className="h-6 w-6 shrink-0 opacity-90"
                  alt=""
                  width={24}
                  height={24}
                  decoding="async"
                  draggable={false}
                />
              </span>
              <span className="flex items-center gap-1 rounded border border-red-500/38 bg-red-950/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_14px_rgba(127,29,29,0.28)]">
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
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/18 to-white/8" />
            <Trophy className="h-4 w-4 shrink-0 text-red-400/85" strokeWidth={2} aria-hidden />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/18 to-white/8" />
          </div>
          <div className="flex max-w-[320px] items-start gap-2.5 text-left text-[12px] leading-relaxed text-zinc-300 [text-shadow:0_1px_8px_rgba(0,0,0,0.85)]">
            <Smartphone className="mt-0.5 h-[1.05rem] w-[1.05rem] shrink-0 text-zinc-300" strokeWidth={2.15} aria-hidden />
            <p>
              <span className="font-semibold text-red-400">Tipp:</span> Zum Home-Bildschirm hinzufügen für den vollen
              App-Modus.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
