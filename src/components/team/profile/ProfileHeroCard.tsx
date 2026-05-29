import React from "react";
import {
  hasCutoutUrl,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  resolveProfilePhotoSrc,
} from "../../../lib/profileHeroImage";

/**
 * Premium-Profil-Banner — zwei Layout-Modi:
 * - cutout: echte PNG-Freistellung (cutout_url)
 * - avatar: normales Foto im Neon-Rahmen (photo_url)
 */

const WATERMARK_STYLE: React.CSSProperties = {
  fontSize: "clamp(5.5rem, 32vw, 10rem)",
  color: "rgba(122, 29, 42, 0.28)",
  WebkitTextStroke: "2px rgba(180, 28, 45, 0.45)",
  paintOrder: "stroke fill",
  textShadow:
    "0 0 48px rgba(180, 28, 45, 0.35), 0 3px 0 rgba(0,0,0,0.45), 2px 2px 0 rgba(140, 20, 35, 0.3)",
};

const NAME_TEXT_CLASS =
  "whitespace-normal break-normal font-black uppercase leading-tight tracking-tight text-white [overflow-wrap:normal] [word-break:normal] [text-shadow:0_2px_16px_rgba(0,0,0,0.75),0_0_1px_rgba(0,0,0,0.9)] text-[clamp(0.95rem,3.8vw,1.5rem)]";

const TEAM_TEXT_CLASS =
  "mt-1.5 line-clamp-2 whitespace-normal break-normal text-[13px] font-medium leading-snug text-white/78 [overflow-wrap:normal] [word-break:normal] sm:text-[14px]";

type Props = {
  watermark: string;
  firstNameLine: string;
  lastNameLine: string;
  teamSeasonLabel: string;
  photoUrl?: string | null;
  cutoutUrl?: string | null;
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

function HeroTextBlock({
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
}: Pick<Props, "firstNameLine" | "lastNameLine" | "teamSeasonLabel">) {
  const fullName = [firstNameLine, lastNameLine].filter(Boolean).join(" ");

  return (
    <div className="relative z-[3] min-w-[46%] max-w-[62%] flex-1 pb-0.5">
      <p className={`line-clamp-2 ${NAME_TEXT_CLASS}`}>{fullName}</p>
      <p className={TEAM_TEXT_CLASS}>{teamSeasonLabel}</p>
    </div>
  );
}

/** Mode B: Premium-Avatar im Flex-Layout (normales Foto oder Initialen). */
function HeroAvatarFrame({
  photoUrl,
  initials,
}: {
  photoUrl?: string | null;
  initials: string;
}) {
  const photoSrc = resolveProfilePhotoSrc(photoUrl);
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const showPhoto = Boolean(photoSrc) && !photoFailed;

  return (
    <div className="relative z-[2] shrink-0 self-end">
      <div className="absolute inset-0 scale-110 rounded-2xl bg-red-500/45 blur-2xl" aria-hidden />
      <div className="relative h-[6.5rem] w-[6.5rem] rounded-2xl bg-gradient-to-br from-red-400 via-red-600 to-red-900 p-[2px] shadow-[0_0_28px_rgba(220,38,38,0.65),0_0_48px_rgba(239,68,68,0.32),0_8px_24px_rgba(0,0,0,0.5)] sm:h-[7.75rem] sm:w-[7.75rem]">
        {showPhoto ? (
          <img
            src={photoSrc!}
            alt=""
            className="h-full w-full rounded-[14px] border border-red-400/40 object-cover object-top shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-gradient-to-b from-zinc-800 to-zinc-950 text-xl font-black text-white sm:text-2xl">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

/** Mode A: Freigestellte PNG — nur bei cutout_url. */
function HeroCutoutFigure({
  cutoutSrc,
  onLoadError,
}: {
  cutoutSrc: string;
  onLoadError: () => void;
}) {
  return (
    <div className="relative z-[2] h-[7.5rem] w-[7.5rem] shrink-0 self-end sm:h-[9.25rem] sm:w-[9.5rem]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.38)_0%,rgba(140,20,35,0.12)_50%,transparent_72%)] blur-2xl"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="relative z-[1] h-full w-full object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
        onError={onLoadError}
      />
    </div>
  );
}

export const ProfileHeroCard: React.FC<Props> = ({
  watermark,
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  photoUrl,
  cutoutUrl,
  initials,
  showTacticalBoard = false,
}) => {
  const cutoutSrc = hasCutoutUrl(cutoutUrl) ? resolveProfileCutoutSrc(cutoutUrl) : null;
  const [cutoutLoadOk, setCutoutLoadOk] = React.useState(true);
  const layoutMode = profileHeroLayoutMode(cutoutUrl, cutoutLoadOk && Boolean(cutoutSrc));

  const watermarkPositionClass =
    layoutMode === "cutout"
      ? "left-0 max-w-[72%] bottom-[-0.06em]"
      : "left-0 max-w-[58%] bottom-[-0.08em]";

  return (
    <div className="relative mb-4 min-h-[11.5rem] w-full overflow-hidden rounded-2xl border border-red-500/30 bg-[#0a0608] shadow-[0_12px_48px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-h-[12.5rem]">
      <StadiumAtmosphere />
      {showTacticalBoard ? <TacticalBoardOverlay /> : null}

      <div
        className={`pointer-events-none absolute z-[1] select-none overflow-hidden px-2 font-black leading-[0.76] tracking-tighter ${watermarkPositionClass}`}
        style={WATERMARK_STYLE}
        aria-hidden
      >
        {watermark}
      </div>

      <div className="relative z-[2] flex min-h-[11.5rem] items-end justify-between gap-2 px-3 pb-3.5 pt-3 sm:min-h-[12.5rem] sm:gap-3 sm:px-4 sm:pb-4 sm:pt-3.5">
        <HeroTextBlock
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          teamSeasonLabel={teamSeasonLabel}
        />

        {layoutMode === "cutout" && cutoutSrc ? (
          <HeroCutoutFigure cutoutSrc={cutoutSrc} onLoadError={() => setCutoutLoadOk(false)} />
        ) : (
          <HeroAvatarFrame photoUrl={photoUrl} initials={initials} />
        )}
      </div>
    </div>
  );
};
