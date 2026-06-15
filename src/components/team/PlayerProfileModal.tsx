import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { lockBodyScroll } from "../../lib/bodyScrollLock";
import { APP_SHEET_SCROLL_BOTTOM_PAD } from "../../lib/appScrollPadding";
import { Activity, CalendarDays, Trophy, User } from "lucide-react";
import { ProfileCompactHeader } from "./profile/ProfileCompactHeader";
import { ProfileHeroCard } from "./profile/ProfileHeroCard";
import { ProfileStatTile } from "./ProfileStatTile";
import { PLAYER_STAT_TILES } from "./profile/profileStatIcons";
import type { PlayerItem } from "../../hooks/usePlayers";
import { usePlayerStats } from "../../hooks/usePlayerStats";
import { usePlayerTrainingStats } from "../../hooks/usePlayerTrainingStats";
import { useTeamTrainingRanking } from "../../hooks/useTeamTrainingRanking";
import { useTrainingParticipationAccess } from "../../hooks/useTrainingParticipationAccess";
import {
  averageSquadTeamRatePct,
  formatSquadParticipationLabel,
} from "../../lib/trainingRanking";
import { Button } from "../../app/components/ui/Button";
import { AppButton } from "../ui/AppButton";
import { getPositionFull, getPositionLabel, getTrainingPositionDisplay } from "../../lib/positionLabels";

export type PlayerProfileModalProps = {
  player: PlayerItem;
  role: string | null;
  teamSeasonLabel: string | null;
  teamName?: string | null;
  photoUrl: string | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Nach LAZ-Flag-Änderung Kader + Profil-State aktualisieren. */
  onPlayerUpdated?: (patch: Pick<PlayerItem, "is_laz_player">) => void;
  /** Optionaler Start-Tab (z. B. aus Trainingskaiser). */
  initialTab?: ProfileTab;
  /** Aktiver Kader für anonymisierten Teamdurchschnitt im Training-Tab. */
  squadPlayers?: PlayerItem[];
};

export type ProfileTab = "overview" | "matches" | "achievements" | "training";

const APPEARANCE_MATCH_CARD_CLASS =
  "relative overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(220,38,38,0.12),0_10px_32px_rgba(0,0,0,0.45)]";

const APPEARANCE_MATCH_SCORE_CLASS =
  "relative shrink-0 overflow-hidden rounded-xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-2.5 py-1.5 text-[22px] font-bold tabular-nums leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(220,38,38,0.1)]";

const EINSATZ_MINUTES_CHIP_CLASS =
  "inline-flex shrink-0 items-center rounded-full border border-red-500/30 bg-red-500/[0.12] px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wide text-white/90 shadow-[0_0_16px_rgba(220,38,38,0.12)]";

function appearancePitchWatermarkSrc(): string {
  const b = import.meta.env.BASE_URL || "/";
  const base = b.endsWith("/") ? b : `${b}/`;
  return `${base}icons/pitch-red.svg`;
}

function displayFullName(p: PlayerItem): string {
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || p.display_name.trim() || "Spieler";
}

function nameHeroLines(p: PlayerItem): { line1: string; line2: string } {
  const first = (p.first_name ?? "").trim().toUpperCase();
  const last = (p.last_name ?? "").trim().toUpperCase();
  if (first && last) return { line1: first, line2: last };
  const full = displayFullName(p);
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      line1: parts[0].toUpperCase(),
      line2: parts.slice(1).join(" ").toUpperCase(),
    };
  }
  return { line1: (parts[0] ?? full).toUpperCase(), line2: "" };
}

