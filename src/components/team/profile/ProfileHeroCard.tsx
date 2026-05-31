import React from "react";
import {
  hasCutoutUrl,
  HERO_CARD_CLASS,
  HeroAvatarInSlot,
  HeroClubLogoWatermark,
  HeroCutoutLayer,
  HeroNameBlock,
  HeroPrimaryMark,
  HeroTeamHeaderLine,
  PremiumHeroStadiumAtmosphere,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  splitTeamSeasonLabel,
  useClubLogoUrl,
  useProfileHeroImagePreload,
  useStadiumBackgroundUrl,
} from "./profileHeroShared";
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
};

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

  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const teamLine = (teamName ?? "").trim() || parsed.team;
  const position = (roleLabel ?? "").trim().toUpperCase();

  return (
    <div className={HERO_CARD_CLASS}>
      <PremiumHeroStadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroClubLogoWatermark logoUrl={clubLogoUrl} />

      {isCutoutLayout && cutoutSrc ? (
        <HeroCutoutLayer
          cutoutSrc={cutoutSrc}
          visible={showCutoutImage}
          onLoad={() => setCutoutImageOk(true)}
          onError={() => setCutoutImageOk(false)}
        />
      ) : null}

      <div className="relative flex h-full min-h-0 items-stretch justify-between gap-0 px-3 pb-2 pt-2.5 sm:px-4 sm:pb-2.5">
        <div className="relative z-[4] flex h-full min-w-0 max-w-[48%] flex-1 flex-col py-1 pl-0.5 pr-0.5 sm:max-w-[46%]">
          {teamLine ? <HeroTeamHeaderLine teamLine={teamLine} /> : null}

          <div className="mt-0.5">
            <HeroPrimaryMark mark={watermark} emphasis="strong" />
            {position ? (
              <p className="-mt-0.5 text-[11px] font-extrabold uppercase italic tracking-[0.12em] text-[#E50914] sm:text-[12px]">
                {position}
              </p>
            ) : null}
          </div>

          <HeroNameBlock firstNameLine={firstNameLine} lastNameLine={lastNameLine} />
        </div>

        <div className="relative z-[1] w-[52%] max-w-[14rem] shrink-0 sm:max-w-[15rem]" aria-hidden>
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
