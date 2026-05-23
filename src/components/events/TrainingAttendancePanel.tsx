import React, { useMemo } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  countTrainingAttendanceByStatus,
  trainingAttendanceBucketRank,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../../lib/trainingAttendance';
import { formatTrainingPlayerSubline } from '../../lib/positionLabels';
import { DS_LIST_GAP, type DsChipTone } from '../../lib/premiumDesignSystem';
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

const STAT_GRID_MAIN: {
  key: keyof ReturnType<typeof countTrainingAttendanceByStatus>;
  label: string;
  tone: DsChipTone;
}[] = [
  { key: 'present', label: 'Dabei', tone: 'present' },
  { key: 'absent', label: 'Abwesend', tone: 'absent' },
  { key: 'injured', label: 'Verletzt', tone: 'injured' },
  { key: 'external', label: 'LAZ', tone: 'external' },
];

const STAT_BOX_SURFACE =
  'flex min-h-[4.5rem] flex-col items-center justify-center rounded-[20px] border border-transparent px-2.5 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_24px_rgba(255,40,40,0.06)]';

const STAT_BOX_TONE: Record<DsChipTone, string> = {
  present: 'bg-[rgba(20,110,70,0.28)] text-[#9DFFC5]',
  absent: 'bg-[rgba(100,14,24,0.32)] text-[#FF8D98]',
  injured: 'bg-[rgba(110,52,8,0.30)] text-[#FFB15A]',
  external: 'bg-[rgba(14,58,40,0.26)] text-[#63D98D]',
  open: 'bg-[rgba(16,16,20,0.92)] text-[#AEAEB2]',
  neutral: 'bg-[rgba(16,16,20,0.88)] text-white/45',
  selected: 'bg-[rgba(100,14,24,0.32)] text-[#FF8D98]',
};

function trainingStatBoxClass(tone: DsChipTone): string {
  return [STAT_BOX_SURFACE, STAT_BOX_TONE[tone]].join(' ');
}

function trainingActionButtonClass(
  tone: 'absent' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const base =
    'flex h-8 min-h-8 w-full items-center justify-center rounded-[12px] border border-transparent px-1 text-[10px] font-semibold leading-tight transition-[background,box-shadow] duration-150 disabled:cursor-default disabled:opacity-50 sm:text-[11px]';
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    present: {
      idle: 'bg-[rgba(20,110,70,0.24)] text-[#8DFFB7] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
      on: 'bg-[rgba(22,120,76,0.36)] text-[#9DFFC5] shadow-[0_0_18px_rgba(40,255,120,0.14)]',
    },
    external: {
      idle: 'bg-[rgba(14,58,40,0.22)] text-[#63D98D] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
      on: 'bg-[rgba(14,58,40,0.28)] text-[#63D98D]',
    },
    absent: {
      idle: 'bg-[rgba(100,14,24,0.24)] text-[#FF8D98] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
      on: 'bg-[rgba(100,14,24,0.34)] text-[#FF8D98] shadow-[0_0_14px_rgba(255,40,40,0.08)]',
    },
    injured: {
      idle: 'bg-[rgba(110,52,8,0.24)] text-[#FFB15A] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
      on: 'bg-[rgba(110,52,8,0.32)] text-[#FFB15A]',
    },
  };
  return [base, active ? tones[tone].on : tones[tone].idle].join(' ');
}

const TRAINING_BADGE_CLASS =
  '!inline-flex !h-[20px] !max-w-[4.75rem] shrink-0 !px-2 !text-[8px] !font-bold !uppercase !tracking-[0.08em] !leading-none';

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

  const showLegacy = counts.legacyUnknown > 0;

  return (
    <div className={`flex w-full min-w-0 flex-col gap-4 ${className}`}>
      <div className="grid w-full grid-cols-2 gap-2">
        {STAT_GRID_MAIN.map(({ key, label, tone }) => (
          <div key={key} className={trainingStatBoxClass(tone)}>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] leading-[1.35] opacity-90">
              {label}
            </span>
            <span className="mt-1.5 text-[22px] font-bold tabular-nums leading-none">{counts[key]}</span>
          </div>
        ))}
        <div className={`col-span-2 ${trainingStatBoxClass('open')}`}>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] leading-[1.35] opacity-90">
            Offen
          </span>
          <span className="mt-1.5 text-[22px] font-bold tabular-nums leading-none">{counts.open}</span>
        </div>
        {showLegacy ? (
          <div className={`col-span-2 ${trainingStatBoxClass('neutral')}`}>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] leading-[1.35] opacity-90">
              N. erf.
            </span>
            <span className="mt-1.5 text-[22px] font-bold tabular-nums leading-none">
              {counts.legacyUnknown}
            </span>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[13px] text-white/50">Lade Teilnahme…</p>
      ) : players.length === 0 ? (
        <p className="text-[13px] text-white/50">Keine Spieler im Kader.</p>
      ) : (
        <ul className={`-mx-2 flex w-[calc(100%+1rem)] flex-col sm:-mx-2.5 sm:w-[calc(100%+1.25rem)] ${DS_LIST_GAP} pb-1`}>
          {sorted.map((player) => {
            const status = getStatus(player.id);
            const sub = formatTrainingPlayerSubline(player.position, player.jersey_number);

            return (
              <li key={player.id} className="w-full min-w-0">
                <PremiumPlayerCard
                  player={player}
                  subline={sub}
                  density="compact"
                  className="w-full"
                  trailing={
                    <div className="max-w-[3.75rem] shrink-0 pl-1">
                      <PremiumStatusBadge
                        label={trainingAttendanceLabel(status)}
                        tone={statusTone(status)}
                        className={TRAINING_BADGE_CLASS}
                      />
                    </div>
                  }
                  footer={
                    <div className="mt-0.5 grid grid-cols-4 gap-1.5 pt-1.5">
                      <button
                        type="button"
                        disabled={status === 'absent'}
                        onClick={() => onSetStatus(player.id, 'absent')}
                        className={trainingActionButtonClass('absent', status === 'absent')}
                      >
                        Abwesend
                      </button>
                      <button
                        type="button"
                        disabled={status === 'injured'}
                        onClick={() => onSetStatus(player.id, 'injured')}
                        className={trainingActionButtonClass('injured', status === 'injured')}
                      >
                        Verletzt
                      </button>
                      <button
                        type="button"
                        disabled={status === 'external'}
                        onClick={() => onSetStatus(player.id, 'external')}
                        className={trainingActionButtonClass('external', status === 'external')}
                      >
                        LAZ
                      </button>
                      <button
                        type="button"
                        disabled={status === 'present'}
                        onClick={() => onSetStatus(player.id, 'present')}
                        className={trainingActionButtonClass('present', status === 'present')}
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
