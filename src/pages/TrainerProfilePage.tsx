import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { useSession, getSeasonLabelFromMembership, getTeamNameFromMembership } from "../auth/useSession";
import {
  staffDisplayName,
  staffRoleLabelDe,
  type TeamStaffMember,
} from "../hooks/useTeamStaff";
import { supabase } from "../lib/supabaseClient";

export const TrainerProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { selectedTeamSeason, selectedMembership } = useSession();
  const { teamSeasonId, teamLabel, loading: tsLoading } = useActiveTeamSeason();
  const [member, setMember] = useState<TeamStaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supabase
      .from("memberships")
      .select("user_id, role, profiles(first_name, last_name, phone, email, avatar_url)")
      .eq("team_season_id", teamSeasonId)
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data, error: qErr }) => {
        if (cancelled) return;
        if (qErr || !data) {
          setMember(null);
          setError(qErr?.message ?? "Trainer nicht gefunden.");
          setLoading(false);
          return;
        }
        const role = String(data.role ?? "").trim().toLowerCase();
        if (!["trainer", "co_trainer", "head_coach"].includes(role)) {
          setMember(null);
          setError("Kein Trainer-Eintrag für diese Person.");
          setLoading(false);
          return;
        }
        const p = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
        setMember({
          user_id: data.user_id,
          role,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          phone: p?.phone ?? null,
          email: p?.email ?? null,
          avatar_url: p?.avatar_url ?? null,
        });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, teamSeasonId]);

  const displayName = member ? staffDisplayName(member) : "Trainer";
  const avatarUrl = (member?.avatar_url ?? "").trim();
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-lg px-3 pb-28 pt-4 sm:px-4">
      <button
        type="button"
        onClick={() => navigate("/app/team")}
        className="mb-4 inline-flex items-center gap-2 text-[14px] font-medium text-white/75 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Zurück zum Team
      </button>

      <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-[#111] shadow-[0_12px_48px_rgba(0,0,0,0.5)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(122,29,42,0.22)_0%,transparent_65%)]" aria-hidden />
        <div className="relative z-10 p-5 sm:p-6">
          {loading || tsLoading ? (
            <p className="text-white/70">Lade Trainerprofil…</p>
          ) : error || !member ? (
            <p className="text-red-300/95">{error ?? "Trainer nicht gefunden."}</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-800 text-2xl font-black text-white/90">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl">{displayName}</h1>
                  <p className="mt-1 text-[15px] font-medium text-red-300/90">{staffRoleLabelDe(member.role)}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2.5">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Team</div>
                  <div className="mt-0.5 text-[16px] font-semibold text-white">{teamName}</div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Saison</div>
                  <div className="mt-0.5 text-[16px] font-semibold text-white">{seasonName}</div>
                </div>
              </div>

              <h2 className="mb-2.5 mt-6 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">Kontakt</h2>
              <div className="space-y-2">
                {member.phone?.trim() ? (
                  <a
                    href={`tel:${member.phone.trim()}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-[15px] text-white/90 hover:bg-white/[0.07]"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                    {member.phone.trim()}
                  </a>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/12 px-3.5 py-3 text-[14px] text-white/55">
                    Keine Telefonnummer hinterlegt
                  </p>
                )}
                {member.email?.trim() ? (
                  <a
                    href={`mailto:${member.email.trim()}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-[15px] text-white/90 hover:bg-white/[0.07]"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                    {member.email.trim()}
                  </a>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/12 px-3.5 py-3 text-[14px] text-white/55">
                    Keine E-Mail hinterlegt
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[12px] text-white/45">
        <Link to="/app/team" className="underline hover:text-white/70">
          Team-Übersicht
        </Link>
      </p>
    </div>
  );
};
