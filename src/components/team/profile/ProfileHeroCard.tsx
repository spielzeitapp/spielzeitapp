import React from "react";
import {
  hasCutoutUrl,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  resolveProfilePhotoSrc,
} from "../../../lib/profileHeroImage";
import { probeProfileHeroStadiumBackground } from "../../../lib/profileHeroStadiumBg";

/**
 * Premium-Profil-Banner — Stadion, Wasserzeichen, Person, Text.
 * cutout: PNG-Freistellung (cutout_url) | avatar: Neon-Rahmen (photo_url)
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
  /** @deprecated Taktiktafel entfernt — Prop bleibt für API-Kompatibilität */
  showTacticalBoard?: boolean;
};

function useStadiumBackgroundUrl(): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => probeProfileHeroStadiumBackground(setUrl), []);
  return url;
}

/** z-0 — Stadion + dezente Overlays */
function StadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string | null }) {
  const hasPhoto = Boolean(photoBgUrl);

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {hasPhoto ? (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${photoBgUrl})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0c0608_0%,#12080c_42%,#080406_100%)]" />
      )}
      <div
        className={`absolute inset-0 ${
          hasPhoto
            ? "bg-[linear-gradient(180deg,rgba(4,4,6,0.22)_0%,rgba(6,6,8,0.38)_50%,rgba(2,2,4,0.52)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(6,4,8,0.55)_0%,rgba(8,6,10,0.72)_100%)]"
        }`}
      />
      {hasPhoto ? (
        <div className="absolute inset-y-0 left-0 w-[28%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(0,0,0,0.35)_0%,transparent_72%)]" />
      ) : (
        <div className="absolute inset-y-0 left-0 w-[32%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(180,28,45,0.22)_0%,transparent_68%)]" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,rgba(255,255,255,0.14)_0%,transparent_58%)]" />
      <FloodlightBeams bright={hasPhoto} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_105%_95%_at_50%_50%,transparent_50%,rgba(0,0,0,0.32)_88%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

function FloodlightBeams({ bright }: { bright: boolean }) {
  return (
    <div className={bright ? "opacity-90" : "opacity-100"}>
      <div className="absolute -left-4 top-0 h-[70%] w-[36%] origin-top-left -skew-x-6 bg-[linear-gradient(165deg,rgba(255,248,240,0.16)_0%,transparent_68%)] blur-[1px]" />
      <div className="absolute -right-4 top-0 h-[70%] w-[36%] origin-top-right skew-x-6 bg-[linear-gradient(195deg,rgba(255,248,240,0.14)_0%,transparent_68%)] blur-[1px]" />
      <div className="absolute left-[14%] top-0 h-20 w-20 rounded-full bg-white/[0.11] blur-3xl" />
      <div className="absolute right-[12%] top-0 h-20 w-20 rounded-full bg-white/[0.09] blur-3xl" />
    </div>
  );
}

/** z-[1] — TR / Nummer hinter Figur */
function HeroWatermark({ watermark, cutoutMode }: { watermark: string; cutoutMode: boolean }) {
  const style: React.CSSProperties = {
    fontSize: cutoutMode ? "clamp(8.75rem, 51vw, 15.5rem)" : "clamp(8.1rem, 46vw, 14.2rem)",
    color: "rgba(122, 29, 42, 0.22)",
    WebkitTextStroke: "2px rgba(180, 28, 45, 0.4)",
    paintOrder: "stroke fill",
    textShadow: "0 0 32px rgba(180, 28, 45, 0.28), 0 2px 0 rgba(0,0,0,0.4)",
    lineHeight: 0.82,
  };

  return (
    <div
      className="pointer-events-none absolute left-0 top-1/2 z-[1] max-w-[min(96%,22rem)] -translate-y-1/2 select-none pl-2 font-black tracking-tighter"
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
    <div className="relative z-[4] min-w-[46%] max-w-[58%] flex-1 self-end pb-1">
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
    <div className="relative z-[2] shrink-0 self-end bg-transparent">
      <div className="relative h-[6.25rem] w-[6.25rem] rounded-2xl bg-gradient-to-br from-red-500/90 via-red-700/95 to-red-950 p-[2px] shadow-[0_0_16px_rgba(220,38,38,0.28),0_8px_24px_rgba(0,0,0,0.45)] sm:h-[7.5rem] sm:w-[7.5rem]">
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

/** z-[2] — Freigestellte Figur, +35 %, Kopf oben, darf unten leicht überragen */
function HeroCutoutFigure({
  cutoutSrc,
  onLoadError,
}: {
  cutoutSrc: string;
  onLoadError: () => void;
}) {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-[2] h-[112%] w-[54%] max-w-[12.5rem] bg-transparent sm:max-w-[15rem]">
      <div
        className="absolute left-1/2 top-[12%] h-[38%] w-[68%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.16)_0%,transparent_72%)] blur-lg"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="relative h-full w-full bg-transparent object-contain object-right object-top drop-shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
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
}) => {
  const stadiumBgUrl = useStadiumBackgroundUrl();
  const cutoutSrc = hasCutoutUrl(cutoutUrl) ? resolveProfileCutoutSrc(cutoutUrl) : null;
  const [cutoutLoadOk, setCutoutLoadOk] = React.useState(true);
  const layoutMode = profileHeroLayoutMode(cutoutUrl, cutoutLoadOk && Boolean(cutoutSrc));
  const isCutout = layoutMode === "cutout";

  const heroMinH = isCutout ? "min-h-[13.75rem] sm:min-h-[14.75rem]" : "min-h-[12rem] sm:min-h-[12.5rem]";

  return (
    <div
      className={`relative mb-5 w-full overflow-x-hidden overflow-y-visible rounded-xl border border-red-500/12 bg-[#0a0608] shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${heroMinH}`}
    >
      <StadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroWatermark watermark={watermark} cutoutMode={isCutout} />

      {isCutout && cutoutSrc ? (
        <HeroCutoutFigure cutoutSrc={cutoutSrc} onLoadError={() => setCutoutLoadOk(false)} />
      ) : null}

      <div
        className={`relative flex items-end justify-between gap-2 px-3 pb-3 pt-2 sm:gap-3 sm:px-4 sm:pb-3.5 sm:pt-2.5 ${heroMinH}`}
      >
        <HeroTextBlock
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          teamSeasonLabel={teamSeasonLabel}
        />

        {!isCutout || !cutoutSrc ? (
          <HeroAvatarFrame photoUrl={photoUrl} initials={initials} />
        ) : (
          <div className="w-[46%] max-w-[12.5rem] shrink-0 sm:max-w-[15rem]" aria-hidden />
        )}
      </div>
    </div>
  );
};
