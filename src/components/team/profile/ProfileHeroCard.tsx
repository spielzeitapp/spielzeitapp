import React from "react";

const WATERMARK_STYLE: React.CSSProperties = {
  fontSize: "clamp(4.75rem, 30vw, 8.5rem)",
  color: "rgba(180, 28, 45, 0.24)",
  WebkitTextStroke: "1px rgba(220, 38, 38, 0.35)",
  textShadow:
    "0 0 40px rgba(180, 28, 45, 0.35), 0 2px 0 rgba(0,0,0,0.4), 1px 1px 0 rgba(220, 38, 38, 0.2)",
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_-10%,rgba(220,38,38,0.55)_0%,transparent_52%),radial-gradient(ellipse_55%_70%_at_0%_50%,rgba(140,20,35,0.45)_0%,transparent_50%),radial-gradient(ellipse_55%_70%_at_100%_50%,rgba(140,20,35,0.42)_0%,transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,transparent_40%),linear-gradient(135deg,rgba(80,12,20,0.35)_0%,transparent_45%,rgba(80,12,20,0.28)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 bg-[repeating-linear-gradient(90deg,transparent,transparent_48px,rgba(255,255,255,0.02)_48px,rgba(255,255,255,0.02)_49px)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute left-[6%] top-0 h-24 w-24 rounded-full bg-white/[0.12] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-[4%] top-1 h-20 w-28 rounded-full bg-red-400/[0.14] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-16 w-[70%] -translate-x-1/2 rounded-full bg-red-600/[0.12] blur-2xl" aria-hidden />
    </>
  );
}

function TacticalBoardOverlay() {
  return (
    <svg
      className="pointer-events-none absolute right-0 top-0 h-full w-[58%] text-white/[0.09]"
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

const AVATAR_FRAME_CLASS =
  "relative h-[6.75rem] w-[6.75rem] rounded-2xl p-[2px] shadow-[0_0_28px_rgba(220,38,38,0.7),0_0_56px_rgba(239,68,68,0.38),0_8px_24px_rgba(0,0,0,0.55)] bg-gradient-to-br from-red-400 via-red-600 to-red-900 sm:h-[8.75rem] sm:w-[8.75rem]";

const AVATAR_INNER_CLASS =
  "h-full w-full rounded-[14px] border border-red-400/40 object-cover shadow-[inset_0_0_12px_rgba(0,0,0,0.35)]";

export const ProfileHeroCard: React.FC<Props> = ({
  watermark,
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  avatarUrl,
  initials,
  showTacticalBoard = false,
}) => {
  const hasPhoto = avatarUrl.length > 0;

  return (
    <div className="relative mb-4 min-h-[11.5rem] w-full overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-br from-red-950/70 via-[#1a080c]/90 to-black px-3 py-3.5 shadow-[0_12px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-[13rem] sm:py-4">
      <StadiumAtmosphere />
      {showTacticalBoard ? <TacticalBoardOverlay /> : null}
      <div
        className="pointer-events-none absolute -left-2 bottom-[-0.15em] select-none font-black leading-[0.78] tracking-tighter"
        style={WATERMARK_STYLE}
        aria-hidden
      >
        {watermark}
      </div>
      <div className="relative z-[1] flex items-end justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1 pb-0.5 text-left">
          <p className="break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.55)] text-[clamp(1.05rem,4.2vw,1.65rem)]">
            {firstNameLine}
          </p>
          {lastNameLine ? (
            <p className="mt-0.5 break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.55)] text-[clamp(1.05rem,4.2vw,1.65rem)]">
              {lastNameLine}
            </p>
          ) : null}
          <p className="mt-2 max-w-[14rem] break-words text-[14px] font-medium leading-snug text-white/75">
            {teamSeasonLabel}
          </p>
        </div>
        <div className="relative shrink-0">
          <div className="absolute inset-0 scale-125 rounded-2xl bg-red-500/55 blur-3xl" aria-hidden />
          <div className={AVATAR_FRAME_CLASS}>
            {hasPhoto ? (
              <img
                src={avatarUrl}
                alt=""
                className={AVATAR_INNER_CLASS}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="flex h-full w-full items-center justify-center rounded-[14px] bg-zinc-900 text-2xl font-black text-white"
              style={{ display: hasPhoto ? "none" : "flex" }}
            >
              {initials}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
