import React from "react";

const WATERMARK_CLASS =
  "pointer-events-none absolute -left-2 bottom-[-0.15em] select-none font-black leading-[0.78] tracking-tighter text-[rgba(122,29,42,0.18)]";

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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_75%_at_50%_0%,rgba(122,29,42,0.42)_0%,transparent_58%),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(0,0,0,0.55)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_35%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute left-[8%] top-0 h-20 w-20 rounded-full bg-white/[0.07] blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute right-[6%] top-2 h-16 w-24 rounded-full bg-white/[0.05] blur-2xl" aria-hidden />
    </>
  );
}

function TacticalBoardOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.06]"
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <circle cx="72" cy="52" r="28" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="248" cy="118" r="22" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M100 40 L180 95" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M200 70 L260 130" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M40 120 L120 80 L160 140" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <rect x="24" y="24" width="272" height="132" rx="8" stroke="currentColor" strokeWidth="0.8" fill="none" />
    </svg>
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
  const hasPhoto = avatarUrl.length > 0;

  return (
    <div className="relative mb-4 min-h-[11.5rem] w-full overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/55 via-black/60 to-black px-3 py-3.5 sm:min-h-[13rem] sm:py-4">
      <StadiumAtmosphere />
      {showTacticalBoard ? <TacticalBoardOverlay /> : null}
      <div className={WATERMARK_CLASS} style={{ fontSize: "clamp(4.75rem, 30vw, 8.5rem)" }} aria-hidden>
        {watermark}
      </div>
      <div className="relative flex items-end justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1 pb-0.5 text-left">
          <p className="break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] text-[clamp(1.05rem,4.2vw,1.65rem)]">
            {firstNameLine}
          </p>
          {lastNameLine ? (
            <p className="mt-0.5 break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] text-[clamp(1.05rem,4.2vw,1.65rem)]">
              {lastNameLine}
            </p>
          ) : null}
          <p className="mt-2 max-w-[14rem] break-words text-[14px] font-medium leading-snug text-white/70">
            {teamSeasonLabel}
          </p>
        </div>
        <div className="relative shrink-0">
          <div className="absolute inset-0 scale-110 rounded-2xl bg-red-500/45 blur-2xl" aria-hidden />
          <div className="relative h-[6.75rem] w-[6.75rem] sm:h-[8.75rem] sm:w-[8.75rem]">
            {hasPhoto ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full rounded-2xl border-2 border-red-500/50 object-cover shadow-[0_0_48px_rgba(239,68,68,0.45),0_0_1px_rgba(255,255,255,0.2)_inset]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-red-500/35 bg-zinc-800 text-2xl font-black text-white shadow-[0_0_32px_rgba(239,68,68,0.28)]"
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
