import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { lockAppMainScroll } from "../../lib/bodyScrollLock";
import { APP_BOTTOM_SCROLL_PAD } from "../../lib/appScrollPadding";
import { Activity, CalendarDays, ChevronDown, Trophy, User } from "lucide-react";
import { ProfileCompactHeader } from "./profile/ProfileCompactHeader";
import { ProfileHeroCard } from "./profile/ProfileHeroCard";
import { ProfileStatTile } from "./ProfileStatTile";
import { PLAYER_STAT_TILES } from "./profile/profileStatIcons";
import type { PlayerItem } from "../../hooks/usePlayers";
import { updatePlayerMasterFlags } from "../../lib/rosterService";
import { usePlayerStats, type PlayerStatsMode } from "../../hooks/usePlayerStats";
import { usePlayerTrainingStats } from "../../hooks/usePlayerTrainingStats";
import { useTeamTrainingRanking } from "../../hooks/useTeamTrainingRanking";
import { useTrainingParticipationAccess } from "../../hooks/useTrainingParticipationAccess";
import {
  listPlayerSeasonOptions,
  type PlayerSeasonOption,
} from "../../lib/stats/playerStatsService";
import { formatSquadParticipationLabel } from "../../lib/trainingRanking";
import { dsPrimaryCtaClass } from "../../lib/premiumDesignSystem";
import {
  getPositionFull,
  getPositionLabel,
  getProfilePositionBadge,
  getTrainingPositionDisplay,
  isGoalkeeperProfilePosition,
} from "../../lib/positionLabels";
import { splitTeamSeasonLabel } from "./profile/profileHeroShared";
import {
  ProfileGoalkeeperStatsPlaceholder,
  ProfileTrainingAwardsSection,
  ProfileTrainingKaiserStatus,
} from "./profile/ProfileTrainingExtras";

const PROFILE_GLASS_PANEL =
  "overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.22)] bg-gradient-to-br from-[rgba(18,18,20,0.98)] to-[rgba(60,10,18,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_rgba(220,38,38,0.08)]";

const PROFILE_METRIC_TILE =
  "rounded-xl border border-[rgba(220,38,38,0.16)] bg-[rgba(8,8,10,0.72)] px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

const PROFILE_PROGRESS_TRACK =
  "mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)] ring-1 ring-[rgba(255,255,255,0.04)]";

const PROFILE_SETTINGS_PANEL =
  "overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.2)] bg-gradient-to-br from-[rgba(14,14,16,0.98)] to-[rgba(45,8,14,0.35)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(220,38,38,0.06)]";

