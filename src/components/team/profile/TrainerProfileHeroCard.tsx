import {DEFAULT_PHOTO_LAYOUT, photoBackground, type PlayerPhotoLayout} from '../../../lib/playerPhotoLayout';
import {playerPhotoDisplayUrl,preparedPlayerPortrait} from '../../../lib/playerPhotoDisplay';
import React from "react";
import {AutoFitName} from "./AutoFitName";
import { resolveProfilePhotoSrc } from "../../../lib/profileHeroImage";
import {
  resolveProfileCutoutSrc,
  splitTeamSeasonLabel,
  useProfileHeroImagePreload,
} from "./profileHeroShared";

export type TrainerProfileHeroCardProps = {
  hideDecorations?:boolean;
  photoLayout?: PlayerPhotoLayout | null;
  watermark: string;
  firstNameLine: string;
  lastNameLine: string;
  teamSeasonLabel: string;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  roleLabel?: string | null;
  photoUrl?: string | null;
  cutoutUrl?: string | null;
  initials: string;
  showTacticalBoard?: boolean;
};

function resolveTrainerTeamHeader(
  teamName: string | null | undefined,
  teamSeasonLabel: string,
): { club: string; ageGroup: string; season: string } {
  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const combined = `${teamName ?? ""} ${parsed.team} ${teamSeasonLabel}`;
  const ageGroup = /\bU\d+\b/i.exec(combined)?.[0]?.toUpperCase() ?? "";
  const season = /\b20\d{2}\/\d{2}\b/.exec(combined)?.[0] ?? "";
  const rawClub = (teamName ?? "").trim() || parsed.team || "Team";
  const club = rawClub
    .replace(/[–-]\s*Demo\b/gi, "")
    .replace(/\bU\d+\b/gi, "")
    .trim()
    .replace(/^NSG\s+Rohrbach\b/i, "SPG Rohrbach")
    .toUpperCase();
  return { club, ageGroup, season };
}

export const TrainerProfileHeroCard: React.FC<TrainerProfileHeroCardProps> = ({
  photoLayout,hideDecorations,
  watermark,
  firstNameLine,
  lastNameLine,
  teamSeasonLabel,
  teamName,
  teamLogoUrl,
  photoUrl,
  cutoutUrl,
  initials,
}) => {
  const cutoutSrc = resolveProfileCutoutSrc(cutoutUrl);
  const photoSrc = resolveProfilePhotoSrc(photoUrl);
  const layout={...DEFAULT_PHOTO_LAYOUT,...photoLayout};
  const heroImageSrc = photoLayout?.source==='original'?photoSrc:cutoutSrc || preparedPlayerPortrait(photoUrl) || photoSrc;
  const [imageOk, setImageOk] = React.useState(true);

  React.useEffect(() => setImageOk(true), [heroImageSrc]);
  useProfileHeroImagePreload(cutoutUrl, photoUrl);

  const teamHeader = resolveTrainerTeamHeader(teamName, teamSeasonLabel);
  const longestNameLine = Math.max(firstNameLine.length, lastNameLine.length);
  const nameSizeClass =
    longestNameLine >= 18
      ? "text-[17px] sm:text-[20px]"
      : longestNameLine >= 15
        ? "text-[19px] sm:text-[22px]"
        : longestNameLine >= 12
          ? "text-[22px] sm:text-[25px]"
          : "text-[28px] sm:text-[32px]";
  return (
    <div className="sz-club-profile-hero relative mb-3 aspect-[4/3] min-h-[17rem] max-h-[20rem] w-full overflow-hidden rounded-[22px] border" data-profile-artwork="premium" style={photoLayout?{background:photoBackground(layout.background,layout.backgroundImageUrl)}:undefined}>
      <div className="sz-club-diagonal-lines absolute inset-0" aria-hidden />

      <p hidden={hideDecorations}
        className="absolute left-9 top-[6.25rem] z-[4] select-none text-[clamp(6.75rem,30vw,9.75rem)] font-black leading-[0.7] tracking-[-0.08em] text-white/[0.14] sm:left-12 sm:top-[6.75rem]"
        style={photoLayout?{left:`calc(2.25rem + ${layout.numberX-88}%)`,top:`calc(6.25rem + ${layout.numberY-8}%)`,fontSize:`clamp(6rem, ${30*(layout.numberSize??44)/44}vw, ${9.75*(layout.numberSize??44)/44}rem)`}:undefined}
        aria-hidden
      >
        {watermark}
      </p>

      <div className="absolute inset-0 z-[2] flex items-end justify-center overflow-hidden" aria-hidden>
        {heroImageSrc && imageOk ? (
          <img
            src={playerPhotoDisplayUrl(heroImageSrc)}
            alt=""
            className="h-full w-[72%] origin-bottom translate-x-[16%] translate-y-[2%] object-contain object-bottom sm:w-[70%] sm:translate-x-[13%]"
            style={photoLayout?{transform:`translate(${16+(layout.x-50)}%, ${2+(layout.y-50)}%) scale(${layout.zoom/100})`}:undefined}
            onError={() => setImageOk(false)}
          />
        ) : (
          <div className="mb-20 flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-3xl font-black text-white/80">
            {initials}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[3] h-[48%] bg-gradient-to-t from-black via-black/78 to-transparent" aria-hidden />

      <div style={hideDecorations?{display:'none'}:undefined} className="absolute inset-x-0 top-0 z-[5] flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0 pt-0.5">
          <p className="truncate text-[15px] font-black uppercase leading-none tracking-[0.07em] text-white sm:text-[17px]">
            {teamHeader.club}
          </p>
          {teamHeader.ageGroup || teamHeader.season ? (
            <p className="mt-1.5 text-[11px] font-black uppercase leading-none tracking-[0.12em] text-white/72 sm:text-[12px]">
              {teamHeader.ageGroup ? <span className="sz-club-profile-accent">{teamHeader.ageGroup}</span> : null}
              {teamHeader.ageGroup && teamHeader.season ? <span className="text-white/45"> · </span> : null}
              {teamHeader.season ? <span>{teamHeader.season}</span> : null}
            </p>
          ) : null}
        </div>
        {teamLogoUrl ? (
          <img
            src={teamLogoUrl}
            alt=""
            className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] sm:h-24 sm:w-24"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[5] p-4 sm:p-5" style={hideDecorations?{display:'none'}:photoLayout?{left:`${layout.nameX-28}%`,bottom:`${85-layout.nameY}%`}:undefined}>
        <div className={`max-w-[82%] font-black uppercase leading-[0.92] tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.95)] ${nameSizeClass}`}>
          <AutoFitName first={firstNameLine} last={lastNameLine}/>
        </div>
      </div>
    </div>
  );
};
