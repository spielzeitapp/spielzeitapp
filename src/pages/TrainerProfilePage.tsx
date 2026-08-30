import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useTeamStaff,
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
import { useDemoMode } from "../demo/DemoContext";
import { useInternalBasePath } from "../demo/demoPaths";
import { DemoAiDisclosure } from "../demo/components/DemoAiDisclosure";
import { getDemoStaffMember } from "../demo/demoStaff";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getOurTeamLogoUrl } from "../lib/teamLogos";

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
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const basePath = useInternalBasePath();
  const { selectedTeamSeason } = useSession();
  const {
    teamSeasonId: sessionTeamSeasonId,
    teamLine: sessionTeamLine,
    seasonLine: sessionSeasonLine,
    role: sessionRole,
    loading: tsLoadingRaw,
  } = useActiveTeamSeason();
  const teamSeasonId = isDemo ? demo!.data.teamSeasonId : sessionTeamSeasonId;
  const teamLine = isDemo ? demo!.data.teamName : sessionTeamLine;
  const seasonLine = isDemo ? demo!.data.seasonLabel : sessionSeasonLine;
  const role = isDemo ? "trainer" : sessionRole;
  const tsLoading = isDemo ? false : tsLoadingRaw;
  const canManage = !isDemo && canManageRoster(normalizeRole(role));

  const { players: livePlayers } = usePlayers(isDemo ? null : teamSeasonId, {
    mode: canManage ? "all" : "active",
  });
  const players = isDemo && demo ? demo.players : livePlayers;
  const { staff: liveNavigationStaff } = useTeamStaff(isDemo ? null : teamSeasonId);
  const navigationStaff = isDemo && demo ? demo.staff : liveNavigationStaff;

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
    loading: boardLoadingLive,
    error: boardErrorLive,
  } = useSeasonMatchBoard(isDemo ? null : teamSeasonId);

  const boardLoading = isDemo ? false : boardLoadingLive;
  const boardError = isDemo ? null : boardErrorLive;

  const stats = useMemo(
    () => ({
      trainings: isDemo ? 14 : trainings,
      matches: isDemo ? 8 : seasonSummary.played,
      wins: isDemo ? 5 : seasonSummary.wins,
      draws: isDemo ? 2 : seasonSummary.draws,
      losses: isDemo ? 1 : seasonSummary.losses,
      goalsFor: isDemo ? 18 : seasonSummary.goalsFor,
      goalsAgainst: isDemo ? 9 : seasonSummary.goalsAgainst,
      pointsPerGame: isDemo ? 2.1 : seasonSummary.pointsPerGame,
    }),
    [seasonSummary, trainings, isDemo],
  );

  const statsLoading = boardLoading;
  const statsError = boardError;
  const matchesLoading = boardLoading;
  const matchesError = boardError;

  const reloadMember = useCallback(async () => {
    const uid = userId?.trim();
    if (!uid || !teamSeasonId) return;
    if (isDemo && demo) {
      const found = demo.staff.find((s) => s.user_id === uid) ?? null;
      setRpcMissing(false);
      setMember(found);
      setNotFound(!found);
      return;
    }
    const { member: found, error, rpcMissing: rpcGap } = await fetchTeamStaffMember(teamSeasonId, uid);
    setRpcMissing(rpcGap);
    if (error || !found) {
      setMember(null);
      setNotFound(true);
    } else {
      setMember(found);
      setNotFound(false);
    }
  }, [userId, teamSeasonId, isDemo, demo]);

  useEffect(() => {
    const uid = userId?.trim();
    if (!uid || !teamSeasonId) {
      setMember(null);
      setNotFound(!uid);
      setLoading(false);
      return;
    }
    if (isDemo && demo) {
      const found = demo.staff.find((s) => s.user_id === uid) ?? null;
      setRpcMissing(false);
      setMember(found);
      setNotFound(!found);
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
  }, [userId, teamSeasonId, isDemo, demo]);

  const trainerEditor = useTrainerStaffEditor({
    teamSeasonId: isDemo ? null : teamSeasonId,
    onAfterSave: reloadMember,
  });

  const labelParts = useMemo(() => {
    if (isDemo) {
      return {
        teamLine: demo!.data.teamName,
        seasonLine: demo!.data.seasonLabel,
        full: `${demo!.data.teamName} · ${demo!.data.seasonLabel}`,
      };
    }
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
  }, [selectedTeamSeason, teamLine, seasonLine, isDemo, demo]);

  const teamName = labelParts?.teamLine?.trim() || "Team";
  const seasonName = labelParts?.seasonLine?.trim() || "—";
  const teamSeasonLabel =
    labelParts?.full?.trim() ||
    (seasonName && seasonName !== "—" ? `${teamName} · ${seasonName}` : teamName);

  const avatarUrl = (member?.avatar_url ?? "").trim();
  const { line1: firstNameLine, line2: lastNameLine } = member ? nameHeroLines(member) : { line1: "TRAINER", line2: "" };
  const initials = member ? premiumPlayerInitials(staffDisplayName(member)) : "TR";
  const roleWatermark = "TR";
  const demoAi = isDemo && Boolean(getDemoStaffMember(userId));

  const currentTrainerIndex = navigationStaff.findIndex((trainer) => trainer.user_id === member?.user_id);
  const previousTrainer = currentTrainerIndex > 0 ? navigationStaff[currentTrainerIndex - 1] : null;
  const nextTrainer =
    currentTrainerIndex >= 0 && currentTrainerIndex < navigationStaff.length - 1
      ? navigationStaff[currentTrainerIndex + 1]
      : null;
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const switchTrainer = useCallback(
    (trainer: TeamStaffMember | null) => {
      if (!trainer) return;
      navigate(`${basePath}/team/trainer/${encodeURIComponent(trainer.user_id)}`, { replace: true });
    },
    [basePath, navigate],
  );

  const goBack = () => navigate(`${basePath}/team`, { state: { tab: "trainers" } });

  return (
    <div
      className="mx-auto w-full max-w-lg min-w-0 overflow-x-hidden px-3 pt-0 sm:px-4"
      style={{ paddingBottom: `calc(${APP_BOTTOM_SCROLL_PAD})` }}
    >
      <ProfileCompactHeader title="Trainerprofil" onBack={goBack} backLabel="Zurück zum Team" />

      {demoAi ? <DemoAiDisclosure className="mt-3" /> : null}

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
            <div
              className="relative touch-pan-y"
              onTouchStart={(event) => {
                const touch = event.changedTouches[0];
                swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
              }}
              onTouchEnd={(event) => {
                const start = swipeStartRef.current;
                swipeStartRef.current = null;
                const touch = event.changedTouches[0];
                if (!start || !touch) return;
                const deltaX = touch.clientX - start.x;
                const deltaY = touch.clientY - start.y;
                if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
                switchTrainer(deltaX < 0 ? nextTrainer : previousTrainer);
              }}
            >
              <ProfileHeroCard
                variant="trainer"
                watermark={roleWatermark}
                firstNameLine={firstNameLine}
                lastNameLine={lastNameLine}
                teamSeasonLabel={teamSeasonLabel}
                teamName={teamName}
                teamLogoUrl={getOurTeamLogoUrl()}
                roleLabel={staffRoleLabelDe(member.role).toUpperCase()}
                photoUrl={avatarUrl || null}
                cutoutUrl={member.cutout_url ?? null}
                initials={initials}
              />
              {previousTrainer ? (
                <button
                  type="button"
                  onClick={() => switchTrainer(previousTrainer)}
                  aria-label={`Vorheriger Trainer: ${staffDisplayName(previousTrainer)}`}
                  className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 shadow-lg backdrop-blur-sm active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
              {nextTrainer ? (
                <button
                  type="button"
                  onClick={() => switchTrainer(nextTrainer)}
                  aria-label={`Nächster Trainer: ${staffDisplayName(nextTrainer)}`}
                  className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 shadow-lg backdrop-blur-sm active:scale-95"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                </button>
              ) : null}
            </div>

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
