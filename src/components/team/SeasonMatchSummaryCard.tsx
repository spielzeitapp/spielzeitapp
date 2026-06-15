import React from 'react';
import { Handshake, Star, XCircle } from 'lucide-react';
import type { SeasonMatchSummary } from '../../lib/seasonMatchStats';
import { ProfileStatTile } from './ProfileStatTile';
import {
  COACH_STAT_TILES,
  STAT_ICON_WATERMARK_CLASS,
} from './profile/profileStatIcons';

type Props = {
  summary: SeasonMatchSummary;
  loading?: boolean;
};

function StatIconHandshake({ className = STAT_ICON_WATERMARK_CLASS }: { className?: string }) {
  return <Handshake className={className} strokeWidth={1.6} aria-hidden />;
}

function StatIconStar({ className = STAT_ICON_WATERMARK_CLASS }: { className?: string }) {
  return <Star className={className} strokeWidth={1.6} aria-hidden />;
}

function StatIconXCircle({ className = STAT_ICON_WATERMARK_CLASS }: { className?: string }) {
  return <XCircle className={className} strokeWidth={1.6} aria-hidden />;
}

export const SeasonMatchSummaryCard: React.FC<Props> = ({ summary, loading = false }) => {
  const total = summary.wins + summary.draws + summary.losses;
  const wPct = total > 0 ? (summary.wins / total) * 100 : 0;
  const dPct = total > 0 ? (summary.draws / total) * 100 : 0;
  const lPct = total > 0 ? (summary.losses / total) * 100 : 0;

  const goalsLabel =
    summary.goalsFor > 0 || summary.goalsAgainst > 0
      ? `${summary.goalsFor}:${summary.goalsAgainst}`
      : '—';

  const tiles = [
    { Icon: COACH_STAT_TILES.games, label: 'Spiele', value: String(summary.played) },
    { Icon: COACH_STAT_TILES.wins, label: 'Siege', value: String(summary.wins) },
    { Icon: StatIconHandshake, label: 'Remis', value: String(summary.draws) },
    { Icon: StatIconXCircle, label: 'Niederlagen', value: String(summary.losses) },
    { Icon: COACH_STAT_TILES.goalsFor, label: 'Tore', value: goalsLabel },
    { Icon: COACH_STAT_TILES.goalsAgainst, label: 'Gegentore', value: String(summary.goalsAgainst) },
    { Icon: StatIconStar, label: 'Punkte', value: String(summary.points) },
    { Icon: COACH_STAT_TILES.pointsPerGame, label: 'Punkte/Spiel', value: summary.pointsPerGame },
  ] as const;

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-3.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={`sum-skel-${i}`}
              className="h-[4.75rem] animate-pulse rounded-2xl border border-white/5 bg-white/[0.07]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(220,38,38,0.1),0_10px_36px_rgba(0,0,0,0.4)]">
      <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
        Saisonbilanz
      </h3>

      {total === 0 ? (
        <p className="py-2 text-center text-[13px] text-white/60">Noch keine Spiele</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tiles.map((tile) => (
              <ProfileStatTile
                key={tile.label}
                icon={<tile.Icon />}
                label={tile.label}
                value={tile.value}
              />
            ))}
          </div>

          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            {wPct > 0 ? <div className="bg-emerald-500/90" style={{ width: `${wPct}%` }} /> : null}
            {dPct > 0 ? <div className="bg-amber-400/90" style={{ width: `${dPct}%` }} /> : null}
            {lPct > 0 ? <div className="bg-red-500/90" style={{ width: `${lPct}%` }} /> : null}
          </div>
          <p className="mt-2 text-center text-[11px] font-medium text-white/50">
            <span className="text-emerald-400">Siege</span>
            <span className="mx-1.5 text-white/30">|</span>
            <span className="text-amber-300">Remis</span>
            <span className="mx-1.5 text-white/30">|</span>
            <span className="text-red-400">Niederlagen</span>
          </p>
        </>
      )}
    </div>
  );
};
