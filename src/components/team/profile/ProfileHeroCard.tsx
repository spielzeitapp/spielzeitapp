import React from "react";
import {
  hasCutoutUrl,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  resolveProfilePhotoSrc,
} from "../../../lib/profileHeroImage";
import { probeProfileHeroStadiumBackground } from "../../../lib/profileHeroStadiumBg";
import { getClubLogo } from "../../../lib/teamLogos";

/**
 * Premium-Profil-Banner — EA FC / Panini Card Look.
 * Trainer: weißes TR + Vereinslogo | Spieler: Trikotnummer + Vereinslogo
 */

export type ProfileHeroVariant = "trainer" | "player";

const HERO_HEIGHT = "min-h-[13rem] sm:min-h-[14rem]";

const NAME_TEXT_CLASS =
  "whitespace-normal break-normal font-black uppercase leading-[1.05] tracking-tight text-white [overflow-wrap:normal] [word-break:normal] [text-shadow:0_2px_20px_rgba(0,0,0,0.9),0_0_1px_rgba(0,0,0,0.95)] text-[clamp(0.95rem,3.6vw,1.45rem)]";

const ROLE_TEXT_CLASS =
  "mt-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-400/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.75)] sm:text-[12px]";

const TEAM_TEXT_CLASS =
  "mt-1 line-clamp-2 whitespace-normal break-normal text-[12px] font-medium leading-snug text-white/45 [overflow-wrap:normal] [word-break:normal] sm:text-[13px]";

type Props = {
  variant: ProfileHeroVariant;
  watermark: string;
  firstNameLine: string;
  lastNameLine: string;
  teamSeasonLabel: string;
  teamName?: string | null;
  roleLabel?: string | null;
  photoUrl?: string | null;
  cutoutUrl?: string | null;
  initials: string;
  /** @deprecated Taktiktafel entfernt */
  showTacticalBoard?: boolean;
};

function useStadiumBackgroundUrl(): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => probeProfileHeroStadiumBackground(setUrl), []);
  return url;
}

function useClubLogoUrl(teamName?: string | null): string | null {
  const name = (teamName ?? "").trim();
  if (!name) return null;
  return getClubLogo(name);
}

