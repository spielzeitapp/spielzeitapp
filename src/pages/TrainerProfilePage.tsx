import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProfileCompactHeader } from "../components/team/profile/ProfileCompactHeader";
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
import { useTeamSeasonCoachStats } from "../hooks/useTeamSeasonCoachStats";
import { useTrainerStaffEditor } from "../hooks/useTrainerStaffEditor";
import { TrainerStaffFormModal } from "../components/team/TrainerStaffFormModal";
import { ProfileChip } from "../components/team/ProfileChip";
import { ProfileStatTile } from "../components/team/ProfileStatTile";
import { ProfileHeroCard } from "../components/team/profile/ProfileHeroCard";
import { ProfileFooterCards } from "../components/team/profile/ProfileFooterCards";
import { TrainerBalanceCard } from "../components/team/profile/TrainerBalanceCard";
import { COACH_STAT_TILES } from "../components/team/profile/profileStatIcons";
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
  const roleWatermark = "TR";

  const statTiles = useMemo(
    () =>
      [
        { Icon: COACH_STAT_TILES.trainings, label: "Trainings", value: String(stats.trainings) },
        { Icon: COACH_STAT_TILES.games, label: "Spiele", value: String(stats.matches) },
        { Icon: COACH_STAT_TILES.wins, label: "Siege", value: String(stats.wins) },
        { Icon: COACH_STAT_TILES.goalsFor, label: "Tore Team", value: String(stats.goalsFor) },
        { Icon: COACH_STAT_TILES.goalsAgainst, label: "Gegentore", value: String(stats.goalsAgainst) },
        { Icon: COACH_STAT_TILES.pointsPerGame, label: "Punkte / Spiel", value: stats.pointsPerGame },
      ] as const,
    [stats],
  );

  const bottomPad = canManage
    ? "max(6.25rem, calc(env(safe-area-inset-bottom, 0px) + 5.75rem))"
    : "max(1.75rem, env(safe-area-inset-bottom, 0px) + 1.25rem)";

  const goBack = () => navigate("/app/team", { state: { tab: "trainers" } });

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-black">
      <ProfileCompactHeader title="Trainerprofil" onBack={goBack} backLabel="Zurück zum Team" />

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
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-2 sm:px-4"
            style={{ paddingBottom: `calc(${bottomPad})` }}
          >
            <ProfileHeroCard
              variant="trainer"
              watermark={roleWatermark}
              firstNameLine={firstNameLine}
              lastNameLine={lastNameLine}
              teamSeasonLabel={teamSeasonLabel}
              teamName={teamName}
              roleLabel={staffRoleLabelDe(member.role).toUpperCase()}
              photoUrl={avatarUrl}
              cutoutUrl={member.cutout_url}
              initials={initials}
            />

            <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2">
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
                : statTiles.map((s) => (
                    <ProfileStatTile key={s.label} icon={<s.Icon />} label={s.label} value={s.value} />
                  ))}
            </div>
            {!statsLoading && !statsError ? (
              <TrainerBalanceCard wins={stats.wins} draws={stats.draws} losses={stats.losses} />
            ) : null}
            {statsError ? (
              <p className="mt-2 text-center text-[11px] text-amber-400/95">{statsError}</p>
            ) : null}
            {!statsLoading && !statsError && stats.matches === 0 && stats.trainings === 0 ? (
              <p className="mt-2 text-center text-[12px] text-white/60">Noch keine Saisondaten</p>
            ) : null}

            <ProfileFooterCards
              phone={member.phone}
              email={member.email}
              teamName={teamName}
              seasonName={seasonName}
              roleLabel=""
            />

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
              cutoutUploading={trainerEditor.trainerCutoutUploading}
              avatarPreviewUrl={trainerEditor.trainerAvatarPreviewUrl}
              cutoutPreviewUrl={trainerEditor.trainerCutoutPreviewUrl}
              avatarObjectUrl={trainerEditor.trainerAvatarObjectUrl}
              cutoutObjectUrl={trainerEditor.trainerCutoutObjectUrl}
              formError={trainerEditor.trainerFormError}
              onClose={trainerEditor.closeTrainerForm}
              onSubmit={trainerEditor.handleTrainerFormSubmit}
              onFormChange={(patch) => trainerEditor.setTrainerForm((f) => ({ ...f, ...patch }))}
              onAvatarFile={trainerEditor.handleTrainerAvatarFilePick}
              onCutoutFile={trainerEditor.handleTrainerCutoutFilePick}
              onImageValidationError={trainerEditor.setTrainerFormError}
              onAccountEmailBlur={() => void trainerEditor.handleTrainerAccountEmailBlur()}
            />
          ) : null}
        </>
      )}
    </div>
  );
};
