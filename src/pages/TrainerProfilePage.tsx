import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Users } from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { useSession, getSeasonLabelFromMembership, getTeamNameFromMembership } from "../auth/useSession";
import {
  fetchTeamStaffMember,
  staffDisplayName,
  staffRoleLabelDe,
  STAFF_RPC_MIGRATION_HINT,
  type TeamStaffMember,
} from "../hooks/useTeamStaff";
import {
  premiumPlayerCardAvatarBloomClass,
  premiumPlayerCardAvatarRingClass,
  premiumPlayerInitials,
} from "../lib/premiumPlayerCard";

export const TrainerProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { selectedTeamSeason, selectedMembership } = useSession();
  const { teamSeasonId, teamLabel, loading: tsLoading } = useActiveTeamSeason();
  const [member, setMember] = useState<TeamStaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rpcMissing, setRpcMissing] = useState(false);

  const teamName = useMemo(() => {
    const fromTs = selectedTeamSeason?.team?.name?.trim();
    if (fromTs) return fromTs;
    return getTeamNameFromMembership(selectedMembership)?.trim() || teamLabel || "Team";
  }, [selectedTeamSeason, selectedMembership, teamLabel]);

  const seasonName = useMemo(() => {
    const fromTs = selectedTeamSeason?.season?.name?.trim();
    if (fromTs) return fromTs;
    const fromMem = getSeasonLabelFromMembership(selectedMembership)?.trim();
    if (fromMem && fromMem !== "—") return fromMem;
    return "—";
  }, [selectedTeamSeason, selectedMembership]);

  useEffect(() => {
    const uid = userId?.trim();
    if (!uid || !teamSeasonId) {
      setMember(null);
      setNotFound(!uid);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setRpcMissing(false);
    void fetchTeamStaffMember(teamSeasonId, uid).then(({ member: found, error, rpcMissing: rpcGap }) => {
      if (cancelled) return;
      setRpcMissing(rpcGap);
      if (error || !found) {
        setMember(null);
        setNotFound(true);
      } else {
        setMember(found);
        setNotFound(false);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, teamSeasonId]);

  const displayName = member ? staffDisplayName(member) : "Trainer";
  const avatarUrl = (member?.avatar_url ?? "").trim();
  const initials = premiumPlayerInitials(displayName);

  return (
    <div className="mx-auto w-full max-w-lg px-3 pb-28 pt-4 sm:px-4">
      <button
        type="button"
        onClick={() => navigate("/app/team", { state: { tab: "trainers" } })}
        className="mb-4 inline-flex items-center gap-2 text-[14px] font-medium text-white/75 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Zurück zum Team
      </button>

      {rpcMissing ? (
        <p className="mb-3 rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-[13px] text-amber-100/95">
          {STAFF_RPC_MIGRATION_HINT}
        </p>
      ) : null}

      {loading || tsLoading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] px-5 py-10 text-center text-[15px] text-white/70">
          Lade Trainerprofil…
        </div>
      ) : notFound || !member ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] px-5 py-10 text-center">
          <p className="text-[16px] font-semibold text-white">Trainer nicht gefunden</p>
          <p className="mt-2 text-[14px] text-white/60">
            Diese Person ist in der aktuellen Mannschaftssaison nicht als Trainer hinterlegt.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/team", { state: { tab: "trainers" } })}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.1]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Zurück
          </button>
        </div>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-[#0c0c0c] shadow-[0_16px_56px_rgba(0,0,0,0.55)]">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(122,29,42,0.28)_0%,transparent_62%)]"
              aria-hidden
            />
            <div className="relative z-10 px-5 pb-6 pt-6 sm:px-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4 h-[108px] w-[108px]">
                  <div className={premiumPlayerCardAvatarBloomClass()} aria-hidden />
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className={`relative z-[1] h-[108px] w-[108px] ${premiumPlayerCardAvatarRingClass()}`}
                    />
                  ) : (
                    <div
                      className={`relative z-[1] flex h-[108px] w-[108px] items-center justify-center rounded-full border border-[#2a2a2e] bg-[#0a0a0b] text-3xl font-black text-white/85 ${premiumPlayerCardAvatarRingClass()}`}
                    >
                      {initials}
                    </div>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">{displayName}</h1>
                <span className="mt-2 inline-flex rounded-full border border-red-500/40 bg-red-950/55 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-red-200">
                  {staffRoleLabelDe(member.role)}
                </span>
                <p className="mt-3 text-[14px] text-white/65">
                  {teamName}
                  <span className="mx-2 text-white/35">·</span>
                  {seasonName}
                </p>
              </div>
            </div>
          </section>

          <h2 className="mb-2.5 mt-6 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">Kontakt</h2>
          <div className="space-y-2.5">
            {member.phone?.trim() ? (
              <a
                href={`tel:${member.phone.trim()}`}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-[15px] text-white/90 transition-colors hover:bg-white/[0.07]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06]">
                  <Phone className="h-4 w-4 text-white/70" aria-hidden />
                </span>
                <span className="font-medium">{member.phone.trim()}</span>
              </a>
            ) : (
              <p className="rounded-xl border border-dashed border-white/12 px-4 py-3.5 text-[14px] text-white/55">
                Keine Telefonnummer hinterlegt
              </p>
            )}
            {member.email?.trim() ? (
              <a
                href={`mailto:${member.email.trim()}`}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-[15px] text-white/90 transition-colors hover:bg-white/[0.07]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06]">
                  <Mail className="h-4 w-4 text-white/70" aria-hidden />
                </span>
                <span className="truncate font-medium">{member.email.trim()}</span>
              </a>
            ) : (
              <p className="rounded-xl border border-dashed border-white/12 px-4 py-3.5 text-[14px] text-white/55">
                Keine E-Mail hinterlegt
              </p>
            )}
          </div>

          <h2 className="mb-2.5 mt-6 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">Team</h2>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-950/50 text-red-300/90">
                <Users className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 space-y-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Mannschaft</div>
                  <div className="text-[16px] font-semibold text-white">{teamName}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Saison</div>
                  <div className="text-[16px] font-semibold text-white">{seasonName}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Rolle</div>
                  <div className="text-[16px] font-semibold text-white">{staffRoleLabelDe(member.role)}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <p className="mt-5 text-center text-[12px] text-white/45">
        <Link to="/app/team" className="underline hover:text-white/70">
          Team-Übersicht
        </Link>
      </p>
    </div>
  );
};