/** z-0 — dunkles Stadion, Flutlicht, Tiefe */
function StadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string | null }) {
  const hasPhoto = Boolean(photoBgUrl);

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {hasPhoto ? (
        <div
          className="absolute inset-0 scale-[1.03] bg-cover bg-center bg-no-repeat saturate-[0.72] brightness-[0.62]"
          style={{ backgroundImage: `url(${photoBgUrl})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#060406_0%,#0a080a_38%,#040304_100%)]" />
      )}
      <div
        className={`absolute inset-0 ${
          hasPhoto
            ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(2,2,4,0.68)_45%,rgba(0,0,0,0.82)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(4,4,6,0.72)_0%,rgba(2,2,4,0.88)_100%)]"
        }`}
      />
      <div className="absolute inset-y-0 left-0 w-[34%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(0,0,0,0.48)_0%,transparent_72%)]" />
      <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(ellipse_85%_75%_at_100%_40%,rgba(0,0,0,0.38)_0%,transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,255,255,0.06)_0%,transparent_62%)]" />
      <FloodlightBeams />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_110%_100%_at_50%_50%,transparent_42%,rgba(0,0,0,0.38)_82%,rgba(0,0,0,0.68)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

function FloodlightBeams() {
  return (
    <>
      <div className="absolute -left-6 top-0 h-[78%] w-[40%] origin-top-left -skew-x-[7deg] bg-[linear-gradient(168deg,rgba(255,250,240,0.22)_0%,rgba(255,248,235,0.08)_42%,transparent_72%)] blur-[0.5px]" />
      <div className="absolute -right-6 top-0 h-[78%] w-[40%] origin-top-right skew-x-[7deg] bg-[linear-gradient(192deg,rgba(255,250,240,0.2)_0%,rgba(255,248,235,0.07)_42%,transparent_72%)] blur-[0.5px]" />
      <div className="absolute left-[12%] top-0 h-24 w-24 rounded-full bg-white/[0.14] blur-3xl" />
      <div className="absolute right-[10%] top-0 h-24 w-24 rounded-full bg-white/[0.12] blur-3xl" />
      <div className="absolute left-1/2 top-0 h-16 w-32 -translate-x-1/2 rounded-full bg-white/[0.09] blur-2xl" />
    </>
  );
}

/** z-[1] — TR (Trainer) oder Trikotnummer (Spieler), ~75 % Hero-Höhe */
function HeroPrimaryWatermark({ variant, watermark }: { variant: ProfileHeroVariant; watermark: string }) {
  const isTrainer = variant === "trainer";
  const isNumeric = /^\d+$/.test(watermark.trim());

  const style: React.CSSProperties = isTrainer
    ? {
        fontSize: "clamp(7.5rem, 44vw, 13.5rem)",
        color: "rgba(255,255,255,0.14)",
        WebkitTextStroke: "1px rgba(255,255,255,0.24)",
        paintOrder: "stroke fill",
        textShadow: "0 2px 24px rgba(0,0,0,0.45)",
        lineHeight: 0.78,
      }
    : {
        fontSize: isNumeric
          ? "clamp(8rem, 48vw, 14.5rem)"
          : "clamp(7rem, 40vw, 12.5rem)",
        color: "rgba(255,255,255,0.20)",
        WebkitTextStroke: "1px rgba(255,255,255,0.18)",
        paintOrder: "stroke fill",
        textShadow: "0 4px 28px rgba(0,0,0,0.5)",
        lineHeight: 0.76,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.04em",
      };

  return (
    <div
      className="pointer-events-none absolute left-0 top-1/2 z-[1] flex h-[76%] max-w-[min(92%,20rem)] -translate-y-1/2 select-none items-center pl-1.5 font-black tracking-tighter sm:pl-2"
      style={style}
      aria-hidden
    >
      {watermark}
    </div>
  );
}

/** z-[1] — Vereinslogo rechts oben, monochrom dezent */
function ClubLogoWatermark({ logoUrl }: { logoUrl: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (!logoUrl || failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-2 top-1.5 z-[1] h-[36%] w-[34%] max-w-[5.25rem] opacity-[0.12] sm:right-3 sm:top-2 sm:max-w-[5.75rem]"
      aria-hidden
    >
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain object-right-top brightness-[1.4] contrast-[0.8] grayscale"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function HeroTextBlock({
  variant,
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  roleLabel,
}: Pick<Props, "variant" | "firstNameLine" | "lastNameLine" | "teamSeasonLabel" | "roleLabel">) {
  const fullName = [firstNameLine, lastNameLine].filter(Boolean).join(" ");
  const role = (roleLabel ?? "").trim();

  return (
    <div className="relative z-[4] flex min-w-[44%] max-w-[56%] flex-1 flex-col justify-center self-stretch py-3 sm:min-w-[42%]">
      <p className={`line-clamp-2 ${NAME_TEXT_CLASS}`}>{fullName}</p>
      {variant === "trainer" && role ? <p className={ROLE_TEXT_CLASS}>{role}</p> : null}
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
    <div className="relative z-[2] shrink-0 self-center bg-transparent">
      <div className="relative h-[6rem] w-[6rem] overflow-hidden rounded-2xl border border-red-950/50 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_0_10px_rgba(0,0,0,0.55),0_8px_22px_rgba(0,0,0,0.5)] sm:h-[6.75rem] sm:w-[6.75rem]">
        {showPhoto ? (
          <img
            src={photoSrc!}
            alt=""
            className="h-full w-full object-cover object-top"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950 text-lg font-black text-white sm:text-xl">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

/** z-[2] — Freigestellte Figur, groß, Kopf oben, dezenter Glow */
function HeroCutoutFigure({
  cutoutSrc,
  onLoadError,
}: {
  cutoutSrc: string;
  onLoadError: () => void;
}) {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-[2] h-[122%] w-[58%] max-w-[14rem] bg-transparent sm:max-w-[17.5rem]">
      <div
        className="absolute left-1/2 top-[8%] h-[42%] w-[72%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,rgba(255,248,240,0.04)_38%,transparent_72%)] blur-xl"
        aria-hidden
      />
      <div
        className="absolute bottom-[8%] left-1/2 h-[28%] w-[64%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,transparent_70%)] blur-md"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="relative h-full w-full bg-transparent object-contain object-right object-top drop-shadow-[0_16px_36px_rgba(0,0,0,0.55)]"
        onError={onLoadError}
      />
    </div>
  );
}

export const ProfileHeroCard: React.FC<Props> = ({
  variant,
  watermark,
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  teamName,
  roleLabel,
  photoUrl,
  cutoutUrl,
  initials,
}) => {
  const stadiumBgUrl = useStadiumBackgroundUrl();
  const clubLogoUrl = useClubLogoUrl(teamName);
  const cutoutSrc = hasCutoutUrl(cutoutUrl) ? resolveProfileCutoutSrc(cutoutUrl) : null;
  const [cutoutLoadOk, setCutoutLoadOk] = React.useState(true);
  const layoutMode = profileHeroLayoutMode(cutoutUrl, cutoutLoadOk && Boolean(cutoutSrc));
  const isCutout = layoutMode === "cutout";

  const figureSpacerClass = isCutout && cutoutSrc ? "w-[48%] max-w-[14rem] shrink-0 sm:max-w-[17.5rem]" : "";

  return (
    <div
      className={`relative mb-3 w-full overflow-hidden rounded-xl border border-red-950/35 bg-[#050406] shadow-[0_8px_32px_rgba(0,0,0,0.52)] ${HERO_HEIGHT}`}
    >
      <StadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroPrimaryWatermark variant={variant} watermark={watermark} />
      <ClubLogoWatermark logoUrl={clubLogoUrl} />

      {isCutout && cutoutSrc ? (
        <HeroCutoutFigure cutoutSrc={cutoutSrc} onLoadError={() => setCutoutLoadOk(false)} />
      ) : null}

      <div className={`relative flex ${HERO_HEIGHT} items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4`}>
        <HeroTextBlock
          variant={variant}
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          teamSeasonLabel={teamSeasonLabel}
          roleLabel={roleLabel}
        />

        {!isCutout || !cutoutSrc ? (
          <HeroAvatarFrame photoUrl={photoUrl} initials={initials} />
        ) : (
          <div className={figureSpacerClass} aria-hidden />
        )}
      </div>
    </div>
  );
};
