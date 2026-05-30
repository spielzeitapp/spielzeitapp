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
 * Premium-Profil-Banner — gemeinsame Designfamilie Trainer / Spieler.
 * Wasserzeichen: weiß, grunge, 16–20 % | Stadion: Nacht + Flutlicht | Logo: monochrom dezent
 */

export type ProfileHeroVariant = "trainer" | "player";

const HERO_HEIGHT = "min-h-[13rem] sm:min-h-[14rem]";

/** SVG-Rauschen für Grunge-Textur auf TR / Nummer */
const GRUNGE_NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const NAME_TEXT_CLASS =
  "whitespace-normal break-normal font-black uppercase leading-[1.05] tracking-tight text-[#E6E6E6] [overflow-wrap:normal] [word-break:normal] [text-shadow:0_2px_20px_rgba(0,0,0,0.92),0_0_1px_rgba(0,0,0,0.95)] text-[clamp(0.95rem,3.6vw,1.45rem)]";

const ROLE_TEXT_CLASS =
  "mt-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#E50914] [text-shadow:0_1px_8px_rgba(0,0,0,0.8)] sm:text-[12px]";

const TEAM_TEXT_CLASS =
  "mt-1 line-clamp-2 whitespace-normal break-normal text-[12px] font-medium leading-snug text-[#E6E6E6]/42 [overflow-wrap:normal] [word-break:normal] sm:text-[13px]";

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
  /** @deprecated */
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

