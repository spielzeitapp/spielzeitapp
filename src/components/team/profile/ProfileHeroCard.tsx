import React from "react";
import {
  hasCutoutUrl,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  resolveProfilePhotoSrc,
} from "../../../lib/profileHeroImage";
import { probeProfileHeroStadiumBackground } from "../../../lib/profileHeroStadiumBg";

/**
 * Premium-Profil-Banner
 * - cutout: PNG-Freistellung (cutout_url)
 * - avatar: normales Foto im Neon-Rahmen (photo_url)
 */

const NAME_TEXT_CLASS =
  "whitespace-normal break-normal font-black uppercase leading-tight tracking-tight text-white [overflow-wrap:normal] [word-break:normal] [text-shadow:0_2px_18px_rgba(0,0,0,0.85),0_0_1px_rgba(0,0,0,0.95)] text-[clamp(0.95rem,3.8vw,1.5rem)]";

const TEAM_TEXT_CLASS =
  "mt-1 line-clamp-2 whitespace-normal break-normal text-[13px] font-medium leading-snug text-white/82 [overflow-wrap:normal] [word-break:normal] sm:text-[14px]";

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

function useStadiumBackgroundUrl(): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => probeProfileHeroStadiumBackground(setUrl), []);
  return url;
}

function StadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string | null }) {
  const hasPhoto = Boolean(photoBgUrl);

  return (
    <>
      {hasPhoto ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${photoBgUrl})` }}
          aria-hidden
        />
      ) : null}
      <div
        className={`pointer-events-none absolute inset-0 ${
          hasPhoto
            ? "bg-[linear-gradient(180deg,rgba(8,4,6,0.55)_0%,rgba(12,6,10,0.72)_45%,rgba(6,4,6,0.88)_100%)]"
            : "bg-[linear-gradient(180deg,#0c0608_0%,#12080c_42%,#080406_100%)]"
        }`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(180deg,transparent_0%,rgba(6,14,10,0.18)_55%,rgba(4,8,6,0.28)_100%)]"
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-[38%] ${
          hasPhoto
            ? "bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(180,28,45,0.28)_0%,transparent_70%)]"
            : "bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(180,28,45,0.38)_0%,transparent_68%)]"
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-[38%] ${
          hasPhoto
            ? "bg-[radial-gradient(ellipse_90%_80%_at_100%_50%,rgba(160,24,40,0.24)_0%,transparent_70%)]"
            : "bg-[radial-gradient(ellipse_90%_80%_at_100%_50%,rgba(160,24,40,0.34)_0%,transparent_68%)]"
        }`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(255,255,255,0.1)_0%,transparent_55%)]"
        aria-hidden
      />
      <FloodlightBeams dimmed={hasPhoto} />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_90%_at_50%_50%,transparent_42%,rgba(0,0,0,0.45)_85%,rgba(0,0,0,0.7)_100%)]"
        aria-hidden
      />
    </>
  );
}

function FloodlightBeams({ dimmed }: { dimmed: boolean }) {
  const opacity = dimmed ? "opacity-60" : "opacity-100";
  return (
    <div className={opacity}>
      <div
        className="pointer-events-none absolute -left-6 top-0 h-[65%] w-[34%] origin-top-left -skew-x-6 bg-[linear-gradient(165deg,rgba(255,248,240,0.12)_0%,transparent_70%)] blur-[1px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 top-0 h-[65%] w-[34%] origin-top-right skew-x-6 bg-[linear-gradient(195deg,rgba(255,248,240,0.1)_0%,transparent_70%)] blur-[1px]"
        aria-hidden
      />
      <div className="pointer-events-none absolute left-[12%] top-0 h-16 w-16 rounded-full bg-white/[0.08] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-[10%] top-0 h-16 w-16 rounded-full bg-white/[0.06] blur-3xl" aria-hidden />
    </div>
  );
}