export type PlayerProfileModalProps = {
  player: PlayerItem;
  role: string | null;
  /** Aktuelle Team-Saison (für saisonbezogene LAZ-Updates im Join). */
  teamSeasonId?: string | null;
  teamSeasonLabel: string | null;
  teamName?: string | null;
  photoUrl: string | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Nach LAZ-Flag-Änderung Kader + Profil-State aktualisieren. */
  onPlayerUpdated?: (
    patch: Pick<PlayerItem, "is_laz_player" | "is_injured" | "injured_since" | "injured_until">,
  ) => void;
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
    <div className={`${PROFILE_METRIC_TILE} text-center`}>
      <div className="whitespace-nowrap text-[10px] font-medium tracking-wide text-white/50">{label}</div>
      <div className="mt-0.5 text-[20px] font-bold tabular-nums leading-none text-white">{value}</div>
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

function PlayerSpecialSettingsAccordion({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-3" aria-labelledby="player-special-settings-heading">
      <button
        type="button"
        id="player-special-settings-heading"
        aria-expanded={open}
        aria-controls="player-special-settings-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[rgba(220,38,38,0.2)] bg-[rgba(8,8,10,0.72)] px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[rgba(220,38,38,0.32)]"
      >
        <span className="whitespace-nowrap text-[12px] font-semibold text-white/62">
          <span className="mr-1.5" aria-hidden>
            ⚙️
          </span>
          Spezielle Einstellungen
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id="player-special-settings-panel" className={`mt-2 ${PROFILE_SETTINGS_PANEL}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SpecialSettingToggleRow({
  label,
  hint,
  checked,
  disabled,
  error,
  accent = "green",
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  error?: string | null;
  accent?: "violet" | "amber";
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-3 border-b border-[rgba(220,38,38,0.1)] px-3 py-3 last:border-b-0 sm:px-3.5",
        checked
          ? accent === "amber"
            ? "bg-[rgba(88,46,10,0.12)]"
            : "bg-[rgba(46,16,88,0.12)]"
          : "bg-transparent",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1 pr-1">
        <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-white/88">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-white/45">{hint}</p>
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
          "relative h-[28px] w-[48px] shrink-0 rounded-full border transition-all duration-200",
          checked
            ? accent === "amber"
              ? "border-amber-500/45 bg-amber-950/75 shadow-[0_0_16px_rgba(251,191,36,0.18)]"
              : "border-violet-500/40 bg-violet-950/70 shadow-[0_0_16px_rgba(139,92,246,0.15)]"
            : "border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.5)]",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-[3px] h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-[left,background-color] duration-200",
            checked
              ? accent === "amber"
                ? "left-[24px] bg-amber-100"
                : "left-[24px] bg-violet-100"
              : "left-[3px] bg-white/75",
          ].join(" ")}
          aria-hidden
        />
      </button>
    </div>
  );
}

function PlayerPremiumStatusBadge({ kind }: { kind: "active" | "laz" | "injured" }) {
  const config = {
    active: {
      emoji: "🟢",
      label: "Aktiver Spieler",
      styles:
        "border-emerald-500/40 bg-gradient-to-br from-emerald-950/65 to-emerald-900/20 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.22)]",
    },
    laz: {
      emoji: "🟣",
      label: "LAZ-Spieler",
      styles:
        "border-violet-500/40 bg-gradient-to-br from-violet-950/65 to-violet-900/20 text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.22)]",
    },
    injured: {
      emoji: "🟠",
      label: "Verletzt",
      styles:
        "border-amber-500/40 bg-gradient-to-br from-amber-950/65 to-amber-900/20 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.22)]",
    },
  }[kind];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.01em] ${config.styles}`}
    >
      <span aria-hidden>{config.emoji}</span>
      {config.label}
    </span>
  );
}

function PlayerStatusBadgesRow({ isLaz, isInjured }: { isLaz: boolean; isInjured: boolean }) {
  if (isLaz && isInjured) {
    return (
      <>
        <PlayerPremiumStatusBadge kind="laz" />
        <PlayerPremiumStatusBadge kind="injured" />
      </>
    );
  }
  if (isLaz) return <PlayerPremiumStatusBadge kind="laz" />;
  if (isInjured) return <PlayerPremiumStatusBadge kind="injured" />;
  return <PlayerPremiumStatusBadge kind="active" />;
}

function TrainingMetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={PROFILE_METRIC_TILE}>
      <p className="whitespace-nowrap text-[10px] font-medium text-white/50">{label}</p>
      <p className="mt-1 text-[20px] font-bold tabular-nums leading-none text-white">{value}</p>
    </div>
  );
}

