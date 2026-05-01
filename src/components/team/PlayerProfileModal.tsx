import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { PlayerItem } from "../../hooks/usePlayers";
import { usePlayerStats } from "../../hooks/usePlayerStats";
import { Button } from "../../app/components/ui/Button";
import { getPlayerBirthDisplayLines } from "../../lib/playerBirthDisplay";
import { getPositionFull, getPositionLabel } from "../../lib/positionLabels";

export type PlayerProfileModalProps = {
  player: PlayerItem;
  role: string | null;
  teamSeasonLabel: string | null;
  photoUrl: string | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
};

function displayFullName(p: PlayerItem): string {
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || p.display_name.trim() || "Spieler";
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

function ageChipLabel(birthdate: string | null | undefined): string {
  const age = getAge(birthdate);
  if (age == null) return "-";
  return `${age} Jahre`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-1 text-lg font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-white/90">
      {children}
    </span>
  );
}

function EinsatzBadge({ kind, label }: { kind: "full" | "sub_in" | "bank" | "partial"; label: string }) {
  const base =
    "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide";
  if (kind === "bank") {
    return <span className={`${base} border-white/20 bg-white/10 text-white/55`}>{label}</span>;
  }
  if (kind === "sub_in") {
    return <span className={`${base} border-emerald-500/45 bg-emerald-950/50 text-emerald-100`}>{label}</span>;
  }
  if (kind === "full") {
    return <span className={`${base} border-red-500/40 bg-red-950/45 text-red-100`}>{label}</span>;
  }
  return <span className={`${base} border-amber-500/35 bg-amber-950/40 text-amber-100`}>{label}</span>;
}

/**
 * Premium player profile overlay (dark stadium).
 */
