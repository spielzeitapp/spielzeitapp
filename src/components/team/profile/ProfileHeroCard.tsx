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
 * Premium-Profil-Hero — Zielbild-Optik (Trainer + Spieler, eine Serie).
 */

export type ProfileHeroVariant = "trainer" | "player";

/** Einheitliche Hero-Höhe — Mobile First (iPhone SE+) */
const HERO_HEIGHT_CLASS = "h-[14rem] sm:h-[15rem]";

const FIGURE_RESERVE_CLASS =
  "relative z-[2] h-full w-[52%] max-w-[21rem] shrink-0 sm:max-w-[22rem]";

const GRUNGE_NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.65'/%3E%3C/svg%3E\")";

const CONCRETE_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.35'/%3E%3C/svg%3E\")";

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
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.68] brightness-[0.56] contrast-[1.14]"
        style={{
          backgroundImage: `url(${photoBgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.52)_0%,rgba(4,4,6,0.62)_42%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[40%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(0,0,0,0.55)_0%,transparent_78%)]" />
      <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(ellipse_85%_75%_at_100%_35%,rgba(0,0,0,0.35)_0%,transparent_76%)]" />
      <FloodlightBeams />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_118%_108%_at_50%_42%,transparent_36%,rgba(0,0,0,0.38)_78%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

function FloodlightBeams() {
  return (
    <div className="opacity-[0.38]">
      <div className="absolute -left-10 top-0 h-[88%] w-[46%] origin-top-left -skew-x-[8deg] bg-[linear-gradient(168deg,rgba(255,252,248,0.32)_0%,rgba(255,250,242,0.14)_40%,transparent_76%)] blur-[0.5px]" />
      <div className="absolute -right-10 top-0 h-[88%] w-[46%] origin-top-right skew-x-[8deg] bg-[linear-gradient(192deg,rgba(255,252,248,0.3)_0%,rgba(255,250,242,0.13)_40%,transparent_76%)] blur-[0.5px]" />
      <div className="absolute left-[8%] top-0 h-32 w-32 rounded-full bg-white/[0.2] blur-3xl" />
      <div className="absolute right-[6%] top-0 h-32 w-32 rounded-full bg-white/[0.17] blur-3xl" />
      <div className="absolute left-[30%] top-0 h-24 w-28 rounded-full bg-white/[0.14] blur-2xl" />
      <div className="absolute left-1/2 top-0 h-24 w-44 -translate-x-1/2 rounded-full bg-white/[0.13] blur-2xl" />
    </div>
  );
}

/** TR / Trikotnummer — 85 % Hero-Höhe, weiß 18 %, Grunge */
function HeroPrimaryWatermark({ watermark }: { watermark: string }) {
  const isNumeric = /^\d+$/.test(watermark.trim());

  const textStyle: React.CSSProperties = {
    fontSize: isNumeric ? "clamp(9rem, 54vw, 17rem)" : "clamp(8.5rem, 50vw, 16rem)",
    color: "rgba(255,255,255,0.18)",
    WebkitTextStroke: "0.5px rgba(255,255,255,0.14)",
    paintOrder: "stroke fill",
    textShadow: "0 2px 12px rgba(0,0,0,0.35)",
    lineHeight: 0.74,
    letterSpacing: isNumeric ? "-0.05em" : "-0.03em",
    fontVariantNumeric: isNumeric ? "tabular-nums" : undefined,
  };

  return (
    <div
      className="pointer-events-none absolute left-0 top-1/2 z-[1] flex h-[85%] max-w-[min(96%,22rem)] -translate-y-1/2 select-none items-center overflow-visible pl-0.5 font-black tracking-tighter sm:pl-1"
      aria-hidden
    >
      <span className="relative inline-block" style={textStyle}>
        {watermark}
        <span
          className="pointer-events-none absolute inset-[-8%] mix-blend-overlay opacity-[0.5]"
          style={{ backgroundImage: GRUNGE_NOISE, backgroundSize: "140px 140px" }}
        />
        <span
          className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.35]"
          style={{ backgroundImage: CONCRETE_GRAIN, backgroundSize: "96px 96px" }}
        />
      </span>
    </div>
  );
}

function ClubLogoWatermark({ logoUrl }: { logoUrl: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (!logoUrl || failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-2 top-1.5 z-[2] h-[44%] w-[40%] max-w-[7.25rem] opacity-[0.11] sm:right-3 sm:top-2 sm:max-w-[7.75rem]"
      style={{
        maskImage: "radial-gradient(ellipse 88% 82% at 100% 0%, black 38%, transparent 90%)",
        WebkitMaskImage: "radial-gradient(ellipse 88% 82% at 100% 0%, black 38%, transparent 90%)",
      }}
      aria-hidden
    >
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain object-right-top brightness-[1.5] contrast-[0.72] grayscale"
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
  teamName,
  roleLabel,
}: Pick<Props, "variant" | "firstNameLine" | "lastNameLine" | "teamSeasonLabel" | "teamName" | "roleLabel">) {
  const fullName = [firstNameLine, lastNameLine].filter(Boolean).join(" ");
  const role = (roleLabel ?? "").trim().toUpperCase();
  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const teamLine = (teamName ?? "").trim() || parsed.team;
  const seasonLine = parsed.season;

  if (variant === "player") {
    return (
      <div className="relative z-[4] flex min-w-[42%] max-w-[54%] flex-1 flex-col justify-center gap-0.5 self-stretch py-3 pl-0.5 sm:min-w-[40%]">
        {teamLine ? (
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#E50914] sm:text-[11px]">
            {teamLine.toUpperCase()}
            <span className="text-white/55"> ////</span>
          </p>
        ) : null}
        {role ? (
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#E50914] sm:text-[12px]">
            {role}
          </p>
        ) : null}
        <p className="line-clamp-2 whitespace-normal break-normal font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_22px_rgba(0,0,0,0.92)] text-[clamp(1.05rem,4.4vw,1.6rem)]">
          {fullName}
        </p>
        {seasonLine ? (
          <p className="mt-1 text-[12px] font-medium leading-snug text-[#E6E6E6]/38 sm:text-[13px]">
            {seasonLine}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative z-[4] flex min-w-[42%] max-w-[54%] flex-1 flex-col justify-center gap-0.5 self-stretch py-3 pl-0.5 sm:min-w-[40%]">
      <p className="line-clamp-2 whitespace-normal break-normal font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_22px_rgba(0,0,0,0.92)] text-[clamp(1.05rem,4.4vw,1.6rem)]">
        {fullName}
      </p>
      {role ? (
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#E50914] sm:text-[12px]">
          {role}
        </p>
      ) : null}
      {teamLine ? (
        <p className="mt-0.5 text-[12px] font-semibold leading-snug text-[#E6E6E6]/62 sm:text-[13px]">
          {teamLine}
        </p>
      ) : null}
      {seasonLine ? (
        <p className="text-[12px] font-medium leading-snug text-[#E6E6E6]/38 sm:text-[13px]">{seasonLine}</p>
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
      className={`absolute inset-0 flex items-end justify-end pb-2 pr-0 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="relative h-[6.5rem] w-[6.5rem] overflow-hidden rounded-2xl border border-[#161616] bg-[#0A0A0A] sm:h-[7rem] sm:w-[7rem]">
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

/** Freisteller ~78 % Hero-Höhe, rechts, Kopf oben, weißer Glow */
function HeroCutoutLayer({
  cutoutSrc,
  visible,
  onLoad,
  onError,
}: {
  cutoutSrc: string;
  visible: boolean;
  onLoad: () => void;
  onError: () => void;
}) {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
  }, [cutoutSrc]);

  return (
    <div
      className={`pointer-events-none absolute inset-y-0 right-0 z-[3] w-[58%] max-w-[22rem] transition-opacity duration-300 sm:max-w-[23rem] ${
        visible && loaded ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div
        className="absolute left-[42%] top-[6%] h-[48%] w-[70%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.04)_45%,transparent_72%)] blur-2xl"
        aria-hidden
      />
      <div
        className="absolute bottom-[6%] left-[50%] h-[24%] w-[60%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.28)_0%,transparent_70%)] blur-lg"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="absolute right-[-2%] top-0 h-[98%] w-auto max-w-none object-contain object-right object-top"
        style={{
          filter: "drop-shadow(0 0 26px rgba(255,255,255,0.14))",
          maskImage: "linear-gradient(to bottom, black 0%, black 86%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 86%, transparent 100%)",
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
      className={`relative mb-3 w-full overflow-hidden rounded-xl border border-[#161616] bg-[#0A0A0A] shadow-[0_10px_36px_rgba(0,0,0,0.58)] ${HERO_HEIGHT_CLASS}`}
    >
      <StadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroPrimaryWatermark watermark={watermark} />
      <ClubLogoWatermark logoUrl={clubLogoUrl} />

      {isCutoutLayout && cutoutSrc ? (
        <HeroCutoutLayer
          cutoutSrc={cutoutSrc}
          visible={showCutoutImage}
          onLoad={() => setCutoutImageOk(true)}
          onError={() => setCutoutImageOk(false)}
        />
      ) : null}

      <div
        className={`relative flex ${HERO_HEIGHT_CLASS} items-stretch justify-between gap-1 px-3 sm:gap-2 sm:px-4`}
      >
        <HeroTextBlock
          variant={variant}
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