function TrainingProgressRow({
  label,
  pct,
  detail,
  variant,
}: {
  label: string;
  pct: number;
  detail: string;
  variant: "quote" | "activity";
}) {
  const fillClass =
    variant === "quote"
      ? "bg-gradient-to-r from-[rgba(170,28,38,0.9)] to-[rgba(210,70,45,0.8)] shadow-[0_0_14px_rgba(220,38,38,0.22)]"
      : "bg-gradient-to-r from-[rgba(90,50,160,0.75)] to-[rgba(35,130,85,0.8)] shadow-[0_0_14px_rgba(100,60,180,0.18)]";

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <span className="shrink-0 whitespace-nowrap text-[13px] text-white/70">{label}</span>
        <div className="min-w-0 text-right">
          <span className="text-[20px] font-bold tabular-nums text-white">{pct}%</span>
          <p className="mt-0.5 whitespace-nowrap text-[11px] text-white/45">{detail}</p>
        </div>
      </div>
      <div className={PROFILE_PROGRESS_TRACK}>
        <div
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function ProfileTrainingOverviewCompact({
  loading,
  teamRatePct,
  activityRatePct,
  present,
  absent,
  sick,
  injured,
  external,
  trainingRank,
}: {
  loading: boolean;
  teamRatePct: number;
  activityRatePct: number;
  present: number;
  absent: number;
  sick: number;
  injured: number;
  external: number;
  trainingRank: number | null;
}) {
  if (loading) {
    return <p className="mt-4 text-[12px] text-white/55">Lade Trainingsdaten…</p>;
  }

  const summaryFull = `${present} Dabei · ${absent} Abwesend · ${sick} Krank · ${injured} Verletzt · ${external} LAZ`;
  const summaryCompact = `${present} Dabei · ${absent} Abwesend · ${teamRatePct} %`;

  return (
    <div className={`mt-4 p-3 sm:p-3.5 ${PROFILE_GLASS_PANEL}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-300/85">
          Training
        </h4>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <TrainingMetricTile label="Trainingsquote" value={`${teamRatePct} %`} />
        <TrainingMetricTile label="Aktivität" value={`${activityRatePct} %`} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/45 [hyphens:none]">
        <span className="hidden min-[380px]:inline">{summaryFull}</span>
        <span className="min-[380px]:hidden">{summaryCompact}</span>
      </p>
      <ProfileTrainingKaiserStatus rank={trainingRank} />
      <p className="mt-2 text-[10px] text-white/35">Details im Tab Training</p>
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
      <div className="rounded-full border border-[rgba(220,38,38,0.2)] bg-[rgba(8,8,12,0.94)] px-4 py-2 text-[13px] font-medium text-white/92 shadow-[0_10px_36px_rgba(0,0,0,0.55)] backdrop-blur-md">
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
  teamSeasonId = null,
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
  const [isInjuredPlayer, setIsInjuredPlayer] = useState(player.is_injured);
  const [lazSaving, setLazSaving] = useState(false);
  const [injuredSaving, setInjuredSaving] = useState(false);
  const [lazError, setLazError] = useState<string | null>(null);
  const [injuredError, setInjuredError] = useState<string | null>(null);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [seasonOptions, setSeasonOptions] = useState<PlayerSeasonOption[]>([]);
  /** null = career/gesamt; sonst team_season_id */
  const [statsFilterId, setStatsFilterId] = useState<string | null>(teamSeasonId ?? player.team_season_id ?? null);
  const [statsMode, setStatsMode] = useState<PlayerStatsMode>("season");

  const { canViewForPlayer } = useTrainingParticipationAccess(role);
  const canViewTrainingParticipation = canViewForPlayer(player.id);
  const visibleTabs = useMemo(
    () => TAB_CONFIG.filter((t) => t.id !== "training" || canViewTrainingParticipation),
    [canViewTrainingParticipation],
  );

  useEffect(() => {
    const defaultId = (teamSeasonId ?? player.team_season_id ?? "").trim() || null;
    setStatsFilterId(defaultId);
    setStatsMode("season");
  }, [player.id, teamSeasonId, player.team_season_id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await listPlayerSeasonOptions(player.id);
      if (cancelled) return;
      setSeasonOptions(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [player.id]);

  const careerSeasonIds = useMemo(
    () => seasonOptions.map((o) => o.teamSeasonId),
    [seasonOptions],
  );

  const statsSeasonId = statsMode === "season" ? statsFilterId : null;
  const { data: stats, lastMatches, isLoading: statsLoading, error: statsError } = usePlayerStats(
    player.id,
    statsSeasonId,
    statsMode,
  );
  const {
    stats: trainingStats,
    loading: trainingStatsLoading,
    error: trainingStatsError,
  } = usePlayerTrainingStats(player.id, statsSeasonId, canViewTrainingParticipation, {
    mode: statsMode,
    careerSeasonIds,
  });

  const rankingSeasonId =
    statsMode === "season" ? statsFilterId ?? teamSeasonId ?? player.team_season_id : teamSeasonId ?? player.team_season_id;
  const { sessionsCount, teamParticipationPct, qualified, loading: teamRankingLoading } = useTeamTrainingRanking(
    squadPlayers,
    rankingSeasonId,
    canViewTrainingParticipation && statsMode === "season",
  );
  const squadParticipationPct = teamParticipationPct;
  const pastTeamTrainings = sessionsCount > 0 ? sessionsCount : trainingStats.sessionsCounted;

  const trainingKaiserRank = useMemo(() => {
    const row = qualified.find((entry) => entry.player.id === player.id);
    return row?.rank ?? null;
  }, [qualified, player.id]);

  const seasonStatSub = useMemo(() => {
    if (statsMode === "career") return "Gesamt / Karriere";
    const opt = seasonOptions.find((o) => o.teamSeasonId === statsFilterId);
    if (opt?.seasonName) return `Saison ${opt.seasonName}`;
    const season = splitTeamSeasonLabel(teamSeasonLabel ?? "").season.trim();
    return season ? `Saison ${season}` : "Saison";
  }, [statsMode, seasonOptions, statsFilterId, teamSeasonLabel]);

  const profilePositionBadge = useMemo(() => getProfilePositionBadge(player.position), [player.position]);
  const showGoalkeeperPlaceholder = isGoalkeeperProfilePosition(player.position);

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
  const trainingsSick = trainingStats.sick;
  const trainingsInjured = trainingStats.injured;
  const trainingsExternal = trainingStats.external;
  const teamTrainingBasis = trainingsPresent + trainingsAbsent;
  const activityTrainingNumerator = trainingsPresent + trainingsExternal;
  const activityTrainingBasis = activityTrainingNumerator + trainingsAbsent;

  useEffect(() => {
    setIsLazPlayer(player.is_laz_player);
    setIsInjuredPlayer(player.is_injured);
    setLazError(null);
    setInjuredError(null);
  }, [player.id, player.is_laz_player, player.is_injured]);

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

  useEffect(() => lockAppMainScroll(), []);

  const handleLazPlayerToggle = async (next: boolean) => {
    if (!canManage || lazSaving) return;
    const previous = player.is_laz_player;
    setLazSaving(true);
    setLazError(null);
    setIsLazPlayer(next);
    const seasonId = teamSeasonId ?? player.team_season_id;
    const { ok, error } = await updatePlayerMasterFlags({
      playerId: player.id,
      teamSeasonId: seasonId,
      is_laz_player: next,
    });
    setLazSaving(false);
    if (!ok) {
      setIsLazPlayer(previous);
      setLazError(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    setSaveToastVisible(true);
    onPlayerUpdated?.({ is_laz_player: next });
  };

  const handleInjuredPlayerToggle = async (next: boolean) => {
    if (!canManage || injuredSaving) return;
    const previous = {
      is_injured: player.is_injured,
      injured_since: player.injured_since,
      injured_until: player.injured_until,
    };
    const nowIso = new Date().toISOString();
    setInjuredSaving(true);
    setInjuredError(null);
    setIsInjuredPlayer(next);
    const patch = next
      ? { is_injured: true as const, injured_since: nowIso, injured_until: null as string | null }
      : { is_injured: false as const, injured_since: null as string | null, injured_until: nowIso };
    const { ok, error } = await updatePlayerMasterFlags({
      playerId: player.id,
      teamSeasonId: teamSeasonId ?? player.team_season_id,
      ...patch,
    });
    setInjuredSaving(false);
    if (!ok) {
      setIsInjuredPlayer(previous.is_injured);
      setInjuredError(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    setSaveToastVisible(true);
    onPlayerUpdated?.(patch);
  };

  const lazToggleChecked = lazSaving ? isLazPlayer : player.is_laz_player;
  const injuredToggleChecked = injuredSaving ? isInjuredPlayer : player.is_injured;

  if (typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-[3px] sm:block"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-lg min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(28,8,8,0.98)_0%,rgba(0,0,0,0.97)_42%,rgba(6,6,10,0.99)_100%)] sm:h-auto sm:max-h-[min(94vh,920px)] sm:rounded-3xl sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ProfileSaveSnackbar visible={saveToastVisible} />
        <ProfileCompactHeader
          title="Spielerprofil"
          titleId="player-profile-title"
          onBack={onClose}
          backLabel="Zurück"
        />

        <div
          className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pt-2 [-webkit-overflow-scrolling:touch] [hyphens:none] sm:px-4"
          style={{ paddingBottom: `calc(${APP_BOTTOM_SCROLL_PAD})` }}
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
            positionBadge={profilePositionBadge}
            statusSlot={
              <PlayerStatusBadgesRow isLaz={lazToggleChecked} isInjured={injuredToggleChecked} />
            }
          />

          {ageLabel || birthYearLabel ? (
            <div className="mb-2.5 mt-1 grid grid-cols-2 gap-1.5">
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
            <PlayerSpecialSettingsAccordion>
              <SpecialSettingToggleRow
                label="LAZ-Spieler"
                hint="Kennzeichnet Spieler mit Leistungsaufenthaltszentrum (LAZ) für Trainings."
                checked={lazToggleChecked}
                disabled={lazSaving}
                error={lazError}
                accent="violet"
                onChange={(next) => void handleLazPlayerToggle(next)}
              />
              <SpecialSettingToggleRow
                label="Verletzt"
                hint="Langzeit-Ausfall: zukünftige Trainings und Spiele ohne Eintrag werden automatisch als verletzt geführt."
                checked={injuredToggleChecked}
                disabled={injuredSaving}
                error={injuredError}
                accent="amber"
                onChange={(next) => void handleInjuredPlayerToggle(next)}
              />
            </PlayerSpecialSettingsAccordion>
          ) : null}

          {/* Sticky tabs */}
          <div className="sticky top-0 z-10 -mx-3 mb-3 border-b border-[rgba(220,38,38,0.12)] bg-[linear-gradient(180deg,rgba(8,4,6,0.96)_0%,rgba(0,0,0,0.88)_100%)] px-1 py-1 backdrop-blur-md sm:-mx-4">
            <div className="flex gap-1 rounded-xl border border-[rgba(220,38,38,0.16)] bg-[rgba(8,8,10,0.85)] p-0.5">
              {visibleTabs.map((t) => {
                const active = profileTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProfileTab(t.id)}
                    className={[
                      "min-h-[34px] flex-1 whitespace-nowrap rounded-lg px-1 py-1.5 text-[11px] font-bold transition-all sm:min-h-[38px] sm:px-1.5 sm:text-[12px]",
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

          <div className="-mx-1 mb-3 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max min-w-full gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStatsMode("career");
                  setStatsFilterId(null);
                }}
                className={[
                  "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                  statsMode === "career"
                    ? "border-red-500/50 bg-red-600/30 text-white"
                    : "border-white/15 bg-black/40 text-white/70 hover:text-white",
                ].join(" ")}
              >
                Gesamt
              </button>
              {seasonOptions.map((opt) => {
                const active = statsMode === "season" && statsFilterId === opt.teamSeasonId;
                const short =
                  [opt.seasonName, opt.ageGroup].filter(Boolean).join(" · ") ||
                  opt.label.replace(/\s*·\s*Archiv$/i, "");
                return (
                  <button
                    key={opt.teamSeasonId}
                    type="button"
                    onClick={() => {
                      setStatsMode("season");
                      setStatsFilterId(opt.teamSeasonId);
                    }}
                    className={[
                      "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                      active
                        ? "border-red-500/50 bg-red-600/30 text-white"
                        : "border-white/15 bg-black/40 text-white/70 hover:text-white",
                    ].join(" ")}
                  >
                    {short}
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
                        className="h-[4.75rem] animate-pulse rounded-2xl border border-[rgba(220,38,38,0.12)] bg-[rgba(25,25,28,0.45)]"
                      />
                    ))
                  : (
                      [
                        {
                          Icon: PLAYER_STAT_TILES.games,
                          label: "Spiele",
                          value: String(stats.games),
                          sub: seasonStatSub,
                        },
                        {
                          Icon: PLAYER_STAT_TILES.goals,
                          label: "Tore",
                          value: String(stats.goals),
                          sub: "Meisterschaft & Turniere",
                        },
                        {
                          Icon: PLAYER_STAT_TILES.avgMinutesPerGame,
                          label: "Ø Min./Spiel",
                          value: avgMinutesPerGameDisplay,
                          sub: "Durchschnitt",
                        },
                        {
                          Icon: PLAYER_STAT_TILES.minutes,
                          label: "Spielmin.",
                          value: String(stats.minutes),
                          sub: "Gesamt",
                        },
                      ] as const
                    ).map((s) => (
                      <ProfileStatTile
                        key={s.label}
                        icon={<s.Icon />}
                        label={s.label}
                        value={s.value}
                        sub={s.sub}
                      />
                    ))}
              </div>
              {statsError ? (
                <p className="mt-2 text-center text-[11px] text-amber-400/95">{statsError}</p>
              ) : null}
              {!statsLoading && !statsError && stats.games === 0 ? (
                <p className="mt-2 text-center text-[12px] text-white/60">
                  {statsMode === "career"
                    ? "Noch keine gültigen Spieldaten in der Karriere"
                    : "Noch keine Ligadaten in dieser Saison"}
                </p>
              ) : null}

              <div className="mt-4">
                <h4 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
                  {statsMode === "career" ? "Gesamtstatistik" : "Saisonstatistik"}
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  <ProfileStatTile
                    icon={<PLAYER_STAT_TILES.goalsPerGame />}
                    label="Tore / Spiel"
                    value={goalsPerGameDisplay}
                    sub="Durchschnitt"
                  />
                  <ProfileStatTile
                    icon={<PLAYER_STAT_TILES.deployments />}
                    label="Einsätze"
                    value={String(stats.games)}
                    sub={seasonStatSub}
                  />
                </div>
              </div>

              {showGoalkeeperPlaceholder ? <ProfileGoalkeeperStatsPlaceholder /> : null}

              {canViewTrainingParticipation ? (
                <>
                  <ProfileTrainingOverviewCompact
                    loading={trainingStatsLoading || teamRankingLoading}
                    teamRatePct={teamTrainingRatePct}
                    activityRatePct={activityTrainingRatePct}
                    present={trainingsPresent}
                    absent={trainingsAbsent}
                    sick={trainingsSick}
                    injured={trainingsInjured}
                    external={trainingsExternal}
                    trainingRank={trainingKaiserRank}
                  />
                  <ProfileTrainingAwardsSection />
                </>
              ) : null}

            </>
          ) : null}

          {profileTab === "matches" ? (
            <div>
              <h4 className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
                {statsMode === "career" ? "Letzte Spiele (Gesamt)" : "Letzte Spiele"}
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
                <p className="rounded-xl border border-dashed border-[rgba(220,38,38,0.2)] bg-[rgba(8,8,10,0.5)] py-8 text-center text-sm text-white/60">
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
                    className={`px-3 py-3.5 sm:px-3.5 ${PROFILE_GLASS_PANEL}`}
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
            <>
              <div className={`p-3 sm:p-3.5 ${PROFILE_GLASS_PANEL}`}>
                <div className="flex min-w-0 items-center gap-2">
                  <Activity className="h-5 w-5 shrink-0 text-red-400/85" strokeWidth={1.75} aria-hidden />
                  <h4 className="whitespace-nowrap text-[12px] font-extrabold uppercase tracking-wide text-red-300/90">
                    Trainingsbeteiligung
                  </h4>
                </div>
                {trainingStatsLoading ? (
                  <p className="mt-3 text-[13px] text-white/55">Lade Trainingsdaten…</p>
                ) : trainingStatsError ? (
                  <p className="mt-3 text-[13px] text-red-300/90">{trainingStatsError}</p>
                ) : (
                  <>
                    <p className="mt-3 text-[12px] text-white/50">
                      Saison:{" "}
                      <span className="font-medium text-white/75">
                        {pastTeamTrainings} vergangene Team-Trainings
                      </span>
                    </p>
                    {!teamRankingLoading && squadParticipationPct != null ? (
                      <p className="mt-2 text-[12px] text-white/50">
                        {formatSquadParticipationLabel(squadParticipationPct)}
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-3">
                      <TrainingProgressRow
                        label="Trainingsquote"
                        pct={teamTrainingRatePct}
                        detail={`${trainingsPresent} von ${teamTrainingBasis} Trainings`}
                        variant="quote"
                      />
                      <TrainingProgressRow
                        label="Aktivität"
                        pct={activityTrainingRatePct}
                        detail={`${activityTrainingNumerator} von ${activityTrainingBasis} Trainings`}
                        variant="activity"
                      />
                    </div>
                    <p className="mt-3 text-[11px] leading-snug text-white/45 [hyphens:none]">
                      {trainingsPresent} Dabei · {trainingsAbsent} Abwesend · {trainingsSick} Krank ·{" "}
                      {trainingsInjured} Verletzt · {trainingsExternal} LAZ
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <SeasonMiniCell label="Dabei" value={String(trainingsPresent)} />
                      <SeasonMiniCell label="Abwesend" value={String(trainingsAbsent)} />
                      <SeasonMiniCell label="Krank" value={String(trainingsSick)} />
                      <SeasonMiniCell label="Verletzt" value={String(trainingsInjured)} />
                      <SeasonMiniCell label="LAZ" value={String(trainingsExternal)} />
                    </div>
                    <p className="mt-2.5 text-[11px] leading-relaxed text-white/45 [hyphens:none]">
                      Trainingsquote: Dabei / (Dabei + Abwesend). Krank, verletzt und LAZ zählen neutral.
                      Aktivität berücksichtigt LAZ zusätzlich.
                    </p>
                    {!teamRankingLoading ? (
                      <ProfileTrainingKaiserStatus rank={trainingKaiserRank} />
                    ) : null}
                  </>
                )}
              </div>
              <ProfileTrainingAwardsSection />
            </>
          ) : null}

          {canManage ? (
            <div className="mt-5 pb-1">
              <button
                type="button"
                onClick={onEdit}
                className={`w-full ${dsPrimaryCtaClass()} !min-h-[44px] !px-4 !py-2.5 !text-[15px] !font-semibold`}
              >
                Bearbeiten
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
