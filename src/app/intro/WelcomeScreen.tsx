import React, { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Radio, Smartphone, Trophy } from 'lucide-react';
import { markIntroFlowCompleted } from './introFlowSession';

/** Primär „Zur App“: gleiche Route wie BottomNav „Home“ (`AppHomePage`). */
const ROUTE_APP_HOME = '/app/home';

/**
 * Liveticker: gleiche Route wie BottomNav „Live“ (`LiveMatchScreen`).
 */
const ROUTE_LIVE_TICKER = '/app/live';

function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" className="text-white/90" />
      <path
        d="M12 3.5v17M5.8 7.4l12.4 9.2M18.2 7.4L5.8 16.6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        className="text-white/75"
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
        'group relative flex w-full min-h-[54px] items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left transition',
        'active:scale-[0.992] active:brightness-[0.97]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        isPrimary
          ? 'border border-red-500/30 bg-gradient-to-b from-[#1c1c1f] via-[#101012] to-[#060606] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(0,0,0,0.5),0_12px_36px_-10px_rgba(220,38,38,0.28),0_0_0_1px_rgba(0,0,0,0.75)]'
          : 'border border-red-600/28 bg-gradient-to-b from-[#121214] to-[#050505] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_28px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(0,0,0,0.65)]',
      ].join(' ')}
    >
      {/* Oberkante: feiner Lichtstrich + kontrollierter Rot-Glow (kein Neon) */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent"
        aria-hidden
      />
      {isPrimary ? (
        <span
          className="pointer-events-none absolute inset-x-6 -top-1 h-14 bg-gradient-to-b from-red-500/14 to-transparent blur-xl"
          aria-hidden
        />
      ) : null}
      <span
        className={[
          'pointer-events-none absolute -inset-px rounded-2xl opacity-70',
          isPrimary
            ? 'shadow-[inset_0_0_0_1px_rgba(248,113,113,0.12)]'
            : 'shadow-[inset_0_0_0_1px_rgba(185,28,28,0.1)]',
        ].join(' ')}
        aria-hidden
      />
      {children}
    </button>
  );
}

