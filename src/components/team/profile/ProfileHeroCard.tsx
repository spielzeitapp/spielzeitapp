import React from "react";
import {
  resolveProfileCutoutSrc,
  splitTeamSeasonLabel,
  useProfileHeroImagePreload,
} from "./profileHeroShared";
import type { ProfilePositionBadge } from "../../../lib/positionLabels";
import { resolveProfilePhotoSrc } from "../../../lib/profileHeroImage";
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

function resolvePlayerHeroTeamLine(teamName: string | null | undefined, teamSeasonLabel: string): string {
  const parsed = splitTeamSeasonLabel(teamSeasonLabel);
  const combined = `${teamName ?? ""} ${parsed.team} ${teamSeasonLabel}`;
  const ageGroup = /\bU\d+\b/i.exec(combined)?.[0]?.toUpperCase() ?? "";
  const rawClub = (teamName ?? "").trim() || parsed.team || "Team";
  const club = rawClub
    .replace(/[–-]\s*Demo\b/gi, "")
    .replace(/\bU\d+\b/gi, "")
    .trim()
    .replace(/^NSG\s+Rohrbach\b/i, "SPG Rohrbach")
    .toUpperCase();
  return ageGroup ? `${club} · ${ageGroup}` : club;
}

function PlayerProfileHeroCard(props: Props) {
  const {
    watermark,
    firstNameLine,
    lastNameLine,
    teamSeasonLabel,
    teamName,
    photoUrl,
    cutoutUrl,
    initials,
  } = props;
  const cutoutSrc = resolveProfileCutoutSrc(cutoutUrl);
  const photoSrc = resolveProfilePhotoSrc(photoUrl);
  const heroImageSrc = cutoutSrc || photoSrc;
  const [imageOk, setImageOk] = React.useState(true);

  React.useEffect(() => {
    setImageOk(true);
  }, [heroImageSrc]);

  useProfileHeroImagePreload(cutoutUrl, photoUrl);

  const teamLine = resolvePlayerHeroTeamLine(teamName, teamSeasonLabel);
  const isUpperBodyDemo = /\/demo-player-upper-\d+\.webp(?:\?|$)/i.test(heroImageSrc ?? "");

  return (
    <div className="relative mb-3 aspect-[4/3] min-h-[17rem] max-h-[20rem] w-full overflow-hidden rounded-[22px] border border-red-500/40 bg-[linear-gradient(145deg,#171719_0%,#070708_52%,#25090c_100%)] shadow-[0_14px_42px_rgba(0,0,0,0.55)] ring-1 ring-red-500/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(220,38,38,0.3),transparent_48%)]" aria-hidden />
      <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(130deg,transparent_0,transparent_16px,rgba(239,68,68,0.14)_17px,transparent_18px)]" aria-hidden />

      <div className="absolute inset-0 z-[1] flex items-end justify-center overflow-hidden" aria-hidden>
        {heroImageSrc && imageOk ? (
          <img
            src={heroImageSrc}
            alt=""
            className={`h-full w-full object-bottom ${
              cutoutSrc
                ? "origin-bottom scale-[1.22] object-contain"
                : isUpperBodyDemo
                  ? "object-contain"
                  : "object-cover object-top"
            }`}
            onError={() => setImageOk(false)}
          />
        ) : (
          <div className="mb-20 flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-3xl font-black text-white/80">
            {initials}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[2] h-[48%] bg-gradient-to-t from-black via-black/78 to-transparent" aria-hidden />

      <div className="absolute inset-x-0 top-0 z-[3] flex items-start justify-between p-4 sm:p-5">
        <p className="pt-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/85 sm:text-[12px]">
          {teamLine}
        </p>
        <p className="text-[44px] font-black leading-none text-white sm:text-[52px]">{watermark}</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[3] p-4 sm:p-5">
        <div className="max-w-[82%] text-[28px] font-black uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.95)] sm:text-[32px]">
          {firstNameLine ? <p>{firstNameLine}</p> : null}
          {lastNameLine ? <p>{lastNameLine}</p> : null}
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
