import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProfileCompactHeader } from "../components/team/profile/ProfileCompactHeader";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { useSession } from "../auth/useSession";
import { canManageRoster, normalizeRole } from "../lib/roles";
import {
  fetchTeamStaffMember,
  staffDisplayName,
  staffRoleLabelDe,
  STAFF_RPC_MIGRATION_HINT,
  type TeamStaffMember,
} from "../hooks/useTeamStaff";
import { useSeasonMatchBoard } from "../hooks/useSeasonMatchBoard";
import { usePlayers } from "../hooks/usePlayers";
import { useTrainerStaffEditor } from "../hooks/useTrainerStaffEditor";
import { TrainerStaffFormModal } from "../components/team/TrainerStaffFormModal";
import { TrainerProfileBody } from "../components/team/profile/TrainerProfileBody";
import { ProfileHeroCard } from "../components/team/profile/ProfileHeroCard";
import { AppButton } from "../components/ui/AppButton";
import { premiumPlayerInitials } from "../lib/premiumPlayerCard";
import { APP_BOTTOM_SCROLL_PAD } from "../lib/appScrollPadding";
import { labelPartsFromTeamSeasonLike } from "../lib/profileTeamSeasonDisplay";

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
  const { selectedTeamSeason } = useSession();
  const { teamSeasonId, teamLine, seasonLine, role, loading: tsLoading } = useActiveTeamSeason();
  const canManage = canManageRoster(normalizeRole(role));

  const { players } = usePlayers(teamSeasonId, {
    mode: canManage ? "all" : "active",
  });

  const [member, setMember] = useState<TeamStaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rpcMissing, setRpcMissing] = useState(false);

  const {
    summary: seasonSummary,
    recent: recentMatches,
    finishedMatches: coachMatches,
    achievements,
    trainings,
    loading: boardLoading,
    error: boardError,
  } = useSeasonMatchBoard(teamSeasonId);

  const stats = useMemo(
    () => ({
      trainings,
      matches: seasonSummary.played,
      wins: seasonSummary.wins,
      draws: seasonSummary.draws,
      losses: seasonSummary.losses,
      goalsFor: seasonSummary.goalsFor,
      goalsAgainst: seasonSummary.goalsAgainst,
      pointsPerGame: seasonSummary.pointsPerGame,
    }),
    [seasonSummary, trainings],
  );

  const statsLoading = boardLoading;
  const statsError = boardError;
  const matchesLoading = boardLoading;
  const matchesError = boardError;

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

  const labelParts = useMemo(() => {
    const fromActive = labelPartsFromTeamSeasonLike(selectedTeamSeason);
    if (fromActive) return fromActive;
    if (teamLine) {
      return {
        teamLine,
        seasonLine: seasonLine && seasonLine !== "—" ? seasonLine : "—",
        full: seasonLine && seasonLine !== "—" ? `${teamLine} · ${seasonLine}` : teamLine,
      };
    }
    return null;
  }, [selectedTeamSeason, teamLine, seasonLine]);

  const teamName = labelParts?.teamLine?.trim() || "Team";
  const seasonName = labelParts?.seasonLine?.trim() || "—";
  const teamSeasonLabel =
    labelParts?.full?.trim() ||
    (seasonName && seasonName !== "—" ? `${teamName} · ${seasonName}` : teamName);

  const avatarUrl = (member?.avatar_url ?? "").trim();
  const { line1: firstNameLine, line2: lastNameLine } = member ? nameHeroLines(member) : { line1: "TRAINER", line2: "" };
  const initials = member ? premiumPlayerInitials(staffDisplayName(member)) : "TR";
  const roleWatermark = "TR";

  const goBack = () => navigate("/app/team", { state: { tab: "trainers" } });

  return (
    <div
      className="mx-auto w-full max-w-lg min-w-0 overflow-x-hidden px-3 pt-0 sm:px-4"
      style={{ paddingBottom: `calc(${APP_BOTTOM_SCROLL_PAD})` }}
    >
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
          <div className="pt-2">
            <ProfileHeroCard
              variant="trainer"
              watermark={roleWatermark}
              firstNameLine={firstNameLine}
              lastNameLine={lastNameLine}
              teamSeasonLabel={teamSeasonLabel}
              teamName={teamName}
              roleLabel={staffRoleLabelDe(member.role).toUpperCase()}
              photoUrl={avatarUrl || null}
              cutoutUrl={member.cutout_url ?? null}
              initials={initials}
            />

            {teamSeasonId ? (
              <TrainerProfileBody
                member={member}
                teamSeasonId={teamSeasonId}
                teamName={teamName}
                players={players}
                stats={stats}
                seasonSummary={seasonSummary}
                statsLoading={statsLoading}
                statsError={statsError}
                matchDetails={coachMatches}
                recentMatches={recentMatches}
                matchesLoading={matchesLoading}
                matchesError={matchesError}
                achievements={achievements}
                canManage={canManage}
                onEdit={() => trainerEditor.openEditTrainerForm(member)}
              />
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