export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  role,
  teamSeasonLabel,
  photoUrl,
  canManage,
  onClose,
  onEdit,
}) => {
  const [profileTab, setProfileTab] = useState<"saison" | "einsaetze">("saison");
  const { data: stats, lastMatches, isLoading: statsLoading, error: statsError } = usePlayerStats(
    player.id,
    player.team_season_id,
  );

  const goalsPer90Display = useMemo(() => {
    const v = Number(stats.goalsPer90);
    if (!Number.isFinite(v)) return "0.00";
    return v.toFixed(2);
  }, [stats.goalsPer90]);

  const name = displayFullName(player);
  const avatarSrc = (photoUrl ?? "").trim() || "/avatars/player-placeholder.png";
  const jerseyChip =
    player.jersey_number != null && Number.isFinite(Number(player.jersey_number))
      ? `#${player.jersey_number}`
      : "—";
  const positionLabel = getPositionLabel(player.position) || "—";
  const positionFull = getPositionFull(player.position);
  const birthDisplayLines = getPlayerBirthDisplayLines(role, player.birthdate);

  const trainingParticipationPct = 0;
  const trainingsAttended = 0;
  const trainingsTotal = 0;
  const hasTrainingBars = false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-red-500/25 bg-[linear-gradient(180deg,rgba(24,6,6,0.98)_0%,rgba(0,0,0,0.97)_45%,rgba(5,5,8,0.99)_100%)] shadow-[0_0_0_1px_rgba(239,68,68,0.12),0_-20px_60px_rgba(0,0,0,0.65),0_0_80px_rgba(220,38,38,0.12)] sm:rounded-3xl sm:shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-3 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/90 transition-colors hover:bg-white/10"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h2 id="player-profile-title" className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-white/90">
            Spielerprofil
          </h2>
          <div className="w-10 shrink-0" aria-hidden />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-red-500/20 blur-md" aria-hidden />
              <div className="relative h-28 w-28 sm:h-32 sm:w-32">
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-full w-full rounded-full border-2 border-red-500/40 object-cover shadow-[0_0_24px_rgba(239,68,68,0.35)]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (next) next.style.display = "flex";
                  }}
                />
                <div
                  className="flex h-full w-full items-center justify-center rounded-full border-2 border-white/20 bg-zinc-800 text-2xl font-black text-white shadow-[0_0_24px_rgba(239,68,68,0.2)]"
                  style={{ display: "none" }}
                >
                  {initials(player)}
                </div>
              </div>
            </div>
            <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">{name}</h3>
            <p className="mt-1 max-w-[280px] text-sm text-white/55">{teamSeasonLabel ?? "Team"}</p>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Chip>Alter: {ageChipLabel(player.birthdate)}</Chip>
            {birthDisplayLines.map((line) => (
              <Chip key={line}>{line}</Chip>
            ))}
            <Chip>
              <span title={positionFull || undefined}>Position: {positionLabel}</span>
            </Chip>
            <Chip>Rückennummer: {jerseyChip}</Chip>
          </div>

          <div className="mt-5 flex w-full justify-center gap-1 rounded-xl border border-white/10 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setProfileTab("saison")}
              className={[
                "min-h-[38px] flex-1 rounded-lg px-2 text-xs font-bold transition-colors sm:text-sm",
                profileTab === "saison" ? "bg-red-600 text-white shadow-sm" : "text-white/50 hover:text-white/85",
              ].join(" ")}
            >
              Saison
            </button>
            <button
              type="button"
              onClick={() => setProfileTab("einsaetze")}
              className={[
                "min-h-[38px] flex-1 rounded-lg px-2 text-xs font-bold transition-colors sm:text-sm",
                profileTab === "einsaetze" ? "bg-red-600 text-white shadow-sm" : "text-white/50 hover:text-white/85",
              ].join(" ")}
            >
              Einsätze
            </button>
          </div>

          {profileTab === "saison" ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {statsLoading
                  ? [0, 1, 2, 3].map((i) => (
                      <div
                        key={`st-skel-${i}`}
                        className="h-[4.5rem] animate-pulse rounded-2xl border border-white/5 bg-white/[0.07]"
                      />
                    ))
                  : [
                      { label: "Spiele", value: String(stats.games) },
                      { label: "Tore", value: String(stats.goals) },
                      { label: "Spielmin.", value: String(stats.minutes) },
                      { label: "Tore / 90", value: goalsPer90Display },
                    ].map((s) => <StatCard key={s.label} label={s.label} value={s.value} />)}
              </div>
              {statsError ? (
                <p className="mt-2 text-center text-[11px] text-amber-400/95">{statsError}</p>
              ) : null}
              {!statsLoading && !statsError && stats.games === 0 ? (
                <p className="mt-2 text-center text-[11px] text-white/40">Noch keine Ligadaten in dieser Saison</p>
              ) : null}

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-red-300/90">Training</h4>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-sm text-white/70">Teilnahmequote</span>
                  <span className="text-lg font-black text-white">{trainingParticipationPct}%</span>
                </div>
                <p className="mt-1 text-xs text-white/50">
                  Trainings teilgenommen: {trainingsAttended} / {trainingsTotal}
                </p>
                {hasTrainingBars ? (
                  <div className="mt-3 flex gap-1">{/* später event_attendance */}</div>
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed border-white/15 bg-white/[0.03] py-4 text-center text-xs text-white/45">
                    Noch keine Trainingsdaten
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-red-300/90">Letzte Einsätze</h4>
              {statsLoading ? (
                <div className="mt-4 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={`em-skel-${i}`} className="h-16 animate-pulse rounded-xl bg-white/[0.06]" />
                  ))}
                </div>
              ) : lastMatches.length === 0 ? (
                <p className="mt-4 text-center text-sm text-white/50">Noch keine Einsätze (beendete Spiele)</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {lastMatches.map((m) => (
                    <li
                      key={m.match_id}
                      className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{m.opponent}</span>
                          <span className="rounded border border-white/15 bg-black/30 px-1.5 py-px text-[11px] font-bold tabular-nums text-white/90">
                            {m.result}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-white/50">{m.dateLabel}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <EinsatzBadge kind={m.badgeKind} label={m.badgeLabel} />
                        {m.goals > 0 ? (
                          <span className="text-[11px] font-bold text-amber-200/90">⚽ {m.goals}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {canManage ? (
            <div className="mt-6 pb-2">
              <Button type="button" fullWidth className="bg-red-600 text-white hover:bg-red-500" onClick={onEdit}>
                Bearbeiten
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
