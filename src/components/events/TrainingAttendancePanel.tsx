import React, { useMemo } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  countTrainingAttendanceByStatus,
  trainingAttendanceBucketRank,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../../lib/trainingAttendance';
import { PremiumPlayerCard } from '../player/PremiumPlayerCard';
import { PremiumStatusBadge, type PremiumStatusBadgeTone } from '../player/PremiumStatusBadge';

type Props = {
  players: PlayerItem[];
  getStatus: (playerId: string) => TrainingAttendanceStatus;
  onSetStatus: (playerId: string, status: TrainingAttendanceStatus) => void;
  loading?: boolean;
  className?: string;
};

function comparePlayers(a: PlayerItem, b: PlayerItem): number {
  const an = a.jersey_number != null ? Number(a.jersey_number) : null;
  const bn = b.jersey_number != null ? Number(b.jersey_number) : null;
  if (an != null && bn != null && an !== bn) return an - bn;
  if (an != null && bn == null) return -1;
  if (an == null && bn != null) return 1;
  const aLast = (a.last_name ?? '').trim().toLocaleLowerCase('de-AT');
  const bLast = (b.last_name ?? '').trim().toLocaleLowerCase('de-AT');
  const byLast = aLast.localeCompare(bLast, 'de-AT');
  if (byLast !== 0) return byLast;
  const aFirst = (a.first_name ?? '').trim().toLocaleLowerCase('de-AT');
  const bFirst = (b.first_name ?? '').trim().toLocaleLowerCase('de-AT');
  return aFirst.localeCompare(bFirst, 'de-AT');
}

function statusTone(status: TrainingAttendanceStatus): PremiumStatusBadgeTone {
  if (status === 'present') return 'present';
  if (status === 'absent') return 'absent';
  if (status === 'injured') return 'injured';
  if (status === 'external') return 'external';
  if (status === 'legacy_unknown') return 'neutral';
  return 'open';
}

const STAT_CHIPS: {
  key: keyof ReturnType<typeof countTrainingAttendanceByStatus>;
  label: string;
  className: string;
}[] = [
  { key: 'present', label: 'Dabei', className: 'border-emerald-500/25 bg-emerald-950/40 text-emerald-200/90' },
  { key: 'absent', label: 'Abwesend', className: 'border-red-500/22 bg-red-950/35 text-red-200/85' },
  { key: 'injured', label: 'Verletzt', className: 'border-amber-500/25 bg-amber-950/35 text-amber-100/90' },
  { key: 'external', label: 'LAZ', className: 'border-violet-500/25 bg-violet-950/40 text-violet-100/90' },
  { key: 'open', label: 'Offen', className: 'border-white/12 bg-white/[0.04] text-white/55' },
  {
    key: 'legacyUnknown',
    label: 'N. erf.',
    className: 'border-white/10 bg-black/40 text-white/45',
  },
];

const ACTION_BTN =
  'h-8 min-w-0 rounded-full border px-1.5 text-[10px] font-semibold transition-colors disabled:cursor-default disabled:opacity-55 sm:text-[11px]';

export const TrainingAttendancePanel: React.FC<Props> = ({
  players,
  getStatus,
  onSetStatus,
  loading = false,
  className = '',
}) => {
  const counts = useMemo(() => {
    const statuses = players.map((p) => getStatus(p.id));
    return countTrainingAttendanceByStatus(statuses);
  }, [players, getStatus]);

  const sorted = useMemo(
    () =>
      [...players].sort((a, b) => {
        const ra = trainingAttendanceBucketRank(getStatus(a.id));
        const rb = trainingAttendanceBucketRank(getStatus(b.id));
        if (ra !== rb) return ra - rb;
        return comparePlayers(a, b);
      }),
    [players, getStatus],
  );

  const visibleChips = STAT_CHIPS.filter(
    (c) => c.key !== 'legacyUnknown' || counts.legacyUnknown > 0,
  );

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {visibleChips.map(({ key, label, className: chipCls }) => (
          <div
            key={key}
            className={`rounded-[18px] border px-2 py-1.5 text-center ${chipCls}`}
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-85">{label}</div>
            <div className="mt-0.5 text-[18px] font-bold tabular-nums leading-none">{counts[key]}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-white/55">Lade Teilnahme…</p>
      ) : players.length === 0 ? (
        <p className="text-[13px] text-white/55">Keine Spieler im Kader.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 pb-1">
          {sorted.map((player) => {
            const status = getStatus(player.id);
            const num = player.jersey_number != null ? `#${player.jersey_number}` : null;
            const pos = (player.position ?? '').trim();
            const sub = [pos || null, num].filter(Boolean).join(' · ') || '—';

            return (
              <li key={player.id}>
                <PremiumPlayerCard
                  player={player}
                  subline={sub}
                  density="compact"
                  trailing={
                    <PremiumStatusBadge
                      label={trainingAttendanceLabel(status)}
                      tone={statusTone(status)}
                    />
                  }
                  footer={
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                      <button
                        type="button"
                        disabled={status === 'absent'}
                        onClick={() => onSetStatus(player.id, 'absent')}
                        className={`${ACTION_BTN} border-red-500/30 bg-red-950/50 text-red-200/90 hover:bg-red-950/70`}
                      >
                        Abwesend
                      </button>
                      <button
                        type="button"
                        disabled={status === 'injured'}
                        onClick={() => onSetStatus(player.id, 'injured')}
                        className={`${ACTION_BTN} border-amber-500/30 bg-amber-950/45 text-amber-100/90 hover:bg-amber-950/65`}
                      >
                        Verletzt
                      </button>
                      <button
                        type="button"
                        disabled={status === 'external'}
                        onClick={() => onSetStatus(player.id, 'external')}
                        className={`${ACTION_BTN} border-violet-500/30 bg-violet-950/45 text-violet-100/90 hover:bg-violet-950/65`}
                      >
                        LAZ
                      </button>
                      <button
                        type="button"
                        disabled={status === 'present'}
                        onClick={() => onSetStatus(player.id, 'present')}
                        className={`${ACTION_BTN} border-emerald-500/30 bg-emerald-950/45 text-emerald-100/90 hover:bg-emerald-950/65`}
                      >
                        Dabei
                      </button>
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
