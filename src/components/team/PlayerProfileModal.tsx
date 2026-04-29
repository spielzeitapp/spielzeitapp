import React, { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import type { PlayerItem } from "../../hooks/usePlayers";
import { Button } from "../../app/components/ui/Button";

export type PlayerProfileModalProps = {
  player: PlayerItem;
  teamSeasonLabel: string | null;
  positionAbbrev: string;
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

/** Completed age in years from `YYYY-MM-DD` (local calendar), or null if unknown/invalid/future. */
function completedAgeFromIsoDate(ymd: string | null | undefined): number | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const ref = new Date();
  const ry = ref.getFullYear();
  const rm = ref.getMonth() + 1;
  const rd = ref.getDate();
  let age = ry - y;
  if (rm < mo || (rm === mo && rd < d)) age--;
  if (age < 0) return null;
  return age;
}

function ageChipLabel(birthdate: string | null | undefined): string {
  const age = completedAgeFromIsoDate(birthdate);
  if (age == null) return "-";
  return String(age);
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

/**
 * Premium player profile overlay (dark stadium).
 * TODO: Wire Spiele / Tore / Minuten / Tore pro 90 from match + attendance services when available.
 * TODO: Wire training participation + last trainings bar from event_attendance / training events.
 * TODO: Wire last 5 matches from matches + match_events scoped to this player_id.
 */
export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  teamSeasonLabel,
  positionAbbrev,
  photoUrl,
  canManage,
  onClose,
  onEdit,
}) => {
  const name = displayFullName(player);
  const avatarSrc = (photoUrl ?? "").trim() || "/avatars/player-placeholder.png";
  const jerseyChip =
    player.jersey_number != null && Number.isFinite(Number(player.jersey_number))
      ? `#${player.jersey_number}`
      : "—";

  // Placeholder stats — do not invent real numbers; show zeros until backend aggregates exist.
  const stats = { games: 0, goals: 0, minutes: 0, goalsPer90: 0 };

  // TODO: Replace with real training aggregates for this player + team_season.
  const trainingParticipationPct = 0;
  const trainingsAttended = 0;
  const trainingsTotal = 0;
  const hasTrainingBars = false;

  // TODO: Replace with last 5 match rows for this player (opponent, date, result, goals, minutes).
  const lastMatches: Array<{
    opponent: string;
    dateLabel: string;
    result: string | null;
    goals: number | null;
    minutes: number | null;
  }> = [];

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
            <Chip>Position: {positionAbbrev}</Chip>
            <Chip>Rückennummer: {jerseyChip}</Chip>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Spiele" value={String(stats.games)} />
            <StatCard label="Tore" value={String(stats.goals)} />
            <StatCard label="Spielmin." value={String(stats.minutes)} />
            <StatCard label="Tore / 90" value={stats.goalsPer90.toFixed(2)} />
          </div>
          <p className="mt-2 text-center text-[11px] text-white/40">Noch keine Daten</p>

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
              <div className="mt-3 flex gap-1">{/* TODO: last N training attendance pills */}</div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-white/15 bg-white/[0.03] py-4 text-center text-xs text-white/45">
                Noch keine Trainingsdaten
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-red-300/90">Letzte 5 Spiele</h4>
            {lastMatches.length === 0 ? (
              <p className="mt-4 text-center text-sm text-white/50">Noch keine Spieldaten</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lastMatches.map((m, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm"
                  >
                    <div className="font-semibold text-white">{m.opponent}</div>
                    <div className="mt-0.5 text-xs text-white/55">{m.dateLabel}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