function TacticalBoardOverlay() {
  return (
    <svg
      className="pointer-events-none absolute right-0 top-0 z-[1] h-full w-[50%] text-white/[0.09]"
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

function HeroWatermark({ watermark, cutoutMode }: { watermark: string; cutoutMode: boolean }) {
  const style: React.CSSProperties = {
    fontSize: cutoutMode ? "clamp(6.5rem, 38vw, 11.5rem)" : "clamp(6rem, 34vw, 10.5rem)",
    color: "rgba(122, 29, 42, 0.3)",
    WebkitTextStroke: "2px rgba(180, 28, 45, 0.48)",
    paintOrder: "stroke fill",
    textShadow:
      "0 0 40px rgba(180, 28, 45, 0.38), 0 2px 0 rgba(0,0,0,0.45), 2px 2px 0 rgba(140, 20, 35, 0.32)",
    lineHeight: 0.82,
  };

  return (
    <div
      className="pointer-events-none absolute left-1 top-1/2 z-[1] max-w-[min(92%,20rem)] -translate-y-[46%] select-none font-black tracking-tighter"
      style={style}
      aria-hidden
    >
      {watermark}
    </div>
  );
}

function HeroTextBlock({
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
}: Pick<Props, "firstNameLine" | "lastNameLine" | "teamSeasonLabel">) {
  const fullName = [firstNameLine, lastNameLine].filter(Boolean).join(" ");

  return (
    <div className="relative z-[3] min-w-[46%] max-w-[62%] flex-1">
      <p className={`line-clamp-2 ${NAME_TEXT_CLASS}`}>{fullName}</p>
      <p className={TEAM_TEXT_CLASS}>{teamSeasonLabel}</p>
    </div>
  );
}

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
    <div className="relative z-[2] shrink-0">
      <div className="absolute inset-0 scale-110 rounded-2xl bg-red-500/40 blur-2xl" aria-hidden />
      <div className="relative h-[6.25rem] w-[6.25rem] rounded-2xl bg-gradient-to-br from-red-400 via-red-600 to-red-900 p-[2px] shadow-[0_0_24px_rgba(220,38,38,0.55),0_0_40px_rgba(239,68,68,0.28)] sm:h-[7.5rem] sm:w-[7.5rem]">
        {showPhoto ? (
          <img
            src={photoSrc!}
            alt=""
            className="h-full w-full rounded-[14px] border border-red-400/35 object-cover object-top"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-gradient-to-b from-zinc-800 to-zinc-950 text-lg font-black text-white sm:text-xl">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

function HeroCutoutFigure({
  cutoutSrc,
  onLoadError,
}: {
  cutoutSrc: string;
  onLoadError: () => void;
}) {
  return (
    <div className="relative z-[2] -mr-1 h-[8.25rem] w-[8.5rem] shrink-0 sm:h-[10.25rem] sm:w-[10.5rem]">
      <div
        className="pointer-events-none absolute bottom-[8%] left-1/2 z-0 h-[75%] w-[90%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.32)_0%,transparent_68%)] blur-2xl"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="relative z-[1] h-full w-full object-contain object-bottom drop-shadow-[0_14px_32px_rgba(0,0,0,0.5)]"
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
  const stadiumBgUrl = useStadiumBackgroundUrl();
  const cutoutSrc = hasCutoutUrl(cutoutUrl) ? resolveProfileCutoutSrc(cutoutUrl) : null;
  const [cutoutLoadOk, setCutoutLoadOk] = React.useState(true);
  const layoutMode = profileHeroLayoutMode(cutoutUrl, cutoutLoadOk && Boolean(cutoutSrc));
  const isCutout = layoutMode === "cutout";

  return (
    <div className="relative mb-4 min-h-[11.25rem] w-full overflow-hidden rounded-xl border border-red-500/15 bg-[#0a0608] shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:min-h-[12rem]">
      <StadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      {showTacticalBoard ? <TacticalBoardOverlay /> : null}
      <HeroWatermark watermark={watermark} cutoutMode={isCutout} />

      <div className="relative z-[2] flex min-h-[11.25rem] items-center justify-between gap-2 px-3 py-2.5 sm:min-h-[12rem] sm:gap-3 sm:px-4 sm:py-3">
        <HeroTextBlock
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          teamSeasonLabel={teamSeasonLabel}
        />

        {isCutout && cutoutSrc ? (
          <HeroCutoutFigure cutoutSrc={cutoutSrc} onLoadError={() => setCutoutLoadOk(false)} />
        ) : (
          <HeroAvatarFrame photoUrl={photoUrl} initials={initials} />
        )}
      </div>
    </div>
  );
};
