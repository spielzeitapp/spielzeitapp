import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  Dumbbell,
  Mail,
  Percent,
  Phone,
  Shield,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { useSession, getSeasonLabelFromMembership, getTeamNameFromMembership } from "../auth/useSession";
import { canManageRoster, normalizeRole } from "../lib/roles";
import {
  fetchTeamStaffMember,
  staffDisplayName,
  staffRoleLabelDe,
  STAFF_RPC_MIGRATION_HINT,
  type TeamStaffMember,
} from "../hooks/useTeamStaff";
import { staffRoleWatermarkCode, useTeamSeasonCoachStats } from "../hooks/useTeamSeasonCoachStats";
import { useTrainerStaffEditor } from "../hooks/useTrainerStaffEditor";
import { TrainerStaffFormModal } from "../components/team/TrainerStaffFormModal";
import { ProfileChip } from "../components/team/ProfileChip";
import { ProfileStatTile } from "../components/team/ProfileStatTile";
import { AppButton } from "../components/ui/AppButton";
import { premiumPlayerInitials } from "../lib/premiumPlayerCard";

function nameHeroLines(member: TeamStaffMember): { line1: string; line2: string } {
  const first = (member.first_name ?? "").trim().toUpperCase();
  const last = (member.last_name ?? "").trim().toUpperCase();
  if (first && last) return { line1: first, line2: last };
  const full = staffDisplayName(member);
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { line1: parts[0].toUpperCase(), line2: parts.slice(1).join(" ").toUpperCase() };
  }
  return { line1: (parts[0] ?? full).toUpperCase(), line2: "" };
}

