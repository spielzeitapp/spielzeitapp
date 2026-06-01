import React from "react";
import {
  hasCutoutUrl,
  HERO_CARD_CLASS,
  HeroAvatarInSlot,
  HeroClubLogoWatermark,
  HeroCutoutLayer,
  HeroTextStack,
  PremiumHeroStadiumAtmosphere,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  splitTeamSeasonLabel,
  useProfileHeroImagePreload,
  useStadiumBackgroundUrl,
} from "./profileHeroShared";

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
  const seasonLine = parsed.season;
  const role = (roleLabel ?? "TRAINER").trim().toUpperCase();

  return (
    <div className={HERO_CARD_CLASS}>
      <PremiumHeroStadiumAtmosphere photoBgUrl={stadiumBgUrl} />
      <HeroClubLogoWatermark />

      {isCutoutLayout && cutoutSrc ? (
        <HeroCutoutLayer
          cutoutSrc={cutoutSrc}
          visible={showCutoutImage}
          variant="trainer"
          onLoad={() => setCutoutImageOk(true)}
          onError={() => setCutoutImageOk(false)}
        />
      ) : null}

      <div className="relative flex h-full min-h-0 items-stretch justify-between gap-0 px-3 pb-2 pt-2.5 sm:px-4 sm:pb-2.5">
        <HeroTextStack
          teamLine={teamLine}
          mark={watermark}
          markVariant="trainer"
          roleLabel={role}
          firstNameLine={firstNameLine}
          lastNameLine={lastNameLine}
          seasonLine={seasonLine}
        />

        <div className="relative z-[1] w-[52%] max-w-[14rem] shrink-0 sm:max-w-[15rem]" aria-hidden>
          {!isCutoutLayout || showAvatarFallback ? (
            <HeroAvatarInSlot photoUrl={photoUrl} initials={initials} visible />
          ) : null}
        </div>
      </div>
    </div>
  );
};