/** z-0 — Premium-Stadionbild + dezente Overlays (Flutlicht im Asset sichtbar lassen) */
function StadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string | null }) {
  const hasPhoto = Boolean(photoBgUrl);

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {hasPhoto ? (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.84] brightness-[0.7] contrast-[1.06]"
          style={{
            backgroundImage: `url(${photoBgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center center",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A0A0A_0%,#121010_40%,#060606_100%)]" />
      )}
      <div
        className={`absolute inset-0 ${
          hasPhoto
            ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.34)_0%,rgba(2,2,4,0.48)_44%,rgba(0,0,0,0.68)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(6,6,8,0.78)_0%,rgba(2,2,4,0.92)_100%)]"
        }`}
      />
      <div className="absolute inset-y-0 left-0 w-[38%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(0,0,0,0.42)_0%,transparent_76%)]" />
      <div className="absolute inset-y-0 right-0 w-[36%] bg-[radial-gradient(ellipse_85%_75%_at_100%_38%,rgba(0,0,0,0.28)_0%,transparent_74%)]" />
      <FloodlightBeams subtle={hasPhoto} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_115%_105%_at_50%_50%,transparent_44%,rgba(0,0,0,0.32)_80%,rgba(0,0,0,0.68)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.48)_100%)]" />
    </div>
  );
}

function FloodlightBeams({ subtle = false }: { subtle?: boolean }) {
  return (
    <div className={subtle ? "opacity-[0.32]" : "opacity-100"}>
      <div className="absolute -left-8 top-0 h-[82%] w-[44%] origin-top-left -skew-x-[8deg] bg-[linear-gradient(168deg,rgba(255,252,245,0.28)_0%,rgba(255,250,240,0.12)_38%,transparent_74%)] blur-[0.5px]" />
      <div className="absolute -right-8 top-0 h-[82%] w-[44%] origin-top-right skew-x-[8deg] bg-[linear-gradient(192deg,rgba(255,252,245,0.26)_0%,rgba(255,250,240,0.11)_38%,transparent_74%)] blur-[0.5px]" />
      <div className="absolute left-[10%] top-0 h-28 w-28 rounded-full bg-white/[0.18] blur-3xl" />
      <div className="absolute right-[8%] top-0 h-28 w-28 rounded-full bg-white/[0.15] blur-3xl" />
      <div className="absolute left-[28%] top-0 h-20 w-24 rounded-full bg-white/[0.12] blur-2xl" />
      <div className="absolute left-1/2 top-0 h-20 w-40 -translate-x-1/2 rounded-full bg-white/[0.11] blur-2xl" />
    </div>
  );
}

/** Einheitliches Kaderkarten-Wasserzeichen — TR & Trikotnummer identisch */
function HeroPrimaryWatermark({ watermark }: { watermark: string }) {
  const isNumeric = /^\d+$/.test(watermark.trim());

  const textStyle: React.CSSProperties = {
    fontSize: "clamp(8.25rem, 50vw, 15rem)",
    color: "rgba(255,255,255,0.18)",
    WebkitTextStroke: "0.5px rgba(255,255,255,0.1)",
    paintOrder: "stroke fill",
    textShadow: "0 3px 18px rgba(0,0,0,0.4), 1px 1px 0 rgba(0,0,0,0.06)",
    lineHeight: 0.76,
    letterSpacing: isNumeric ? "-0.045em" : "-0.025em",
    fontVariantNumeric: isNumeric ? "tabular-nums" : undefined,
  };

  return (
    <div
      className="pointer-events-none absolute left-0 top-1/2 z-[1] flex h-[83%] max-w-[min(94%,21rem)] -translate-y-1/2 select-none items-center pl-1 font-black tracking-tighter sm:pl-1.5"
      aria-hidden
    >
      <span className="relative inline-block" style={textStyle}>
        {watermark}
        <span
          className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.42]"
          style={{ backgroundImage: GRUNGE_NOISE, backgroundSize: "120px 120px" }}
        />
      </span>
    </div>
  );
}

/** z-[1] — Vereinslogo rechts oben, monochrom, weich eingeblendet */
function ClubLogoWatermark({ logoUrl }: { logoUrl: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (!logoUrl || failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-1.5 top-1 z-[1] h-[42%] w-[38%] max-w-[6.5rem] opacity-[0.11] sm:right-2.5 sm:top-1.5 sm:max-w-[7rem]"
      style={{
        maskImage: "radial-gradient(ellipse 85% 80% at 100% 0%, black 35%, transparent 88%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 80% at 100% 0%, black 35%, transparent 88%)",
      }}
      aria-hidden
    >
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain object-right-top brightness-[1.45] contrast-[0.75] grayscale"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function HeroTextBlock({
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  roleLabel,
}: Pick<Props, "firstNameLine" | "lastNameLine" | "teamSeasonLabel" | "roleLabel">) {
  const fullName = [firstNameLine, lastNameLine].filter(Boolean).join(" ");
  const role = (roleLabel ?? "").trim().toUpperCase();

  return (
    <div className="relative z-[4] flex min-w-[44%] max-w-[56%] flex-1 flex-col justify-center self-stretch py-3 sm:min-w-[42%]">
      <p className={`line-clamp-2 ${NAME_TEXT_CLASS}`}>{fullName}</p>
      {role ? <p className={ROLE_TEXT_CLASS}>{role}</p> : null}
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
      <div className="relative h-[6rem] w-[6rem] overflow-hidden rounded-2xl border border-[#8B0D12]/35 bg-gradient-to-br from-[#161616] via-[#0A0A0A] to-black shadow-[0_8px_24px_rgba(0,0,0,0.55)] sm:h-[6.75rem] sm:w-[6.75rem]">
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

/** z-[2] — Freisteller groß, Kopf oben, weicher Auslauf unten */
function HeroCutoutFigure({
  cutoutSrc,
  onLoadError,
}: {
  cutoutSrc: string;
  onLoadError: () => void;
}) {
  return (
    <div className="pointer-events-none absolute -right-1 top-[-2%] z-[2] h-[134%] w-[64%] max-w-[15.5rem] bg-transparent sm:max-w-[19.25rem]">
      <div
        className="absolute left-1/2 top-[6%] h-[44%] w-[76%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09)_0%,rgba(255,248,240,0.03)_40%,transparent_74%)] blur-xl"
        aria-hidden
      />
      <div
        className="absolute bottom-[4%] left-1/2 h-[32%] w-[70%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.42)_0%,transparent_72%)] blur-lg"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="relative h-full w-full bg-transparent object-contain object-right object-top drop-shadow-[0_18px_40px_rgba(0,0,0,0.58)]"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
        }}
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

  const figureSpacerClass =
    isCutout && cutoutSrc ? "w-[50%] max-w-[15.5rem] shrink-0 sm:max-w-[19.25rem]" : "";

  return (
    <div
      className={`relative mb-3 w-full overflow-hidden rounded-xl border border-[#161616] bg-[#0A0A0A] shadow-[0_10px_36px_rgba(0,0,0,0.58)] ${HERO_HEIGHT}`}
    >
      <StadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroPrimaryWatermark watermark={watermark} />
      <ClubLogoWatermark logoUrl={clubLogoUrl} />

      {isCutout && cutoutSrc ? (
        <HeroCutoutFigure cutoutSrc={cutoutSrc} onLoadError={() => setCutoutLoadOk(false)} />
      ) : null}

      <div className={`relative flex ${HERO_HEIGHT} items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4`}>
        <HeroTextBlock
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
