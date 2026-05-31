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

/** Trainer-Profil-Hero — eigenständig, unabhängig vom Spieler-Sammelkarten-Layout. */

const HERO_HEIGHT_CLASS = "h-[14rem] sm:h-[15rem]";

const FIGURE_RESERVE_CLASS =
  "relative z-[2] h-full w-[52%] max-w-[21rem] shrink-0 sm:max-w-[22rem]";

export type TrainerProfileHeroCardProps = {
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
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.62] brightness-[0.64] contrast-[1.1]"
        style={{
          backgroundImage: `url(${photoBgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.48)_48%,rgba(0,0,0,0.68)_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[34%] bg-[radial-gradient(ellipse_90%_80%_at_0%_50%,rgba(0,0,0,0.32)_0%,transparent_80%)]" />
      <div className="absolute inset-y-0 right-0 w-[32%] bg-[radial-gradient(ellipse_85%_75%_at_100%_38%,rgba(0,0,0,0.24)_0%,transparent_78%)]" />
      <FloodlightBeams />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_92%_at_50%_40%,transparent_44%,rgba(0,0,0,0.28)_84%,rgba(0,0,0,0.62)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.42)_100%)]" />
    </div>
  );
}

function FloodlightBeams() {
  return (
    <div className="opacity-[0.24]">
      <div className="absolute -left-6 top-0 h-[72%] w-[34%] origin-top-left -skew-x-[6deg] bg-[linear-gradient(168deg,rgba(255,252,248,0.22)_0%,transparent_70%)] blur-[1px]" />
      <div className="absolute -right-6 top-0 h-[72%] w-[34%] origin-top-right skew-x-[6deg] bg-[linear-gradient(192deg,rgba(255,252,248,0.2)_0%,transparent_70%)] blur-[1px]" />
      <div className="absolute left-[38%] top-0 h-20 w-20 rounded-full bg-white/[0.1] blur-3xl" />
      <div className="absolute right-[22%] top-0 h-16 w-16 rounded-full bg-white/[0.08] blur-2xl" />
    </div>
  );
}

function HeroPrimaryWatermark({ watermark }: { watermark: string }) {
  return (
    <div
      className="pointer-events-none absolute right-[3%] top-1/2 z-[1] flex h-[92%] max-w-[min(82%,19rem)] -translate-y-1/2 select-none items-center justify-end overflow-visible font-black tracking-tighter sm:right-[4%]"
      aria-hidden
    >
      <span
        className="relative inline-block leading-[0.72] tracking-[-0.04em] text-[clamp(7.5rem,46vw,13.5rem)] text-[#E50914]/[0.11]"
        style={{
          textShadow: "0 0 48px rgba(229,9,20,0.16), 0 2px 24px rgba(0,0,0,0.45)",
          WebkitTextStroke: "1px rgba(139,13,18,0.22)",
          paintOrder: "stroke fill",
        }}
      >
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
      className="pointer-events-none absolute right-2 top-2 z-[2] h-[42%] w-[38%] max-w-[7rem] opacity-[0.09] sm:right-2.5 sm:max-w-[7.5rem]"
      style={{
        maskImage: "radial-gradient(ellipse 88% 82% at 100% 0%, black 38%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 88% 82% at 100% 0%, black 38%, transparent 92%)",
      }}
      aria-hidden
    >
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain object-right-top brightness-[1.8] contrast-[0.7] grayscale invert"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function HeroTextBlock({
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  teamName,
  roleLabel,
}: Pick<
  TrainerProfileHeroCardProps,
  "firstNameLine" | "lastNameLine" | "teamSeasonLabel" | "teamName" | "roleLabel"
>) {
  const fullName = [firstNameLine, lastNameLine].filter(Boolean).join(" ");
  const role = (roleLabel ?? "").trim().toUpperCase();
  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const teamLine = (teamName ?? "").trim() || parsed.team;
  const seasonLine = parsed.season;

  const nameClass =
    "line-clamp-2 whitespace-normal break-normal font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.75)] text-[clamp(1.05rem,4.2vw,1.65rem)]";
  const roleClass =
    "text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#E50914] sm:text-[12px]";
  const teamClass =
    "text-[11px] font-semibold uppercase leading-snug tracking-wide text-[#E6E6E6]/72 sm:text-[12px]";
  const seasonClass = "text-[11px] font-medium leading-snug text-[#E6E6E6]/38 sm:text-[12px]";

  return (
    <div className="relative z-[4] flex min-w-[40%] max-w-[52%] flex-1 flex-col justify-center gap-1 self-stretch py-3 pl-0.5 sm:min-w-[38%]">
      <p className={nameClass}>{fullName}</p>
      {role ? <p className={roleClass}>{role}</p> : null}
      {teamLine ? <p className={teamClass}>{teamLine}</p> : null}
      {seasonLine ? <p className={seasonClass}>{seasonLine}</p> : null}
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
      <div className="relative h-[6.5rem] w-[6.5rem] overflow-hidden rounded-2xl border border-[#161616]/70 bg-[#0A0A0A]/85 sm:h-[7rem] sm:w-[7rem]">
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
      className={`pointer-events-none absolute inset-y-0 right-0 z-[3] w-[56%] max-w-[22rem] transition-opacity duration-300 sm:max-w-[23rem] ${
        visible && loaded ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div
        className="absolute left-[50%] top-[8%] h-[42%] w-[68%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_72%)] blur-xl"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="absolute -right-[2%] top-[2%] h-[90%] w-auto max-w-none object-contain object-right object-top"
        style={{
          filter: "drop-shadow(0 0 20px rgba(255,255,255,0.1))",
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

export const TrainerProfileHeroCard: React.FC<TrainerProfileHeroCardProps> = ({
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
      className={`relative mb-3 w-full overflow-hidden rounded-xl border border-[#161616] bg-[#0A0A0A] shadow-[0_8px_28px_rgba(0,0,0,0.48)] ${HERO_HEIGHT_CLASS}`}
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
