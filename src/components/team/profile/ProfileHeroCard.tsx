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
import { TrainerProfileHeroCard } from "./TrainerProfileHeroCard";

/**
 * Profil-Hero Router — Spieler: Sammelkarte | Trainer: eigenes Modul.
 */

export type ProfileHeroVariant = "trainer" | "player";

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

function splitPlayerTeamHeader(teamLine: string): { ageGroup: string; club: string } {
  const trimmed = teamLine.trim();
  if (!trimmed) return { ageGroup: "", club: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && /^U\d+/i.test(parts[0])) {
    return {
      ageGroup: parts[0].toUpperCase(),
      club: parts.slice(1).join(" ").toUpperCase(),
    };
  }
  return { ageGroup: "", club: trimmed.toUpperCase() };
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

function PlayerStadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.72] brightness-[0.58] contrast-[1.12]"
        style={{
          backgroundImage: `url(${photoBgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center 35%",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28)_0%,rgba(0,0,0,0.52)_55%,rgba(0,0,0,0.78)_100%)]" />
      <div className="absolute inset-y-0 right-0 w-[58%] bg-[radial-gradient(ellipse_95%_85%_at_100%_42%,rgba(229,9,20,0.34)_0%,rgba(139,13,18,0.16)_38%,transparent_72%)]" />
      <div className="absolute bottom-0 right-0 h-[88%] w-[48%] bg-[radial-gradient(ellipse_70%_60%_at_85%_90%,rgba(229,9,20,0.22)_0%,transparent_68%)] blur-sm" />
      <div className="absolute -right-4 top-[8%] h-[55%] w-[42%] rotate-[-8deg] bg-[linear-gradient(135deg,rgba(229,9,20,0.14)_0%,transparent_62%)] blur-md" />
      <div className="absolute right-[6%] top-[18%] h-[38%] w-[28%] rounded-full bg-[radial-gradient(circle,rgba(229,9,20,0.12)_0%,transparent_72%)] blur-xl" />
      <PlayerFloodlightBeams />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_105%_95%_at_48%_38%,transparent_38%,rgba(0,0,0,0.32)_82%,rgba(0,0,0,0.72)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

function PlayerFloodlightBeams() {
  return (
    <div className="opacity-[0.32]">
      <div className="absolute -left-4 top-0 h-[78%] w-[36%] origin-top-left -skew-x-[5deg] bg-[linear-gradient(168deg,rgba(255,252,248,0.26)_0%,transparent_68%)] blur-[1px]" />
      <div className="absolute right-0 top-0 h-[80%] w-[38%] origin-top-right skew-x-[5deg] bg-[linear-gradient(195deg,rgba(255,252,248,0.24)_0%,transparent_65%)] blur-[1px]" />
      <div className="absolute left-[32%] top-0 h-24 w-24 rounded-full bg-white/[0.12] blur-3xl" />
      <div className="absolute right-[18%] top-0 h-20 w-20 rounded-full bg-white/[0.1] blur-2xl" />
    </div>
  );
}

function PlayerJerseyNumber({ number }: { number: string }) {
  return (
    <div
      className="pointer-events-none relative z-[2] select-none font-black tabular-nums leading-none tracking-[-0.04em] text-white/[0.82]"
      style={{
        fontSize: "clamp(5.5rem, 28vw, 8.4375rem)",
        textShadow: "0 2px 18px rgba(0,0,0,0.65), 0 0 24px rgba(255,255,255,0.08)",
        WebkitMaskImage: "linear-gradient(180deg, black 0%, black 78%, rgba(0,0,0,0.45) 100%)",
        maskImage: "linear-gradient(180deg, black 0%, black 78%, rgba(0,0,0,0.45) 100%)",
      }}
      aria-hidden
    >
      {number}
    </div>
  );
}

function PlayerClubLogoBadge({ logoUrl }: { logoUrl: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (!logoUrl || failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-3 top-2.5 z-[2] h-[3.625rem] w-[3.625rem] opacity-[0.85] sm:right-3.5 sm:h-[4.25rem] sm:w-[4.25rem]"
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full bg-white/[0.08] blur-lg" />
      <img
        src={logoUrl}
        alt=""
        className="relative h-full w-full object-contain object-right-top drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function PlayerHeroTextStack({
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  teamName,
  roleLabel,
  jerseyNumber,
}: Pick<Props, "firstNameLine" | "lastNameLine" | "teamSeasonLabel" | "teamName" | "roleLabel"> & {
  jerseyNumber: string;
}) {
  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const teamLine = (teamName ?? "").trim() || parsed.team;
  const { ageGroup, club } = splitPlayerTeamHeader(teamLine);
  const position = (roleLabel ?? "").trim().toUpperCase();

  return (
    <div className="relative z-[4] flex h-full min-w-0 max-w-[46%] flex-1 flex-col py-2.5 pl-1 pr-0.5 sm:max-w-[44%]">
      {teamLine ? (
        <p className="text-[10px] font-extrabold uppercase leading-tight tracking-[0.1em] sm:text-[11px]">
          {ageGroup ? (
            <>
              <span className="text-[#E50914]">{ageGroup}</span>
              <span className="text-white/90"> </span>
            </>
          ) : null}
          <span className="text-white/88">{club || teamLine.toUpperCase()}</span>
          <span className="text-[#E50914]/80"> ////</span>
        </p>
      ) : null}

      <div className="mt-0.5">
        <PlayerJerseyNumber number={jerseyNumber} />
        {position ? (
          <p className="-mt-0.5 text-[11px] font-extrabold uppercase italic tracking-[0.12em] text-[#E50914] sm:text-[12px]">
            {position}
          </p>
        ) : null}
      </div>

      <div className="mt-auto pb-1 pt-3">
        {firstNameLine ? (
          <p className="font-black uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] text-[clamp(1.05rem,4.4vw,1.65rem)]">
            {firstNameLine}
          </p>
        ) : null}
        {lastNameLine ? (
          <p className="font-black uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] text-[clamp(1.05rem,4.4vw,1.65rem)]">
            {lastNameLine}
          </p>
        ) : null}
      </div>
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
      <div className="relative h-[7.5rem] w-[7.5rem] overflow-hidden rounded-2xl border border-[#161616]/70 bg-[#0A0A0A]/85 sm:h-[8rem] sm:w-[8rem]">
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

function PlayerCutoutLayer({
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
      className={`pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[3] transition-opacity duration-300 ${
        visible && loaded ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div
        className="absolute bottom-[6%] right-[4%] h-[55%] w-[42%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,transparent_70%)] blur-2xl"
        aria-hidden
      />
      <img
        src={cutoutSrc}
        alt=""
        className="absolute bottom-0 right-[-3%] h-[114%] max-h-none w-auto max-w-[64%] object-contain object-right-bottom sm:max-w-[60%]"
        style={{
          filter: "drop-shadow(0 4px 28px rgba(0,0,0,0.55)) drop-shadow(0 0 24px rgba(255,255,255,0.12))",
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

function PlayerProfileHeroCard(props: Props) {
  const {
    watermark,
    firstNameLine,
    lastNameLine,
    teamSeasonLabel,
    teamName,
    roleLabel,
    photoUrl,
    cutoutUrl,
    initials,
  } = props;
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
    <div className="relative mb-3 aspect-[1.52/1] min-h-[15.3125rem] max-h-[16.875rem] w-full overflow-hidden rounded-[22px] border border-[#E50914]/35 bg-[#0A0A0A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_36px_rgba(0,0,0,0.52),0_0_48px_rgba(229,9,20,0.08)] sm:min-h-[16.5rem] sm:max-h-[18rem]">
      <PlayerStadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <PlayerClubLogoBadge logoUrl={clubLogoUrl} />

      {isCutoutLayout && cutoutSrc ? (
        <PlayerCutoutLayer
          cutoutSrc={cutoutSrc}
          visible={showCutoutImage}
          onLoad={() => setCutoutImageOk(true)}
          onError={() => setCutoutImageOk(false)}
        />
      ) : null}

      <div className="relative flex h-full min-h-0 items-stretch justify-between gap-0 px-3 pb-2 pt-2.5 sm:px-4 sm:pb-2.5">
        <PlayerHeroTextStack
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          teamSeasonLabel={teamSeasonLabel}
          teamName={teamName}
          roleLabel={roleLabel}
          jerseyNumber={watermark}
        />

        <div className="relative z-[1] w-[50%] max-w-[13.5rem] shrink-0 sm:max-w-[14rem]" aria-hidden>
          {!isCutoutLayout || showAvatarFallback ? (
            <HeroAvatarInSlot photoUrl={photoUrl} initials={initials} visible />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const ProfileHeroCard: React.FC<Props> = (props) => {
  if (props.variant === "player") {
    return <PlayerProfileHeroCard {...props} />;
  }
  const { variant: _variant, ...trainerProps } = props;
  return <TrainerProfileHeroCard {...trainerProps} />;
};
