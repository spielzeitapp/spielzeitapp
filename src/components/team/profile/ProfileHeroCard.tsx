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
 * Premium-Profil-Hero — Trainer: ruhige Kartenserie | Spieler: Sammelkarten-Zielbild.
 */

export type ProfileHeroVariant = "trainer" | "player";

const TRAINER_HERO_HEIGHT_CLASS = "h-[14rem] sm:h-[15rem]";

const TRAINER_FIGURE_RESERVE_CLASS =
  "relative z-[2] h-full w-[52%] max-w-[21rem] shrink-0 sm:max-w-[22rem]";

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

/** Trainer — Zielbild 2: ruhiges Stadion */
function TrainerStadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string }) {
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
      <TrainerFloodlightBeams />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_92%_at_50%_40%,transparent_44%,rgba(0,0,0,0.28)_84%,rgba(0,0,0,0.62)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.42)_100%)]" />
    </div>
  );
}

/** Spieler — Stadion-Nacht + Red Smoke rechts */
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
      <div className="absolute inset-y-0 right-0 w-[58%] bg-[radial-gradient(ellipse_95%_85%_at_100%_42%,rgba(229,9,20,0.42)_0%,rgba(139,13,18,0.22)_38%,transparent_72%)]" />
      <div className="absolute bottom-0 right-0 h-[88%] w-[48%] bg-[radial-gradient(ellipse_70%_60%_at_85%_90%,rgba(229,9,20,0.28)_0%,transparent_68%)] blur-sm" />
      <div className="absolute -right-4 top-[8%] h-[55%] w-[42%] rotate-[-8deg] bg-[linear-gradient(135deg,rgba(229,9,20,0.18)_0%,transparent_62%)] blur-md" />
      <PlayerFloodlightBeams />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_105%_95%_at_48%_38%,transparent_38%,rgba(0,0,0,0.32)_82%,rgba(0,0,0,0.72)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

