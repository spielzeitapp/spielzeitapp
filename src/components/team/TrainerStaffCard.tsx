import React from "react";
import { ChevronRight, Mail, Pencil, Phone } from "lucide-react";
import {
  premiumPlayerCardAvatarBloomClass,
  premiumPlayerCardAvatarRingClass,
  premiumPlayerCardGlowClass,
  premiumPlayerCardShellClass,
  premiumPlayerInitials,
  premiumPlayerNameClass,
  DS_CARD_INNER_GAP,
} from "../../lib/premiumPlayerCard";
import { staffDisplayName, staffRoleLabelDe, type TeamStaffMember } from "../../hooks/useTeamStaff";

type Props = {
  member: TeamStaffMember;
  canManage?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
};

function staffAvatarSrc(member: TeamStaffMember): string | null {
  const url = (member.avatar_url ?? "").trim();
  return url.length > 0 ? url : null;
}

export const TrainerStaffCard: React.FC<Props> = ({ member, canManage = false, onOpen, onEdit }) => {
  const name = staffDisplayName(member);
  const initials = premiumPlayerInitials(name);
  const avatarSrc = staffAvatarSrc(member);
  const roleLabel = staffRoleLabelDe(member.role);
  const phone = (member.phone ?? "").trim();
  const email = (member.email ?? "").trim();

  return (
    <div className={premiumPlayerCardShellClass({ interactive: true, className: "relative overflow-hidden" })}>
      <div className={premiumPlayerCardGlowClass()} aria-hidden />
      <button type="button" onClick={onOpen} className="relative z-[1] w-full text-left">
        <div className={`flex items-start ${DS_CARD_INNER_GAP}`}>
          <div className="relative h-14 w-14 shrink-0">
            <div className={premiumPlayerCardAvatarBloomClass()} aria-hidden />
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className={`relative z-[1] h-14 w-14 ${premiumPlayerCardAvatarRingClass()}`}
              />
            ) : (
              <div
                className={`relative z-[1] flex h-14 w-14 items-center justify-center rounded-full border border-[#2a2a2e] bg-[#0a0a0b] text-[13px] font-bold text-white/80 ${premiumPlayerCardAvatarRingClass()}`}
              >
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <p className={`${premiumPlayerNameClass()} text-[18px] leading-tight`}>{name}</p>
            <span className="mt-1.5 inline-flex rounded-full border border-red-500/35 bg-red-950/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-200/95">
              {roleLabel}
            </span>
            <div className="mt-2 space-y-1 text-[13px] text-white/65">
              {email ? (
                <span className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden />
                  <span className="truncate">{email}</span>
                </span>
              ) : null}
              {phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden />
                  {phone}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
            {canManage && onEdit ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/[0.1]"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                Bearbeiten
              </button>
            ) : null}
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </div>
        </div>
      </button>
    </div>
  );
};