function initials(p: PlayerItem): string {
  const name = displayFullName(p);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

function getAge(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  const birth = new Date(dateString);
  const today = new Date();
  if (Number.isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 0) return null;
  return age;
}

function getBirthYear(birthdate: string | null | undefined): string | null {
  if (!birthdate) return null;
  const m = /^(\d{4})/.exec(birthdate.trim());
  return m ? m[1] : null;
}

function formatAgeLabel(birthdate: string | null | undefined): string | null {
  const age = getAge(birthdate);
  if (age == null) return null;
  return `${age} Jahre`;
}

function SeasonMiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="text-[12px] font-semibold uppercase leading-tight tracking-wide text-white/60">{label}</div>
      <div className="mt-0.5 text-[22px] font-bold tabular-nums text-white">{value}</div>
    </div>
  );
}

function PlayerInfoChip({
  icon,
  label,
  value,
  subdued = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subdued?: boolean;
}) {
  return (
    <div className="relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-2.5 py-2 shadow-[0_0_28px_rgba(220,38,38,0.12),0_8px_24px_rgba(0,0,0,0.42)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.14)_0%,transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[rgba(220,38,38,0.28)] bg-red-950/45 text-[#E50914]">
        {icon}
      </div>
      <div className="relative min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-white/38">{label}</p>
        <p
          className={`truncate text-[12px] font-semibold leading-tight ${
            subdued ? "text-white/50" : "text-white/82"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function EinsatzBadge({ kind, label }: { kind: "full" | "sub_in" | "bank" | "partial"; label: string }) {
  const base =
    "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wide";
  if (kind === "full" || kind === "partial") {
    return <span className={EINSATZ_MINUTES_CHIP_CLASS}>{label}</span>;
  }
  if (kind === "bank") {
    return (
      <span
        className={`${base} border-[rgba(220,38,38,0.22)] bg-[rgba(25,25,28,0.88)] text-white/55 shadow-[0_0_12px_rgba(220,38,38,0.08)]`}
      >
        {label}
      </span>
    );
  }
  if (kind === "sub_in") {
    return <span className={`${base} border-emerald-500/45 bg-emerald-950/50 text-emerald-100`}>{label}</span>;
  }
  return <span className={EINSATZ_MINUTES_CHIP_CLASS}>{label}</span>;
}

const TAB_CONFIG: { id: ProfileTab; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "matches", label: "Einsätze" },
  { id: "achievements", label: "Erfolge" },
  { id: "training", label: "Training" },
];

function PlayerSpecialSettingsSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-3.5" aria-labelledby="player-special-settings-heading">
      <h3
        id="player-special-settings-heading"
        className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/42"
      >
        Spezielle Einstellungen
      </h3>
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(0,0,0,0.32)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {children}
      </div>
    </section>
  );
}

function SpecialSettingToggleRow({
  label,
  hint,
  checked,
  disabled,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1 pr-1">
        <p className="text-[13px] font-semibold leading-tight text-white/88">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-white/48">{hint}</p>
        {error ? (
          <p className="mt-1 text-[11px] leading-snug text-red-300/90" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-[26px] w-[44px] shrink-0 rounded-full border transition-colors duration-200",
          checked
            ? "border-emerald-400/35 bg-emerald-900/55"
            : "border-white/14 bg-white/[0.08]",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition-[left] duration-200",
            checked ? "left-[20px]" : "left-[2px]",
          ].join(" ")}
          aria-hidden
        />
      </button>
    </div>
  );
}

function ProfileSaveSnackbar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-3 bottom-[max(0.85rem,env(safe-area-inset-bottom,0px))] z-30 flex justify-center sm:inset-x-4"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-full border border-white/12 bg-[rgba(8,8,12,0.94)] px-4 py-2 text-[13px] font-medium text-white/92 shadow-[0_10px_36px_rgba(0,0,0,0.55)] backdrop-blur-md">
        Gespeichert
      </div>
    </div>
  );
}

/**
 * Premium player profile overlay (dark stadium).
 */
export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  role,
  teamSeasonLabel,
  teamName,
  photoUrl,
  canManage,
  onClose,
  onEdit,
  onPlayerUpdated,
  initialTab = "overview",
  squadPlayers = [],
}) => {
  const [profileTab, setProfileTab] = useState<ProfileTab>(initialTab);
  const [isLazPlayer, setIsLazPlayer] = useState(player.is_laz_player);
  const [lazSaving, setLazSaving] = useState(false);
  const [lazError, setLazError] = useState<string | null>(null);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const { canViewForPlayer } = useTrainingParticipationAccess(role);
  const canViewTrainingParticipation = canViewForPlayer(player.id);
  const visibleTabs = useMemo(
    () => TAB_CONFIG.filter((t) => t.id !== "training" || canViewTrainingParticipation),
    [canViewTrainingParticipation],
  );
  const { data: stats, lastMatches, isLoading: statsLoading, error: statsError } = usePlayerStats(
    player.id,
    player.team_season_id,
  );
  const {
    stats: trainingStats,
    loading: trainingStatsLoading,
    error: trainingStatsError,
  } = usePlayerTrainingStats(player.id, player.team_season_id, canViewTrainingParticipation);

  const { qualified, unqualified, sessionsCount, loading: teamRankingLoading } = useTeamTrainingRanking(
    squadPlayers,
    player.team_season_id,
    canViewTrainingParticipation && squadPlayers.length > 0,
  );
  const squadParticipationAvg = useMemo(
    () => averageSquadTeamRatePct(qualified, unqualified),
    [qualified, unqualified],
  );
  const pastTeamTrainings = sessionsCount > 0 ? sessionsCount : trainingStats.sessionsCounted;

  const goalsPerGameDisplay = useMemo(() => {
    const v = Number(stats.goalsPerGame);
    if (!Number.isFinite(v)) return "0.0";
    return v.toFixed(1);
  }, [stats.goalsPerGame]);

  const avgMinutesPerGameDisplay = useMemo(() => {
    const v = Number(stats.averageMinutesPerGame);
    if (!Number.isFinite(v)) return "0.0";
    return v.toFixed(1);
  }, [stats.averageMinutesPerGame]);

  const { line1: firstNameLine, line2: lastNameLine } = nameHeroLines(player);
  const avatarSrc = (photoUrl ?? "").trim() || "/avatars/player-placeholder.png";
  const jerseyWatermark =
    player.jersey_number != null && Number.isFinite(Number(player.jersey_number))
      ? String(player.jersey_number)
      : "–";
  const positionLabel = getPositionLabel(player.position) || "—";
  const positionFull = getPositionFull(player.position);
  const positionDisplay = getTrainingPositionDisplay(player.position);
  const positionHeroLabel =
    positionDisplay !== "—" ? positionDisplay.toUpperCase() : (positionFull || positionLabel).toUpperCase();
  const ageLabel = formatAgeLabel(player.birthdate);
  const birthYearLabel = getBirthYear(player.birthdate);
  const teamTrainingRatePct = trainingStats.teamRatePct;
  const activityTrainingRatePct = trainingStats.activityRatePct;
  const trainingsPresent = trainingStats.present;
  const trainingsAbsent = trainingStats.absent;
  const trainingsInjured = trainingStats.injured;
  const trainingsExternal = trainingStats.external;
  const trainingsOpen = trainingStats.open;
  const trainingsLegacyUnknown = trainingStats.legacyUnknown;
  const teamTrainingBasis = trainingsPresent + trainingsAbsent;
  const activityTrainingNumerator = trainingsPresent + trainingsExternal;
  const activityTrainingBasis = activityTrainingNumerator + trainingsAbsent;

  useEffect(() => {
    setIsLazPlayer(player.is_laz_player);
    setLazError(null);
  }, [player.id, player.is_laz_player]);

  useEffect(() => {
    setProfileTab(initialTab);
  }, [player.id, initialTab]);

  useEffect(() => {
    if (profileTab === "training" && !canViewTrainingParticipation) {
      setProfileTab("overview");
    }
  }, [profileTab, canViewTrainingParticipation]);

  useEffect(() => {
    if (!saveToastVisible) return;
    const t = window.setTimeout(() => setSaveToastVisible(false), 2400);
    return () => window.clearTimeout(t);
  }, [saveToastVisible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => lockBodyScroll(), []);

  const handleLazPlayerToggle = async (next: boolean) => {
    if (!canManage || lazSaving) return;
    const previous = player.is_laz_player;
    setLazSaving(true);
    setLazError(null);
    setIsLazPlayer(next);
    const { error } = await supabase.from("players").update({ is_laz_player: next }).eq("id", player.id);
    setLazSaving(false);
    if (error) {
      setIsLazPlayer(previous);
      setLazError(error.message ?? "Speichern fehlgeschlagen.");
      return;
    }
    setSaveToastVisible(true);
    onPlayerUpdated?.({ is_laz_player: next });
  };

  const lazToggleChecked = lazSaving ? isLazPlayer : player.is_laz_player;

  if (typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-[3px]"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative flex h-[min(92dvh,920px)] max-h-[min(92dvh,920px)] w-full max-w-lg min-h-0 flex-col overflow-hidden rounded-t-[1.75rem] bg-[linear-gradient(180deg,rgba(28,8,8,0.98)_0%,rgba(0,0,0,0.97)_42%,rgba(6,6,10,0.99)_100%)] shadow-[0_-24px_64px_rgba(0,0,0,0.7)] sm:h-auto sm:max-h-[min(94vh,920px)] sm:rounded-3xl sm:shadow-2xl"
      >
        <ProfileSaveSnackbar visible={saveToastVisible} />
        <ProfileCompactHeader
          title="Spielerprofil"
          titleId="player-profile-title"
          onBack={onClose}
          backLabel="Zurück"
        />

        <div
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-2 [-webkit-overflow-scrolling:touch] sm:px-4"
          style={{ paddingBottom: `calc(${APP_SHEET_SCROLL_BOTTOM_PAD})` }}
        >
          <ProfileHeroCard
            variant="player"
            watermark={jerseyWatermark}
            firstNameLine={firstNameLine}
            lastNameLine={lastNameLine}
            teamSeasonLabel={teamSeasonLabel ?? "Team"}
            teamName={teamName}
            roleLabel={positionHeroLabel !== "—" ? positionHeroLabel : undefined}
            photoUrl={(photoUrl ?? "").trim() || avatarSrc}
            cutoutUrl={player.cutout_url}
            initials={initials(player)}
          />

          {ageLabel || birthYearLabel ? (
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {ageLabel ? (
                <PlayerInfoChip
                  icon={<User className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
                  label="Alter"
                  value={ageLabel}
                />
              ) : null}
              {birthYearLabel ? (
                <PlayerInfoChip
                  icon={<CalendarDays className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
                  label="Jahrgang"
                  value={birthYearLabel}
                />
              ) : null}
            </div>
          ) : null}

          {canManage ? (
            <PlayerSpecialSettingsSection>
              <SpecialSettingToggleRow
                label="LAZ-Spieler"
                hint="Kennzeichnet Spieler mit Leistungsaufenthaltszentrum (LAZ) für Trainings."
                checked={lazToggleChecked}
                disabled={lazSaving}
                error={lazError}
                onChange={(next) => void handleLazPlayerToggle(next)}
              />
            </PlayerSpecialSettingsSection>
          ) : null}

          {/* Sticky tabs */}
          <div className="sticky top-0 z-10 -mx-3 mb-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.82)_100%)] px-1 py-1.5 backdrop-blur-md sm:-mx-4">
            <div className="flex gap-1 rounded-xl border border-white/10 bg-black/40 p-0.5">
              {visibleTabs.map((t) => {
                const active = profileTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProfileTab(t.id)}
                    className={[
                      "min-h-[34px] flex-1 rounded-lg px-1 py-1.5 text-[12px] font-bold transition-all sm:min-h-[38px] sm:px-1.5",
                      active
                        ? "border border-red-500/40 bg-red-600/25 text-white shadow-[0_0_20px_rgba(220,38,38,0.35)]"
                        : "border border-transparent text-white/60 hover:text-white/80",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {profileTab === "overview" ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
                {statsLoading
                  ? [0, 1, 2, 3].map((i) => (
                      <div
                        key={`st-skel-${i}`}
                        className="h-[4.75rem] animate-pulse rounded-2xl border border-white/5 bg-white/[0.07]"
                      />
                    ))
                  : (
                      [
                        {
                          Icon: PLAYER_STAT_TILES.games,
                          label: "Spiele",
                          value: String(stats.games),
                        },
                        {
                          Icon: PLAYER_STAT_TILES.goals,
                          label: "Tore",
                          value: String(stats.goals),
                        },
                        {
                          Icon: PLAYER_STAT_TILES.avgMinutesPerGame,
                          label: "Ø Min./Spiel",
                          value: avgMinutesPerGameDisplay,
                        },
                        {
                          Icon: PLAYER_STAT_TILES.minutes,
                          label: "Spielmin.",
                          value: String(stats.minutes),
                        },
                      ] as const
                    ).map((s) => (
                      <ProfileStatTile
                        key={s.label}
                        icon={<s.Icon />}
                        label={s.label}
                        value={s.value}
                      />
                    ))}
              </div>
              {statsError ? (
                <p className="mt-2 text-center text-[11px] text-amber-400/95">{statsError}</p>
              ) : null}
              {!statsLoading && !statsError && stats.games === 0 ? (
                <p className="mt-2 text-center text-[12px] text-white/60">Noch keine Ligadaten in dieser Saison</p>
              ) : null}

              <div className="mt-6">
                <h4 className="mb-2.5 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
                  Saisonstatistik
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <ProfileStatTile
                    icon={<PLAYER_STAT_TILES.goalsPerGame />}
                    label="Tore / Spiel"
                    value={goalsPerGameDisplay}
                  />
                  <ProfileStatTile
                    icon={<PLAYER_STAT_TILES.deployments />}
                    label="Einsätze"
                    value={String(stats.games)}
                  />
                </div>
              </div>

            </>
          ) : null}

          {profileTab === "matches" ? (
            <div>
              <h4 className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
                Letzte Spiele
              </h4>
              {statsLoading ? (
                <div className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={`em-skel-${i}`}
                      className="h-[5.5rem] animate-pulse rounded-2xl border border-[rgba(220,38,38,0.18)] bg-[rgba(25,25,28,0.55)]"
                    />
                  ))}
                </div>
              ) : lastMatches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] py-8 text-center text-sm text-white/70">
                  Noch keine Einsatzdaten
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {lastMatches.map((m) => (
                    <li key={m.match_id} className={APPEARANCE_MATCH_CARD_CLASS}>
                      <div
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.14)_0%,transparent_55%)]"
                        aria-hidden
                      />
                      <img
                        src={appearancePitchWatermarkSrc()}
                        alt=""
                        aria-hidden
                        draggable={false}
                        className="pointer-events-none absolute -right-1 -top-1 h-[4.75rem] w-[4.75rem] object-contain object-right-top opacity-[0.07]"
                      />
                      <div className="relative flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold uppercase tracking-wide text-white/65">
                            {m.dateLabel}
                          </div>
                          <div className="mt-1 truncate text-[17px] font-bold leading-tight text-white">{m.opponent}</div>
                        </div>
                        <div className={APPEARANCE_MATCH_SCORE_CLASS}>{m.result}</div>
                      </div>
                      <div className="relative mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <EinsatzBadge kind={m.badgeKind} label={m.badgeLabel} />
                        <span className="text-sm font-bold tabular-nums text-amber-200/95">
                          ⚽ {m.goals}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {profileTab === "achievements" ? (
            <div>
              <h4 className="mb-2.5 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
                Auszeichnungen
              </h4>
              <div className="grid gap-2.5 sm:grid-cols-1">
                {[
                  { title: "Spieler des Spiels", sub: "Demnächst" },
                  { title: "Team-Erfolge", sub: "Meisterschaft, Aufstieg …" },
                  { title: "Turniere", sub: "Pokal & Turnierplatzierungen" },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="rounded-2xl border border-white/10 bg-gradient-to-r from-red-950/35 to-black/40 px-3 py-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 shrink-0 text-red-400/80" strokeWidth={1.75} aria-hidden />
                      <div>
                        <div className="text-[16px] font-semibold text-white">{c.title}</div>
                        <div className="text-[14px] text-white/75">{c.sub}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-[14px] font-medium text-white/80">Noch keine Erfolge</p>
            </div>
          ) : null}

          {profileTab === "training" ? (
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-400/85" strokeWidth={1.75} aria-hidden />
                <h4 className="text-[12px] font-extrabold uppercase tracking-wide text-red-300/90">
                  Trainingsbeteiligung
                </h4>
              </div>
              {trainingStatsLoading ? (
                <p className="mt-4 text-[13px] text-white/65">Lade Trainingsdaten…</p>
              ) : trainingStatsError ? (
                <p className="mt-4 text-[13px] text-red-300/90">{trainingStatsError}</p>
              ) : (
                <>
                  <p className="mt-4 text-[12px] text-white/55">
                    Saison:{' '}
                    <span className="font-medium text-white/75">
                      {pastTeamTrainings} vergangene Team-Trainings
                    </span>
                  </p>
                  {!teamRankingLoading && squadParticipationAvg != null ? (
                    <p className="mt-2 text-[12px] text-white/55">
                      {formatSquadParticipationLabel(squadParticipationAvg)}
                    </p>
                  ) : null}
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] text-white/70">Team-Trainingsbeteiligung</span>
                        <div className="shrink-0 text-right">
                          <span className="text-[20px] font-bold tabular-nums text-white">{teamTrainingRatePct}%</span>
                          <p className="mt-0.5 text-xs text-white/60">
                            {trainingsPresent} von {teamTrainingBasis} Trainings
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400"
                          style={{ width: `${Math.min(100, Math.max(0, teamTrainingRatePct))}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] text-white/70">Trainingsaktivität gesamt</span>
                        <div className="shrink-0 text-right">
                          <span className="text-[20px] font-bold tabular-nums text-white">
                            {activityTrainingRatePct}%
                          </span>
                          <p className="mt-0.5 text-xs text-white/60">
                            {activityTrainingNumerator} von {activityTrainingBasis} Trainings
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 via-red-500 to-emerald-500"
                          style={{ width: `${Math.min(100, Math.max(0, activityTrainingRatePct))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <SeasonMiniCell label="Dabei" value={String(trainingsPresent)} />
                    <SeasonMiniCell label="Abwesend" value={String(trainingsAbsent)} />
                    <SeasonMiniCell label="Verletzt" value={String(trainingsInjured)} />
                    <SeasonMiniCell label="LAZ" value={String(trainingsExternal)} />
                    {trainingsOpen > 0 ? (
                      <SeasonMiniCell label="Offen" value={String(trainingsOpen)} />
                    ) : null}
                    {trainingsLegacyUnknown > 0 ? (
                      <SeasonMiniCell label="N. erf." value={String(trainingsLegacyUnknown)} />
                    ) : null}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/55">
                    Verletzt, offen und nicht erfasst zählen nicht in die Quoten.
                  </p>
                </>
              )}
            </div>
          ) : null}

          {canManage ? (
            <div className="mt-5 pb-1">
              <AppButton type="button" variant="primary" size="lg" fullWidth onClick={onEdit}>
                Bearbeiten
              </AppButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
