import React from "react";
import {
  hasCutoutUrl,
  HERO_CARD_CLASS,
  HeroAvatarInSlot,
  HeroClubLogoWatermark,
  HeroCutoutLayer,
  HeroNameBlock,
  HeroPrimaryMark,
  HeroSeasonLine,
  HeroTeamHeaderLine,
  PremiumHeroStadiumAtmosphere,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  splitTeamSeasonLabel,
  useProfileHeroImagePreload,
  useStadiumBackgroundUrl,
} from "./profileHeroShared";
import { PlayerHeroMetaBadges } from "./PlayerHeroMetaBadges";
import type { ProfilePositionBadge } from "../../../lib/positionLabels";
import { TrainerProfileHeroCard } from "./TrainerProfileHeroCard";

/**
 * Profil-Hero Router — einheitliche Premium-Card für Trainer + Spieler.
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
  positionBadge?: ProfilePositionBadge | null;
  statusSlot?: React.ReactNode;
};

function resolvePlayerHeroSeasonLine(teamSeasonLabel: string): string {
  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  if (parsed.season) return parsed.season;
  const paren = /\(([^)]+)\)/.exec((teamSeasonLabel ?? "").trim());
  return paren?.[1]?.trim() ?? "";
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
    positionBadge,
    statusSlot,
  } = props;
  const stadiumBgUrl = useStadiumBackgroundUrl();
  const cutoutSrc = hasCutoutUrl(cutoutUrl) ? resolveProfileCutoutSrc(cutoutUrl) : null;
  const [cutoutImageOk, setCutoutImageOk] = React.useState(true);

  React.useEffect(() => {
    setCutoutImageOk(true);
  }, [cutoutUrl]);

  useProfileHeroImagePreload(cutoutUrl, photoUrl);

  const isCutoutLayout = profileHeroLayoutMode(cutoutUrl) === "cutout";
  const showCutoutImage = isCutoutLayout && cutoutImageOk && Boolean(cutoutSrc);
  /** Ohne Cutout: Porträt-Avatar (wie Trainer-Hero) — Demo-KI-Fotos + produktive Avatare ohne Freisteller. */
  const showAvatarFallback = !showCutoutImage;

  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const teamLine = (teamName ?? "").trim() || parsed.team;
  const seasonLine = resolvePlayerHeroSeasonLine(teamSeasonLabel);

  return (
    <div className={HERO_CARD_CLASS}>
      <PremiumHeroStadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroClubLogoWatermark />

      {isCutoutLayout && cutoutSrc ? (
        <HeroCutoutLayer
          cutoutSrc={cutoutSrc}
          visible={showCutoutImage}
          variant="player"
          onLoad={() => setCutoutImageOk(true)}
          onError={() => setCutoutImageOk(false)}
        />
      ) : null}

      <div className="relative flex h-full min-h-0 items-stretch justify-between gap-0 px-3 pb-2 pt-2 sm:px-4 sm:pb-2">
        <div className="relative z-[4] flex h-full min-w-0 max-w-[52%] flex-1 flex-col py-0.5 pl-0.5 pr-0.5 sm:max-w-[50%]">
          {teamLine ? <HeroTeamHeaderLine teamLine={teamLine} /> : null}

          <div className="mt-0.5 shrink-0">
            <HeroPrimaryMark mark={watermark} variant="player" />
          </div>

          <HeroNameBlock firstNameLine={firstNameLine} lastNameLine={lastNameLine} />

          <PlayerHeroMetaBadges
            positionBadge={positionBadge}
            jerseyNumber={watermark}
            seasonLine={seasonLine}
            statusSlot={statusSlot}
          />

          {!positionBadge && !statusSlot && seasonLine ? <HeroSeasonLine seasonLine={seasonLine} /> : null}
        </div>

        <div className="relative z-[1] w-[52%] max-w-[14rem] shrink-0 sm:max-w-[15rem]" aria-hidden>
          {showAvatarFallback ? (
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
