import React from "react";
import { ChevronRight } from "lucide-react";
import { PremiumPlayerCard } from "../player/PremiumPlayerCard";
import { staffRoleLabelDe, type TeamStaffMember } from "../../hooks/useTeamStaff";

type Props = {
  member: TeamStaffMember;
  onClick: () => void;
};

/** Gleiche Kartenlogik wie Kader → PlayerCard. */
export const TrainerStaffCard: React.FC<Props> = ({ member, onClick }) => {
  return (
    <PremiumPlayerCard
      player={{
        first_name: member.first_name,
        last_name: member.last_name,
        avatar_url: member.avatar_url,
      }}
      avatarPlaceholder={false}
      subline={staffRoleLabelDe(member.role)}
      density="compact"
      onClick={onClick}
      nameClassName="break-words text-[17px] leading-snug"
      sublineClassName="text-[13px] text-white/65"
      trailing={<ChevronRight className="h-4 w-4 text-white/28" aria-hidden />}
    />
  );
};
