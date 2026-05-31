import React from "react";
import {
  hasCutoutUrl,
  preloadProfileHeroImage,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  resolveProfilePhotoSrc,
} from "../../../lib/profileHeroImage";
import {
  PROFILE_HERO_STADIUM_BG,
  preloadProfileHeroStadiumBackground,
  probeProfileHeroStadiumBackground,
} from "../../../lib/profileHeroStadiumBg";
import { getClubLogo } from "../../../lib/teamLogos";

/**
 * Premium-Profil-Hero — eine Kartenserie für Trainer + Spieler.
 */

export type ProfileHeroVariant = "trainer" | "player";

const HERO_HEIGHT_CLASS = "h-[14rem] sm:h-[15rem]";

const FIGURE_RESERVE_CLASS =
  "relative z-[2] h-full w-[54%] max-w-[22rem] shrink-0 sm:max-w-[23rem]";

/** Grunge nur innerhalb der Nummer (background-clip) */
const GRUNGE_NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

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
  showTacticalBoard?: boolean;
};

if (typeof window !== "undefined") {
  preloadProfileHeroStadiumBackground();
}

function splitTeamSeasonLabel(label: string): { team: string; season: string } {
  const parts = label
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { team: parts[0], season: parts.slice(1).join(" · ") };
  }
  return { team: label.trim(), season: "" };
}

function useStadiumBackgroundUrl(): string {
  const [url, setUrl] = React.useState(PROFILE_HERO_STADIUM_BG);
  React.useEffect(() => {
    probeProfileHeroStadiumBackground((resolved) => {
      if (resolved) setUrl(resolved);
    });
  }, []);
  return url;
}

function useClubLogoUrl(teamName?: string | null): string | null {
  const name = (teamName ?? "").trim();
  if (!name) return null;
  return getClubLogo(name);
}

function useProfileHeroImagePreload(cutoutUrl?: string | null, photoUrl?: string | null): void {
  React.useEffect(() => {
    preloadProfileHeroImage(cutoutUrl);
    preloadProfileHeroImage(photoUrl);
  }, [cutoutUrl, photoUrl]);
}

function StadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.88] brightness-[0.8] contrast-[1.06]"
        style={{
          backgroundImage: `url(${photoBgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.28)_50%,rgba(0,0,0,0.48)_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[28%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(0,0,0,0.22)_0%,transparent_82%)]" />
      <div className="absolute inset-y-0 right-0 w-[30%] bg-[radial-gradient(ellipse_85%_75%_at_100%_35%,rgba(0,0,0,0.16)_0%,transparent_78%)]" />
      <FloodlightBeams />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_85%_at_50%_38%,transparent_52%,rgba(0,0,0,0.18)_88%,rgba(0,0,0,0.45)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[32%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.32)_100%)]" />
    </div>
  );
}

function FloodlightBeams() {
  return (
    <div className="opacity-[0.52]">
      <div className="absolute -left-8 top-0 h-[90%] w-[42%] origin-top-left -skew-x-[7deg] bg-[linear-gradient(168deg,rgba(255,253,250,0.38)_0%,rgba(255,250,245,0.16)_42%,transparent_78%)] blur-[0.5px]" />
      <div className="absolute -right-8 top-0 h-[90%] w-[42%] origin-top-right skew-x-[7deg] bg-[linear-gradient(192deg,rgba(255,253,250,0.36)_0%,rgba(255,250,245,0.15)_42%,transparent_78%)] blur-[0.5px]" />
      <div className="absolute left-1/2 top-0 h-36 w-36 -translate-x-1/2 rounded-full bg-white/[0.22] blur-3xl" />
      <div className="absolute left-[22%] top-0 h-28 w-28 rounded-full bg-white/[0.16] blur-3xl" />
      <div className="absolute right-[18%] top-0 h-28 w-28 rounded-full bg-white/[0.14] blur-3xl" />
    </div>
  );
}

/** TR / Nummer — Outline-Wasserzeichen, kein grauer Block */
function HeroPrimaryWatermark({ watermark, variant }: { watermark: string; variant: ProfileHeroVariant }) {
  const isNumeric = /^\d+$/.test(watermark.trim());
  const isPlayer = variant === "player" || isNumeric;

  const baseStyle: React.CSSProperties = {
    fontSize: isNumeric ? "clamp(9rem, 52vw, 16.5rem)" : "clamp(8.25rem, 48vw, 15.5rem)",
    color: "transparent",
    WebkitTextStroke: isPlayer ? "2px rgba(255,255,255,0.28)" : "2px rgba(255,255,255,0.26)",
    paintOrder: "stroke fill",
    textShadow: "none",
    lineHeight: 0.74,
    letterSpacing: isNumeric ? "-0.05em" : "-0.025em",
    fontVariantNumeric: isNumeric ? "tabular-nums" : undefined,
    opacity: isPlayer ? 0.16 : 0.14,
  };

  const grungeInsideStyle: React.CSSProperties | undefined = isPlayer
    ? {
        backgroundImage: GRUNGE_NOISE,
        backgroundSize: "120px 120px",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "rgba(255,255,255,0.04)",
        WebkitTextFillColor: "rgba(255,255,255,0.04)",
      }
    : undefined;

  return (
    <div
      className="pointer-events-none absolute -left-3 top-1/2 z-[1] flex h-[78%] max-w-[min(82%,19rem)] -translate-y-1/2 select-none items-center overflow-visible font-black tracking-tighter sm:-left-4"
      aria-hidden
    >
      <span className="relative inline-block" style={{ ...baseStyle, ...grungeInsideStyle }}>
        {watermark}
      </span>
    </div>
  );
}

function ClubLogoWatermark({ logoUrl }: { logoUrl: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (!logoUrl || failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-2 top-1.5 z-[2] h-[46%] w-[42%] max-w-[7.5rem] opacity-[0.11] sm:right-2.5 sm:top-2 sm:max-w-[8rem]"
      style={{
        maskImage: "radial-gradient(ellipse 88% 82% at 100% 0%, black 40%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 88% 82% at 100% 0%, black 40%, transparent 92%)",
      }}
      aria-hidden
    >
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain object-right-top brightness-[2] contrast-[0.65] grayscale invert"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** Einheitlicher Textblock — Spieler-Zielbild-Struktur für Trainer + Spieler */
function HeroTextBlock({
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  teamName,
  roleLabel,
}: Pick<Props, "firstNameLine" | "lastNameLine" | "teamSeasonLabel" | "teamName" | "roleLabel">) {
  const fullName = [firstNameLine, lastNameLine].filter(Boolean).join(" ");
  const role = (roleLabel ?? "").trim().toUpperCase();
  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const teamLine = (teamName ?? "").trim() || parsed.team;
  const seasonLine = parsed.season;

  return (
    <div className="relative z-[4] flex min-w-[40%] max-w-[52%] flex-1 flex-col justify-center gap-0.5 self-stretch py-3 pl-0.5 sm:min-w-[38%]">
      {teamLine ? (
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#E50914] sm:text-[11px]">
          {teamLine.toUpperCase()}
          <span className="text-white/50"> ////</span>
        </p>
      ) : null}
      {role ? (
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#E50914] sm:text-[12px]">
          {role}
        </p>
      ) : null}
      <p className="line-clamp-2 whitespace-normal break-normal font-black uppercase leading-[1.0] tracking-tight text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.85)] text-[clamp(1.1rem,4.8vw,1.75rem)]">
        {fullName}
      </p>
      {seasonLine ? (
        <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#E6E6E6]/40 sm:text-[13px]">
          {seasonLine}
        </p>
      ) : null}
    </div>
  );
}

function HeroAvatarInSlot({
  photoUrl,
  initials,
  visible,
}: {
  photoUrl?: string | null;
  initials: string;
  visible: boolean;
}) {
  const photoSrc = resolveProfilePhotoSrc(photoUrl);
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const showPhoto = visible && Boolean(photoSrc) && !photoFailed;

  return (
    <div
      className={`absolute inset-0 flex items-end justify-end pb-1 pr-0 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="relative h-[6.75rem] w-[6.75rem] overflow-hidden rounded-2xl border border-[#161616]/80 bg-[#0A0A0A]/90 sm:h-[7.25rem] sm:w-[7.25rem]">
        {showPhoto ? (
          <img
            src={photoSrc!}
            alt=""
            className="h-full w-full object-cover object-top"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-lg font-black text-white">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

/** Freisteller — Trainer 95 %, Spieler etwas größer, rechts, weißer Glow */
function HeroCutoutLayer({
  cutoutSrc,
  visible,
  variant,
  onLoad,
  onError,
}: {
  cutoutSrc: string;
  visible: boolean;
  variant: ProfileHeroVariant;
  onLoad: () => void;
  onError: () => void;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const heightClass = variant === "trainer" ? "h-[95%]" : "h-[102%]";

  React.useEffect(() => {
    setLoaded(false);
  }, [cutoutSrc]);

  return (
    <div
      className={`pointer-events-none absolute inset-y-0 right-0 z-[3] w-[60%] max-w-[23rem] transition-opacity duration-300 sm:max-w-[24rem] ${
        visible && loaded ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div
        className="absolute left-[48%] top-[4%] h-[50%] w-[72%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.05)_42%,transparent_74%)] blur-2xl"
        aria-hidden
      />
      <div
        className="absolute bottom-[4%] left-[52%] h-[22%] w-[58%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.22)_0%,transparent_72%)] blur-md"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className={`absolute -right-[4%] top-0 ${heightClass} w-auto max-w-none object-contain object-right object-top`}
        style={{
          filter: "drop-shadow(0 0 28px rgba(255,255,255,0.16))",
          maskImage: "linear-gradient(to bottom, black 0%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 88%, transparent 100%)",
        }}
        onLoad={() => {
          setLoaded(true);
          onLoad();
        }}
        onError={onError}
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
  const [cutoutImageOk, setCutoutImageOk] = React.useState(true);

  React.useEffect(() => {
    setCutoutImageOk(true);
  }, [cutoutUrl]);

  useProfileHeroImagePreload(cutoutUrl, photoUrl);

  const isCutoutLayout = profileHeroLayoutMode(cutoutUrl) === "cutout";
  const showCutoutImage = isCutoutLayout && cutoutImageOk && Boolean(cutoutSrc);
  const showAvatarFallback = !showCutoutImage;

  return (
    <div
      className={`relative mb-3 w-full overflow-hidden rounded-xl border border-[#161616] bg-[#0A0A0A] shadow-[0_10px_36px_rgba(0,0,0,0.52)] ${HERO_HEIGHT_CLASS}`}
    >
      <StadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroPrimaryWatermark watermark={watermark} variant={variant} />
      <ClubLogoWatermark logoUrl={clubLogoUrl} />

      {isCutoutLayout && cutoutSrc ? (
        <HeroCutoutLayer
          cutoutSrc={cutoutSrc}
          visible={showCutoutImage}
          variant={variant}
          onLoad={() => setCutoutImageOk(true)}
          onError={() => setCutoutImageOk(false)}
        />
      ) : null}

      <div
        className={`relative flex ${HERO_HEIGHT_CLASS} items-stretch justify-between gap-1 px-3 sm:gap-2 sm:px-4`}
      >
        <HeroTextBlock
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          teamSeasonLabel={teamSeasonLabel}
          teamName={teamName}
          roleLabel={roleLabel}
        />

        <div className={FIGURE_RESERVE_CLASS} aria-hidden>
          {isCutoutLayout ? (
            <HeroAvatarInSlot photoUrl={photoUrl} initials={initials} visible={showAvatarFallback} />
          ) : (
            <HeroAvatarInSlot photoUrl={photoUrl} initials={initials} visible />
          )}
        </div>
      </div>
    </div>
  );
};