export const TrainerProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { selectedTeamSeason, selectedMembership } = useSession();
  const { teamSeasonId, teamLabel, role, loading: tsLoading } = useActiveTeamSeason();
  const canManage = canManageRoster(normalizeRole(role));

  const [member, setMember] = useState<TeamStaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rpcMissing, setRpcMissing] = useState(false);

  const { stats, loading: statsLoading, error: statsError } = useTeamSeasonCoachStats(teamSeasonId);

  const reloadMember = useCallback(async () => {
    const uid = userId?.trim();
    if (!uid || !teamSeasonId) return;
    const { member: found, error, rpcMissing: rpcGap } = await fetchTeamStaffMember(teamSeasonId, uid);
    setRpcMissing(rpcGap);
    if (error || !found) {
      setMember(null);
      setNotFound(true);
    } else {
      setMember(found);
      setNotFound(false);
    }
  }, [userId, teamSeasonId]);

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

  const trainerEditor = useTrainerStaffEditor({
    teamSeasonId,
    onAfterSave: reloadMember,
  });

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

  const teamSeasonLabel = useMemo(() => {
    if (seasonName && seasonName !== "—") return `${teamName} · ${seasonName}`;
    return teamName;
  }, [teamName, seasonName]);

  const avatarUrl = (member?.avatar_url ?? "").trim();
  const { line1: firstNameLine, line2: lastNameLine } = member ? nameHeroLines(member) : { line1: "TRAINER", line2: "" };
  const initials = member ? premiumPlayerInitials(staffDisplayName(member)) : "TR";
  const roleWatermark = member ? staffRoleWatermarkCode(member.role) : "TR";

  const statTiles = useMemo(
    () =>
      [
        { icon: Dumbbell, label: "Trainings", value: String(stats.trainings) },
        { icon: CalendarDays, label: "Spiele", value: String(stats.matches) },
        { icon: Trophy, label: "Siege", value: String(stats.wins) },
        { icon: Target, label: "Tore Team", value: String(stats.goalsFor) },
        { icon: Shield, label: "Gegentore", value: String(stats.goalsAgainst) },
        { icon: Percent, label: "Punkte / Spiel", value: stats.pointsPerGame },
      ] as const,
    [stats],
  );

  const bottomPad = canManage
    ? "max(6.25rem, calc(env(safe-area-inset-bottom, 0px) + 5.75rem))"
    : "max(1.75rem, env(safe-area-inset-bottom, 0px) + 1.25rem)";

  const goBack = () => navigate("/app/team", { state: { tab: "trainers" } });

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-black">
      <div className="z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/90 px-2 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top,0px))] backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/90 hover:bg-white/10"
          aria-label="Zurück zum Team"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-white/90">Trainerprofil</h1>
        <div className="w-10 shrink-0" aria-hidden />
      </div>

      {rpcMissing ? (
        <p className="mx-3 mt-3 rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-[13px] text-amber-100/95">
          {STAFF_RPC_MIGRATION_HINT}
        </p>
      ) : null}

      {loading || tsLoading ? (
        <div className="flex flex-1 items-center justify-center px-4 py-16 text-[15px] text-white/70">
          Lade Trainerprofil…
        </div>
      ) : notFound || !member ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <p className="text-[16px] font-semibold text-white">Trainer nicht gefunden</p>
          <p className="mt-2 max-w-xs text-[14px] text-white/60">
            Diese Person ist in der aktuellen Mannschaftssaison nicht als Trainer hinterlegt.
          </p>
          <AppButton type="button" variant="secondary" className="mt-5" onClick={goBack}>
            Zurück
          </AppButton>
        </div>
      ) : (
        <>
          <div
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-3 sm:px-4"
            style={{ paddingBottom: `calc(${bottomPad})` }}
          >
            <div className="relative mb-4 min-h-[11.5rem] w-full overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/50 via-black/55 to-black px-3 py-3.5 sm:min-h-[13rem] sm:py-4">
              <div
                className="pointer-events-none absolute -left-1 bottom-0 select-none font-black leading-[0.8] text-white/[0.07]"
                style={{ fontSize: "clamp(4.5rem, 28vw, 7.5rem)" }}
                aria-hidden
              >
                {roleWatermark}
              </div>
              <div className="relative flex items-end justify-between gap-2 sm:gap-4">
                <div className="min-w-0 flex-1 pb-0.5 text-left">
                  <p className="break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] text-[clamp(1.05rem,4vw,1.55rem)]">
                    {firstNameLine}
                  </p>
                  {lastNameLine ? (
                    <p className="mt-0.5 break-words font-black uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] text-[clamp(1.05rem,4vw,1.55rem)]">
                      {lastNameLine}
                    </p>
                  ) : null}
                  <p className="mt-2 break-words text-[14px] font-medium leading-snug text-white/70">{teamSeasonLabel}</p>
                </div>
                <div className="relative shrink-0">
                  <div className="absolute inset-0 scale-110 rounded-2xl bg-red-500/40 blur-2xl" aria-hidden />
                  <div className="relative h-[6.25rem] w-[6.25rem] sm:h-[8.75rem] sm:w-[8.75rem]">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full rounded-2xl border-2 border-red-500/45 object-cover shadow-[0_0_40px_rgba(239,68,68,0.42),0_0_1px_rgba(255,255,255,0.2)_inset]"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (next) next.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-white/20 bg-zinc-800 text-2xl font-black text-white"
                      style={{ display: avatarUrl ? "none" : "flex" }}
                    >
                      {initials}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5 sm:justify-center sm:gap-2">
              <ProfileChip>Rolle: {staffRoleLabelDe(member.role)}</ProfileChip>
              {member.email?.trim() ? (
                <ProfileChip>
                  <span className="max-w-[12rem] truncate sm:max-w-none">E-Mail: {member.email.trim()}</span>
                </ProfileChip>
              ) : null}
              {member.phone?.trim() ? <ProfileChip>Tel.: {member.phone.trim()}</ProfileChip> : null}
            </div>

            <h2 className="mb-2.5 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
              Trainerstatistik
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {statsLoading
                ? [0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={`trainer-stat-skel-${i}`}
                      className="h-[4.75rem] animate-pulse rounded-2xl border border-white/5 bg-white/[0.07]"
                    />
                  ))
                : statTiles.map((s) => <ProfileStatTile key={s.label} icon={s.icon} label={s.label} value={s.value} />)}
            </div>
            {statsError ? (
              <p className="mt-2 text-center text-[11px] text-amber-400/95">{statsError}</p>
            ) : null}
            {!statsLoading && !statsError && stats.matches === 0 && stats.trainings === 0 ? (
              <p className="mt-2 text-center text-[12px] text-white/60">Noch keine Saisondaten</p>
            ) : null}

            <h2 className="mb-2.5 mt-6 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">Kontakt</h2>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5">
              <div className="space-y-2.5">
                {member.phone?.trim() ? (
                  <a
                    href={`tel:${member.phone.trim()}`}
                    className="flex items-center gap-3 text-[15px] text-white/90 hover:text-white"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
                    <span className="break-all font-medium">{member.phone.trim()}</span>
                  </a>
                ) : (
                  <p className="text-[13px] text-white/50">Keine Telefonnummer hinterlegt</p>
                )}
                {member.email?.trim() ? (
                  <a
                    href={`mailto:${member.email.trim()}`}
                    className="flex items-center gap-3 text-[15px] text-white/90 hover:text-white"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
                    <span className="break-all font-medium">{member.email.trim()}</span>
                  </a>
                ) : (
                  <p className="text-[13px] text-white/50">Keine E-Mail hinterlegt</p>
                )}
              </div>
            </div>

            <h2 className="mb-2.5 mt-6 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
              Teamzuordnung
            </h2>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-950/50 text-red-300/90">
                  <Users className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 space-y-2.5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Mannschaft</div>
                    <div className="break-words text-[16px] font-semibold text-white">{teamName}</div>
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

            {canManage ? (
              <div className="mt-5 pb-1">
                <AppButton
                  type="button"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => trainerEditor.openEditTrainerForm(member)}
                >
                  Bearbeiten
                </AppButton>
              </div>
            ) : null}
          </div>

          {canManage && teamSeasonId != null ? (
            <TrainerStaffFormModal
              isOpen={trainerEditor.showTrainerForm}
              mode={trainerEditor.trainerFormMode}
              form={trainerEditor.trainerForm}
              editingTrainer={trainerEditor.editingTrainer}
              saving={trainerEditor.trainerSaving}
              avatarUploading={trainerEditor.trainerAvatarUploading}
              avatarPreviewUrl={trainerEditor.trainerAvatarPreviewUrl}
              avatarObjectUrl={trainerEditor.trainerAvatarObjectUrl}
              formError={trainerEditor.trainerFormError}
              onClose={trainerEditor.closeTrainerForm}
              onSubmit={trainerEditor.handleTrainerFormSubmit}
              onFormChange={(patch) => trainerEditor.setTrainerForm((f) => ({ ...f, ...patch }))}
              onAvatarFile={trainerEditor.handleTrainerAvatarFilePick}
              onAvatarValidationError={trainerEditor.setTrainerFormError}
              onAccountEmailBlur={() => void trainerEditor.handleTrainerAccountEmailBlur()}
            />
          ) : null}
        </>
      )}
    </div>
  );
};
