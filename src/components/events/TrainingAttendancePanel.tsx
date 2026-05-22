import React, { useMemo } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  countTrainingAttendanceByStatus,
  trainingAttendanceBucketRank,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../../lib/trainingAttendance';
import { AppButton } from '../ui/AppButton';

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

function badgeClass(status: TrainingAttendanceStatus): string {
  if (status === 'present') {
    return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
  }
  if (status === 'absent') {
    return 'border-red-400/40 bg-red-500/15 text-red-200';
  }
  if (status === 'injured') {
    return 'border-amber-400/45 bg-amber-500/15 text-amber-100';
  }
  if (status === 'external') {
    return 'border-violet-400/45 bg-violet-500/15 text-violet-100';
  }
  if (status === 'legacy_unknown') {
    return 'border-white/15 bg-white/6 text-white/50';
  }
  return 'border-white/18 bg-white/10 text-white/65';
}

const STAT_CHIPS: {
  key: keyof ReturnType<typeof countTrainingAttendanceByStatus>;
  label: string;
  className: string;
}[] = [
  { key: 'present', label: 'Dabei', className: 'border-emerald-500/40 bg-emerald-600/15 text-emerald-300' },
  { key: 'absent', label: 'Abwesend', className: 'border-red-500/40 bg-red-600/15 text-red-300' },
  { key: 'injured', label: 'Verletzt', className: 'border-amber-500/40 bg-amber-600/15 text-amber-200' },
  { key: 'external', label: 'LAZ', className: 'border-violet-500/40 bg-violet-600/15 text-violet-200' },
  { key: 'open', label: 'Offen', className: 'border-white/20 bg-white/8 text-white/70' },
  {
    key: 'legacyUnknown',
    label: 'N. erf.',
    className: 'border-white/15 bg-white/6 text-white/55',
  },
];

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
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleChips.map(({ key, label, className: chipCls }) => (
          <div
            key={key}
            className={`rounded-xl border px-2.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${chipCls}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-90">{label}</div>
            <div className="mt-0.5 text-[20px] font-bold tabular-nums leading-none">{counts[key]}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-white/65">Lade Teilnahme…</p>
      ) : players.length === 0 ? (
        <p className="text-[13px] text-white/65">Keine Spieler im Kader.</p>
      ) : (
        <ul className="flex flex-col gap-2 pb-1">
          {sorted.map((player) => {
            const status = getStatus(player.id);
            const num = player.jersey_number != null ? `#${player.jersey_number}` : null;
            const pos = (player.position ?? '').trim();
            const sub = [pos || null, num].filter(Boolean).join(' · ') || '—';

            return (
              <li key={player.id}>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-red-950/20 via-black/50 to-black/75 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2.5">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover bg-black/30"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-[11px] font-bold text-white/70">
                        {(player.first_name?.trim()?.[0] ?? '—').toUpperCase()}
                        {(player.last_name?.trim()?.[0] ?? '').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold leading-tight text-white/95">
                        {player.display_name}
                      </p>
                      <p className="truncate text-[11px] text-white/60">{sub}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${badgeClass(status)}`}
                    >
                      {trainingAttendanceLabel(status)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <AppButton
                      type="button"
                      size="sm"
                      variant={status === 'absent' ? 'secondary' : 'danger'}
                      disabled={status === 'absent'}
                      onClick={() => onSetStatus(player.id, 'absent')}
                      className="h-9 min-w-0 px-1 text-[10px] font-semibold sm:text-[11px]"
                    >
                      Abwesend
                    </AppButton>
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={status === 'injured'}
                      onClick={() => onSetStatus(player.id, 'injured')}
                      className={`h-9 min-w-0 px-1 text-[10px] font-semibold sm:text-[11px] ${
                        status === 'injured'
                          ? 'border-amber-500/50 text-amber-100'
                          : 'border-amber-500/35 text-amber-200/90 hover:bg-amber-950/30'
                      }`}
                    >
                      Verletzt
                    </AppButton>
                    <AppButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={status === 'external'}
                      onClick={() => onSetStatus(player.id, 'external')}
                      className={`h-9 min-w-0 px-1 text-[10px] font-semibold sm:text-[11px] ${
                        status === 'external'
                          ? 'border-violet-500/50 text-violet-100'
                          : 'border-violet-500/35 text-violet-200/90 hover:bg-violet-950/30'
                      }`}
                    >
                      LAZ
                    </AppButton>
                    <AppButton
                      type="button"
                      size="sm"
                      variant="success"
                      disabled={status === 'present'}
                      onClick={() => onSetStatus(player.id, 'present')}
                      className="h-9 min-w-0 px-1 text-[10px] font-semibold sm:text-[11px]"
                    >
                      Dabei
                    </AppButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