function StadiumHeroScene({ uid }: { uid: string }) {
  const gid = (s: string) => `${s}-${uid}`;
  return (
    <div className="relative mx-auto w-full max-w-[340px] select-none" aria-hidden>
      {/* Lichtkegel & Atmosphäre hinter der Figur */}
      <div className="pointer-events-none absolute -inset-6 bottom-0 top-[-18%] overflow-visible">
        <div
          className="absolute left-1/2 top-[-8%] h-[72%] w-[140%] -translate-x-1/2 rounded-[100%] opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 55% 48% at 50% 0%, rgba(252,165,165,0.14), transparent 62%), conic-gradient(from 200deg at 50% -10%, transparent 0deg, rgba(127,29,29,0.22) 38deg, transparent 78deg), conic-gradient(from 160deg at 50% -10%, transparent 0deg, rgba(185,28,28,0.12) 52deg, transparent 95deg)',
            filter: 'blur(1px)',
          }}
        />
        <div className="absolute left-[-12%] top-[18%] h-[55%] w-[38%] rounded-full bg-gradient-to-r from-red-700/25 to-transparent blur-3xl" />
        <div className="absolute right-[-12%] top-[18%] h-[55%] w-[38%] rounded-full bg-gradient-to-l from-red-600/22 to-transparent blur-3xl" />
        <div
          className="absolute bottom-[6%] left-1/2 h-[22%] w-[118%] -translate-x-1/2 rounded-full opacity-80"
          style={{
            background: 'radial-gradient(ellipse closest-side, rgba(220,38,38,0.2), transparent 100%)',
            filter: 'blur(20px)',
          }}
        />
      </div>

      <svg
        viewBox="0 0 320 420"
        className="relative z-10 mx-auto h-[min(50vh,400px)] w-auto max-w-full"
        style={{
          filter:
            'drop-shadow(0 28px 48px rgba(0,0,0,0.85)) drop-shadow(0 0 32px rgba(185,28,28,0.22)) drop-shadow(0 -6px 24px rgba(254,202,202,0.08))',
        }}
        aria-hidden
      >
        <defs>
          <linearGradient id={gid('jersey')} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="20%" stopColor="#0a0a0a" />
            <stop offset="20%" stopColor="#991b1b" />
            <stop offset="38%" stopColor="#b91c1c" />
            <stop offset="38%" stopColor="#0a0a0a" />
            <stop offset="58%" stopColor="#0a0a0a" />
            <stop offset="58%" stopColor="#991b1b" />
            <stop offset="76%" stopColor="#dc2626" />
            <stop offset="76%" stopColor="#0a0a0a" />
            <stop offset="100%" stopColor="#050505" />
          </linearGradient>
          <linearGradient id={gid('rim')} x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#fecaca" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#f87171" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#450a0a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={gid('spot')} cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <filter id={gid('soft')} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2.5"
              floodColor="#000000"
              floodOpacity="0.55"
            />
          </filter>
        </defs>

        <rect width="320" height="420" fill={`url(#${gid('spot')})`} opacity="0.85" />

        <ellipse cx="160" cy="402" rx="130" ry="16" fill="rgba(0,0,0,0.55)" />
        <ellipse cx="160" cy="396" rx="108" ry="12" fill="rgba(127,29,29,0.35)" opacity="0.45" />

        <path
          d="M160 52c18 0 32 14 32 32v8c0 8-4 15-10 20 28 12 48 42 52 78l8 120c2 18-10 34-28 36h-108c-18-2-30-18-28-36l8-120c4-36 24-66 52-78-6-5-10-12-10-20v-8c0-18 14-32 32-32z"
          fill="#030303"
        />
        <path
          d="M118 118h184v162c0 22-18 40-40 40H158c-22 0-40-18-40-40V118z"
          fill={`url(#${gid('jersey')})`}
        />
        <path
          d="M118 118h184v162c0 22-18 40-40 40H158c-22 0-40-18-40-40V118z"
          fill={`url(#${gid('rim')})`}
          opacity="0.42"
        />
        <path d="M118 150h184v40H118z" fill="#000" opacity="0.2" />

        <text
          x="160"
          y="218"
          textAnchor="middle"
          fill="#fafafa"
          fontSize="54"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{ letterSpacing: '-0.05em' }}
          filter={`url(#${gid('soft')})`}
        >
          11
        </text>
        <text
          x="160"
          y="218"
          textAnchor="middle"
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="1.5"
          fontSize="54"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{ letterSpacing: '-0.05em' }}
        >
          11
        </text>

        <ellipse cx="160" cy="58" rx="34" ry="38" fill="#050505" />
        <ellipse cx="160" cy="58" rx="34" ry="38" fill={`url(#${gid('rim')})`} opacity="0.35" />

        <path
          d="M52 175c28-8 52 8 60 38l18 85M268 175c-28-8-52 8-60 38l-18 85"
          stroke="#020202"
          strokeWidth="24"
          strokeLinecap="round"
        />
        <path
          d="M52 175c28-8 52 8 60 38l18 85M268 175c-28-8-52 8-60 38l-18 85"
          stroke="#1a1a1a"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M52 175c28-8 52 8 60 38l18 85M268 175c-28-8-52 8-60 38l-18 85"
          stroke={`url(#${gid('rim')})`}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.25"
        />

        <circle cx="248" cy="228" r="29" fill="#080808" stroke="#27272a" strokeWidth="1.5" />
        <circle cx="248" cy="228" r="29" fill={`url(#${gid('spot')})`} opacity="0.5" />
        <path
          d="M236 218h24M248 206v24"
          stroke="#e7e7e7"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.88"
        />
        <circle cx="248" cy="228" r="30" fill="none" stroke="#7f1d1d" strokeWidth="2" opacity="0.55" />
        <circle cx="248" cy="228" r="33" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.25" />
      </svg>

      {/* Boden-Spiegel / nasse Fläche */}
      <div
        className="pointer-events-none absolute bottom-[2%] left-[8%] right-[8%] h-[14%] rounded-[100%] opacity-50"
        style={{
          background: 'linear-gradient(180deg, rgba(220,38,38,0.15), transparent)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
}

export const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const heroUid = useId().replace(/:/g, '');

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
      className="fixed inset-0 z-[90] flex flex-col overflow-y-auto overflow-x-hidden bg-[#020202] text-white"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* —— Atmosphäre: Stadion-Nacht, mehrere Lichtquellen, Vignette —— */}
      <div className="pointer-events-none fixed inset-0 bg-[#030303]" aria-hidden />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 130% 85% at 50% -5%, rgba(220,38,38,0.38), transparent 52%), radial-gradient(ellipse 90% 70% at 85% 35%, rgba(127,29,29,0.22), transparent 48%), radial-gradient(ellipse 80% 60% at 12% 40%, rgba(69,10,10,0.35), transparent 45%), linear-gradient(180deg, #0a0505 0%, #000 38%, #020202 72%, #000 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 5px)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 95% 80% at 50% 45%, transparent 30%, rgba(0,0,0,0.55) 72%, rgba(0,0,0,0.92) 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[48vh] bg-gradient-to-b from-red-600/18 via-transparent to-transparent blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-2 pt-5">
        <header className="flex flex-col items-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-white/68">
            Willkommen in der
          </p>

          <h1
            className="mt-3 font-black italic leading-[0.95] tracking-tight"
            style={{ transform: 'skewX(-5deg)' }}
          >
            <span
              className="text-[clamp(2.4rem,9.2vw,3.25rem)] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.9)]"
              style={{ textShadow: '0 0 40px rgba(255,255,255,0.06)' }}
            >
              Spielzeit
            </span>
            <span
              className="text-[clamp(2.4rem,9.2vw,3.25rem)] text-[#ef4444] drop-shadow-[0_4px_28px_rgba(127,29,29,0.45)]"
              style={{ textShadow: '0 0 32px rgba(220,38,38,0.25)' }}
            >
              App
            </span>
          </h1>

          <p className="mt-4 max-w-[280px] text-[15px] font-medium leading-snug text-white/78">
            Alle Termine. Alle Infos.
          </p>

          <p
            className="mt-5 text-[12px] font-bold uppercase italic tracking-[0.08em] text-white/88 sm:text-[13px]"
            style={{ transform: 'skewX(-3deg)' }}
          >
            <span className="text-white/95">#GEMEINSAM</span>
            <span className="text-[#ef4444]">EINTEAM</span>
          </p>
        </header>

        <div className="mt-1 flex min-h-[min(48vh,380px)] w-full flex-1 flex-col items-center justify-end pb-2">
          <StadiumHeroScene uid={heroUid} />
        </div>

        <div className="relative mt-auto w-full space-y-3 pt-2">
          <PremiumIntroButton variant="primary" onClick={goHome}>
            <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/55 ring-1 ring-white/[0.08]">
              <SoccerBallIcon className="h-6 w-6" />
            </span>
            <span className="relative z-10 min-w-0 flex-1 text-base font-bold text-white">Zur App</span>
            <ChevronRight
              className="relative z-10 h-5 w-5 shrink-0 text-white/45 transition group-hover:text-white/75"
              strokeWidth={2.4}
              aria-hidden
            />
          </PremiumIntroButton>

          <PremiumIntroButton variant="secondary" onClick={goLive}>
            <span className="relative z-10 flex shrink-0 items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/55 ring-1 ring-red-950/50">
                <Radio className="h-5 w-5 text-white/88" strokeWidth={2.2} aria-hidden />
              </span>
              <span className="flex items-center gap-1 rounded border border-red-500/35 bg-red-950/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <span className="text-[9px] leading-none text-red-300">●</span> Live
              </span>
            </span>
            <span className="relative z-10 min-w-0 flex-1 text-base font-bold text-white/92">Liveticker</span>
            <ChevronRight
              className="relative z-10 h-5 w-5 shrink-0 text-white/38 transition group-hover:text-white/65"
              strokeWidth={2.4}
              aria-hidden
            />
          </PremiumIntroButton>
        </div>

        <footer className="relative mt-9 flex flex-col items-center gap-3.5 px-1 pb-1">
          <div className="flex w-full max-w-[320px] items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/12 to-white/5" />
            <Trophy className="h-4 w-4 shrink-0 text-red-600/75" strokeWidth={2} aria-hidden />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/12 to-white/5" />
          </div>
          <div className="flex max-w-[320px] items-start gap-2.5 text-left text-[12px] leading-relaxed text-zinc-500">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" strokeWidth={2} aria-hidden />
            <p>
              <span className="font-semibold text-red-500/90">Tipp:</span> Zum Home-Bildschirm hinzufügen für den
              vollen App-Modus.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
