import React from "react";

/** Wasserzeichen hinter Text und Figur */
const WATERMARK_STYLE: React.CSSProperties = {
  fontSize: "clamp(6.25rem, 38vw, 11.5rem)",
  color: "rgba(122, 29, 42, 0.29)",
  WebkitTextStroke: "2px rgba(180, 28, 45, 0.48)",
  paintOrder: "stroke fill",
  textShadow:
    "0 0 48px rgba(180, 28, 45, 0.42), 0 0 12px rgba(220, 38, 38, 0.25), 0 3px 0 rgba(0,0,0,0.5), 2px 2px 0 rgba(140, 20, 35, 0.35)",
};

type Props = {
  watermark: string;
  firstNameLine: string;
  lastNameLine: string;
  teamSeasonLabel: string;
  avatarUrl: string;
  initials: string;
  showTacticalBoard?: boolean;
};

function StadiumAtmosphere() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0c0608_0%,#12080c_42%,#080406_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,transparent_0%,rgba(12,28,16,0.22)_55%,rgba(6,12,8,0.35)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(180,28,45,0.38)_0%,transparent_68%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(ellipse_90%_80%_at_100%_50%,rgba(160,24,40,0.34)_0%,transparent_68%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-5%,rgba(255,255,255,0.11)_0%,transparent_58%)]"
        aria-hidden
      />
      <FloodlightBeams />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_105%_95%_at_50%_45%,transparent_35%,rgba(0,0,0,0.55)_88%,rgba(0,0,0,0.78)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22] bg-[repeating-linear-gradient(90deg,transparent,transparent_56px,rgba(255,255,255,0.025)_56px,rgba(255,255,255,0.025)_57px)]"
        aria-hidden
      />
    </>
  );
}

function FloodlightBeams() {
  return (
    <>
      <div
        className="pointer-events-none absolute -left-6 top-0 h-[72%] w-[38%] origin-top-left -skew-x-6 bg-[linear-gradient(165deg,rgba(255,248,240,0.14)_0%,rgba(255,248,240,0.04)_35%,transparent_72%)] blur-[1px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 top-0 h-[72%] w-[38%] origin-top-right skew-x-6 bg-[linear-gradient(195deg,rgba(255,248,240,0.12)_0%,rgba(255,248,240,0.035)_35%,transparent_72%)] blur-[1px]"
        aria-hidden
      />
      <div className="pointer-events-none absolute left-[10%] top-0 h-20 w-20 rounded-full bg-white/[0.09] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-[8%] top-0 h-20 w-20 rounded-full bg-white/[0.07] blur-3xl" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-14 w-[55%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,transparent_70%)] blur-xl"
        aria-hidden
      />
    </>
  );
}

function TacticalBoardOverlay() {
  return (
    <svg
      className="pointer-events-none absolute right-0 top-0 z-[1] h-full w-[52%] text-white/[0.1]"
      viewBox="0 0 200 180"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden
    >
      <circle cx="130" cy="48" r="26" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="165" cy="112" r="20" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M108 38 L155 78" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M148 68 L178 125" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M95 130 L125 95 L148 145" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <rect x="72" y="22" width="118" height="136" rx="8" stroke="currentColor" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

/** Freigestellte Figur — absolut auf dem Banner, nur Glow, keine Box */
function HeroFigure({ avatarUrl, initials }: { avatarUrl: string; initials: string }) {
  const hasPhoto = avatarUrl.length > 0;
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const showPhoto = hasPhoto && !photoFailed;

  if (!showPhoto) {
    return (
      <span
        className="pointer-events-none absolute bottom-3 right-3 z-[2] font-black uppercase leading-none text-white/25 [text-shadow:0_0_40px_rgba(220,38,38,0.35)] text-[clamp(2.5rem,14vw,3.75rem)]"
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <>
      <div
        className="pointer-events-none absolute bottom-[4%] right-[4%] z-[1] h-[82%] w-[46%] max-w-[10.5rem] bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.38)_0%,rgba(140,20,35,0.14)_45%,transparent_70%)] blur-2xl sm:max-w-[12.5rem]"
        aria-hidden
      />
      <img
        src={avatarUrl}
        alt=""
        className="pointer-events-none absolute bottom-0 right-0 z-[2] max-h-[7.75rem] w-auto max-w-[48%] bg-transparent object-contain object-bottom drop-shadow-[0_12px_32px_rgba(0,0,0,0.6),0_4px_14px_rgba(0,0,0,0.4)] sm:max-h-[9.5rem] sm:max-w-[46%]"
        onError={() => setPhotoFailed(true)}
      />
    </>
  );
}

export const ProfileHeroCard: React.FC<Props> = ({
  watermark,
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  avatarUrl,
  initials,
  showTacticalBoard = false,
}) => {
  return (
    <div className="relative mb-4 min-h-[11.5rem] w-full overflow-hidden rounded-2xl border border-red-500/30 bg-[#0a0608] shadow-[0_12px_48px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-h-[12.5rem]">
      <StadiumAtmosphere />
      {showTacticalBoard ? <TacticalBoardOverlay /> : null}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-[-0.08em] z-[1] select-none overflow-hidden px-2 font-black leading-[0.76] tracking-tighter"
        style={WATERMARK_STYLE}
        aria-hidden
      >
        {watermark}
      </div>

      <HeroFigure avatarUrl={avatarUrl} initials={initials} />

      <div className="relative z-[2] flex min-h-[11.5rem] flex-col justify-end px-3 pb-3.5 pt-3 sm:min-h-[12.5rem] sm:px-4 sm:pb-4 sm:pt-3.5">
        <div className="max-w-[58%] pb-0.5 pr-[42%] text-left sm:max-w-[56%]">
          <p className="break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.9)] text-[clamp(1rem,4vw,1.55rem)]">
            {firstNameLine}
          </p>
          {lastNameLine ? (
            <p className="mt-0.5 break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7),0_0_1px_rgba(0,0,0,0.9)] text-[clamp(1rem,4vw,1.55rem)]">
              {lastNameLine}
            </p>
          ) : null}
          <p className="mt-1.5 line-clamp-2 break-words text-[13px] font-medium leading-snug text-white/78 sm:text-[14px]">
            {teamSeasonLabel}
          </p>
        </div>
      </div>
    </div>
  );
};
