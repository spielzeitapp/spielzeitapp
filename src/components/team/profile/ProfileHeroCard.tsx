import React from "react";

/** Wasserzeichen: ~35 % größer, Vereinsrot 0.28–0.30 Opacity, stärkerer Stroke */
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

/** Dunkler Stadium-Base + seitliche Rot-Glows + Flutlicht + Vignette */
function StadiumAtmosphere() {
  return (
    <>
      {/* Nacht-Stadion-Basis */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0c0608_0%,#12080c_42%,#080406_100%)]"
        aria-hidden
      />
      {/* Dezente Spielfeld-Tiefe unten */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,transparent_0%,rgba(12,28,16,0.22)_55%,rgba(6,12,8,0.35)_100%)]"
        aria-hidden
      />
      {/* Roter Glow links/rechts — nicht flächig */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(180,28,45,0.38)_0%,transparent_68%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(ellipse_90%_80%_at_100%_50%,rgba(160,24,40,0.34)_0%,transparent_68%)]"
        aria-hidden
      />
      {/* Zentrales Flutlicht von oben */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-5%,rgba(255,255,255,0.11)_0%,transparent_58%)]"
        aria-hidden
      />
      <FloodlightBeams />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_105%_95%_at_50%_45%,transparent_35%,rgba(0,0,0,0.55)_88%,rgba(0,0,0,0.78)_100%)]"
        aria-hidden
      />
      {/* Feine Raster-Linien (Tribünen-Andeutung) */}
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
      className="pointer-events-none absolute right-0 top-0 z-[0] h-full w-[52%] text-white/[0.1]"
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
  "relative z-[1] h-[6.5rem] w-[6.5rem] shrink-0 rounded-2xl p-[2px] shadow-[0_0_32px_rgba(220,38,38,0.75),0_0_64px_rgba(239,68,68,0.42),0_8px_28px_rgba(0,0,0,0.6)] bg-gradient-to-br from-red-400 via-red-600 to-red-900 sm:h-[8.25rem] sm:w-[8.25rem]";

const AVATAR_INNER_CLASS =
  "h-full w-full rounded-[14px] border border-red-400/45 object-cover object-top shadow-[inset_0_0_16px_rgba(0,0,0,0.4)]";

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
    <div className="relative mb-4 min-h-[11.5rem] w-full overflow-hidden rounded-2xl border border-red-500/30 bg-[#0a0608] px-3 py-3.5 shadow-[0_12px_48px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-h-[12.5rem] sm:py-4">
      <StadiumAtmosphere />
      {showTacticalBoard ? <TacticalBoardOverlay /> : null}

      {/* Wasserzeichen hinter Inhalt */}
      <div
        className="pointer-events-none absolute -left-1 bottom-[-0.12em] z-[0] max-w-[88%] select-none overflow-hidden font-black leading-[0.76] tracking-tighter"
        style={WATERMARK_STYLE}
        aria-hidden
      >
        {watermark}
      </div>

      <div className="relative z-[1] flex items-end justify-between gap-2 sm:gap-3">
        <div className="relative z-[2] min-w-0 max-w-[58%] flex-1 pb-0.5 pr-1 text-left sm:max-w-[62%]">
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

        {/* Foto-Bereich: Glow verschmilzt mit Stadium */}
        <div className="relative shrink-0">
          <div
            className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.55)_0%,rgba(140,20,35,0.28)_45%,transparent_72%)] blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-2 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.35)_0%,transparent_65%)]"
            aria-hidden
          />
          <div className={AVATAR_FRAME_CLASS}>
            {hasPhoto ? (
              <img
                src={avatarUrl}
                alt=""
                className={`${AVATAR_INNER_CLASS} [mask-image:linear-gradient(180deg,#000_72%,rgba(0,0,0,0.88)_100%)]`}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="flex h-full w-full items-center justify-center rounded-[14px] bg-gradient-to-b from-zinc-800 to-zinc-950 text-xl font-black text-white sm:text-2xl"
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
