import React from "react";
import { ChevronRight } from "lucide-react";
import { PremiumPlayerCard } from "../player/PremiumPlayerCard";
import { staffRoleLabelDe, type TeamStaffMember } from "../../hooks/useTeamStaff";

type Props = {
  member: TeamStaffMember;
  onClick: () => void;
};

/** Visuell identisch zu Kader → PlayerCard (ohne Trikotnummer). */
export const TrainerStaffCard: React.FC<Props> = ({ member, onClick }) => {
  const photo = (member.avatar_url ?? "").trim() || null;
  return (
    <PremiumPlayerCard
      player={{
        first_name: member.first_name,
        last_name: member.last_name,
        avatar_url: photo,
        photo_url: photo,
      }}
      avatarPlaceholder={false}
      subline={staffRoleLabelDe(member.role)}
      density="compact"
      onClick={onClick}
      trailing={<ChevronRight className="h-4 w-4 text-white/28" aria-hidden />}
    />
  );
};