function TrainerFloodlightBeams() {
  return (
    <div className="opacity-[0.24]">
      <div className="absolute -left-6 top-0 h-[72%] w-[34%] origin-top-left -skew-x-[6deg] bg-[linear-gradient(168deg,rgba(255,252,248,0.22)_0%,transparent_70%)] blur-[1px]" />
      <div className="absolute -right-6 top-0 h-[72%] w-[34%] origin-top-right skew-x-[6deg] bg-[linear-gradient(192deg,rgba(255,252,248,0.2)_0%,transparent_70%)] blur-[1px]" />
      <div className="absolute left-[38%] top-0 h-20 w-20 rounded-full bg-white/[0.1] blur-3xl" />
      <div className="absolute right-[22%] top-0 h-16 w-16 rounded-full bg-white/[0.08] blur-2xl" />
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

function TrainerPrimaryWatermark({ watermark }: { watermark: string }) {
  const style: React.CSSProperties = {
    fontSize: "clamp(8rem, 44vw, 14.5rem)",
    color: "transparent",
    WebkitTextStroke: "1px rgba(255,255,255,0.2)",
    paintOrder: "stroke fill",
    lineHeight: 0.76,
    letterSpacing: "-0.02em",
    opacity: 0.115,
  };

  return (
    <div
      className="pointer-events-none absolute left-[2%] top-1/2 z-[1] flex h-[76%] max-w-[min(78%,18rem)] -translate-y-1/2 select-none items-center font-black tracking-tighter sm:left-[3%]"
      aria-hidden
    >
      <span className="relative inline-block" style={style}>
        {watermark}
      </span>
    </div>
  );
}

function PlayerJerseyNumber({ number }: { number: string }) {
  return (
    <div
      className="pointer-events-none relative z-[2] select-none font-black tabular-nums leading-none tracking-[-0.05em] text-white/[0.85]"
      style={{
        fontSize: "clamp(7.5rem, 38vw, 10.625rem)",
        textShadow: "0 2px 28px rgba(0,0,0,0.55), 0 0 40px rgba(255,255,255,0.06)",
        WebkitMaskImage: "linear-gradient(180deg, black 0%, black 72%, rgba(0,0,0,0.55) 100%)",
        maskImage: "linear-gradient(180deg, black 0%, black 72%, rgba(0,0,0,0.55) 100%)",
      }}
      aria-hidden
    >
      {number}
    </div>
  );
}

function TrainerClubLogoWatermark({ logoUrl }: { logoUrl: string | null }) {
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

function PlayerClubLogoBadge({ logoUrl }: { logoUrl: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (!logoUrl || failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-2 top-2 z-[2] h-[38%] w-[34%] max-w-[6.5rem] opacity-[0.16] sm:right-3 sm:max-w-[7rem]"
      aria-hidden
    >
      <div className="absolute inset-0 rounded-full bg-white/[0.06] blur-xl" />
      <img
        src={logoUrl}
        alt=""
        className="relative h-full w-full object-contain object-right-top brightness-[2] contrast-[0.65] grayscale invert drop-shadow-[0_0_12px_rgba(255,255,255,0.12)]"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function TrainerTextBlock({
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
    <div className="relative z-[4] flex h-full min-w-0 max-w-[54%] flex-1 flex-col py-3 pl-1 pr-1 sm:max-w-[50%]">
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

      <div className="mt-1 flex min-h-0 flex-1 flex-col justify-center">
        <PlayerJerseyNumber number={jerseyNumber} />
        {position ? (
          <p className="-mt-1 text-[12px] font-extrabold uppercase italic tracking-[0.14em] text-[#E50914] sm:text-[13px]">
            {position}
          </p>
        ) : null}
      </div>

      <div className="mt-auto pb-0.5">
        {firstNameLine ? (
          <p className="font-black uppercase leading-[0.92] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] text-[clamp(1.15rem,4.8vw,1.75rem)]">
            {firstNameLine}
          </p>
        ) : null}
        {lastNameLine ? (
          <p className="font-black uppercase leading-[0.92] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] text-[clamp(1.15rem,4.8vw,1.75rem)]">
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
  large = false,
}: {
  photoUrl?: string | null;
  initials: string;
  visible: boolean;
  large?: boolean;
}) {
  const photoSrc = resolveProfilePhotoSrc(photoUrl);
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const showPhoto = visible && Boolean(photoSrc) && !photoFailed;
  const boxClass = large
    ? "h-[7.5rem] w-[7.5rem] sm:h-[8rem] sm:w-[8rem]"
    : "h-[6.5rem] w-[6.5rem] sm:h-[7rem] sm:w-[7rem]";

  return (
    <div
      className={`absolute inset-0 flex items-end justify-end pb-2 pr-0 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-[#161616]/70 bg-[#0A0A0A]/85 ${boxClass}`}
      >
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

function TrainerCutoutLayer({
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
        className="absolute bottom-0 right-0 h-[102%] max-h-none w-auto max-w-[58%] object-contain object-right-bottom sm:max-w-[56%]"
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

function TrainerProfileHeroCard(props: Props) {
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
    <div
      className={`relative mb-3 w-full overflow-hidden rounded-xl border border-[#161616] bg-[#0A0A0A] shadow-[0_8px_28px_rgba(0,0,0,0.48)] ${TRAINER_HERO_HEIGHT_CLASS}`}
    >
      <TrainerStadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <TrainerPrimaryWatermark watermark={watermark} />
      <TrainerClubLogoWatermark logoUrl={clubLogoUrl} />

      {isCutoutLayout && cutoutSrc ? (
        <TrainerCutoutLayer
          cutoutSrc={cutoutSrc}
          visible={showCutoutImage}
          onLoad={() => setCutoutImageOk(true)}
          onError={() => setCutoutImageOk(false)}
        />
      ) : null}

      <div
        className={`relative flex ${TRAINER_HERO_HEIGHT_CLASS} items-stretch justify-between gap-1 px-3 sm:gap-2 sm:px-4`}
      >
        <TrainerTextBlock
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          teamSeasonLabel={teamSeasonLabel}
          teamName={teamName}
          roleLabel={roleLabel}
        />

        <div className={TRAINER_FIGURE_RESERVE_CLASS} aria-hidden>
          {isCutoutLayout ? (
            <HeroAvatarInSlot photoUrl={photoUrl} initials={initials} visible={showAvatarFallback} />
          ) : (
            <HeroAvatarInSlot photoUrl={photoUrl} initials={initials} visible />
          )}
        </div>
      </div>
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
    <div
      className="relative mb-3 aspect-[16/9] max-h-[15.5rem] min-h-[11.25rem] w-full overflow-hidden rounded-[22px] border border-[#E50914]/35 bg-[#0A0A0A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_36px_rgba(0,0,0,0.52),0_0_48px_rgba(229,9,20,0.08)] sm:max-h-[16.5rem] sm:min-h-[12rem]"
    >
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

        <div className="relative z-[1] w-[42%] max-w-[11rem] shrink-0 sm:max-w-[12rem]" aria-hidden>
          {!isCutoutLayout || showAvatarFallback ? (
            <HeroAvatarInSlot photoUrl={photoUrl} initials={initials} visible large />
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
  return <TrainerProfileHeroCard {...props} />;
};
