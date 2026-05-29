import React from "react";
import { Mail, Phone, Users } from "lucide-react";

type ContactProps = {
  phone: string | null;
  email: string | null;
};

type TeamProps = {
  teamName: string;
  seasonName: string;
  roleLabel: string;
};

export const ProfileContactCard: React.FC<ContactProps> = ({ phone, email }) => {
  const phoneTrim = (phone ?? "").trim();
  const emailTrim = (email ?? "").trim();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-black/40 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-300/80">Kontakt</h3>
      <div className="space-y-1.5">
        {phoneTrim ? (
          <a href={`tel:${phoneTrim}`} className="flex items-center gap-2 text-[13px] text-white/88 hover:text-white">
            <Phone className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden />
            <span className="truncate font-medium">{phoneTrim}</span>
          </a>
        ) : (
          <p className="text-[12px] text-white/45">Keine Telefonnummer hinterlegt</p>
        )}
        {emailTrim ? (
          <a href={`mailto:${emailTrim}`} className="flex items-center gap-2 text-[13px] text-white/88 hover:text-white">
            <Mail className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden />
            <span className="truncate font-medium">{emailTrim}</span>
          </a>
        ) : (
          <p className="text-[12px] text-white/45">Keine E-Mail hinterlegt</p>
        )}
      </div>
    </div>
  );
};

export const ProfileTeamCard: React.FC<TeamProps> = ({ teamName, seasonName, roleLabel }) => {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-black/40 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-300/80">Teamzuordnung</h3>
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-950/55 text-red-300/90">
          <Users className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Mannschaft</div>
            <div className="truncate text-[14px] font-semibold text-white">{teamName}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Saison</div>
            <div className="text-[14px] font-semibold text-white">{seasonName}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Rolle</div>
            <div className="text-[14px] font-semibold text-white">{roleLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProfileFooterCards: React.FC<ContactProps & TeamProps> = (props) => {
  return (
    <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ProfileContactCard phone={props.phone} email={props.email} />
      <ProfileTeamCard teamName={props.teamName} seasonName={props.seasonName} roleLabel={props.roleLabel} />
    </div>
  );
};
