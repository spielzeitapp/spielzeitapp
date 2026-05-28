import React, { useMemo } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  countTrainingAttendanceByStatus,
  trainingAttendanceBucketRank,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../../lib/trainingAttendance';
import { getTrainingPositionDisplay } from '../../lib/positionLabels';
import { DS_LIST_GAP, DS_TEXT_MUTED, type DsChipTone } from '../../lib/premiumDesignSystem';
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

const STAT_BOX_BASE =
  'flex min-h-[5.5rem] flex-col items-center justify-center rounded-[20px] border px-3.5 py-3.5 text-center';

const STAT_BOX_TONE: Record<DsChipTone, string> = {
  present:
    'border-[rgba(40,255,120,0.14)] bg-[radial-gradient(ellipse_92%_82%_at_50%_0%,rgba(40,255,120,0.13)_0%,rgba(9,12,10,0.97)_54%,rgba(8,10,9,0.98)_100%)] text-[#9DFFC5] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_26px_rgba(40,255,120,0.11),0_8px_24px_rgba(0,0,0,0.38)]',
  absent:
    'border-[rgba(255,45,85,0.12)] bg-[radial-gradient(ellipse_96%_78%_at_50%_100%,rgba(110,16,28,0.2)_0%,rgba(11,8,10,0.97)_52%,rgba(10,8,9,0.98)_100%)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_rgba(255,45,85,0.14),0_8px_24px_rgba(0,0,0,0.4)]',
  injured:
    'border-[rgba(255,160,60,0.13)] bg-[radial-gradient(ellipse_90%_72%_at_50%_0%,rgba(255,138,0,0.15)_0%,rgba(14,11,9,0.96)_48%,rgba(12,10,9,0.97)_100%)] text-[#FFC078] shadow-[inset_0_1px_0_rgba(255,200,120,0.06),0_0_22px_rgba(255,138,0,0.12),0_8px_24px_rgba(0,0,0,0.38)]',
  external:
    'border-[rgba(40,200,120,0.11)] bg-[radial-gradient(ellipse_88%_72%_at_50%_50%,rgba(18,82,52,0.2)_0%,rgba(8,11,10,0.97)_54%,rgba(9,10,10,0.98)_100%)] text-[#72E09A] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(40,140,90,0.14),0_8px_24px_rgba(0,0,0,0.38)]',
  open:
    'border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,12,0.97)] text-[#AEAEB2] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.38)]',
  neutral:
    'border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,12,0.97)] text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.38)]',
  selected:
    'border-[rgba(255,45,85,0.12)] bg-[radial-gradient(ellipse_96%_78%_at_50%_100%,rgba(110,16,28,0.18)_0%,rgba(11,8,10,0.97)_52%,rgba(10,8,9,0.98)_100%)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_22px_rgba(255,45,85,0.12)]',
};

const STAT_LABEL_CLASS =
  'text-[8px] font-medium uppercase tracking-[0.1em] text-[#8E8E93] leading-[1.45]';

const STAT_VALUE_CLASS = 'mt-2.5 text-[28px] font-bold tabular-nums leading-none tracking-tight text-inherit';

function trainingStatBoxClass(tone: DsChipTone): string {
  return [STAT_BOX_BASE, STAT_BOX_TONE[tone]].join(' ');
}

function trainingActionButtonClass(
  tone: 'absent' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const base =
    'flex h-[34px] min-h-[34px] w-full min-w-0 items-center justify-center rounded-[12px] border border-transparent px-1.5 text-[10px] font-semibold leading-tight transition-[background,box-shadow] duration-150 disabled:cursor-default disabled:opacity-45 sm:text-[11px]';
  const glassIdle =
    'border border-white/[0.07] bg-[rgba(14,14,18,0.92)] text-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_14px_rgba(255,45,85,0.05)] hover:border-white/10 hover:bg-[rgba(18,14,16,0.94)] hover:text-white/76';
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    present: {
      idle: glassIdle,
      on: 'border border-[rgba(40,255,120,0.18)] bg-[rgba(18,110,68,0.4)] text-[#9DFFC5] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_28px_rgba(40,255,120,0.24)]',
    },
    external: {
      idle: glassIdle,
      on: 'border border-[rgba(40,160,100,0.14)] bg-[rgba(10,48,34,0.48)] text-[#72E09A] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_22px_rgba(40,140,90,0.16)] backdrop-blur-sm',
    },
    absent: {
      idle: glassIdle,
      on: 'border border-[rgba(255,45,85,0.16)] bg-[rgba(82,12,22,0.44)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_26px_rgba(255,45,85,0.22)]',
    },
    injured: {
      idle: glassIdle,
      on: 'border border-[rgba(255,160,60,0.14)] bg-[rgba(88,46,10,0.42)] text-[#FFC878] shadow-[inset_0_1px_0_rgba(255,220,140,0.07),0_0_24px_rgba(255,160,60,0.2)]',
    },
  };
  return [base, active ? tones[tone].on : tones[tone].idle].join(' ');
}

const TRAINING_NAME_CLASS =
  'line-clamp-2 min-w-0 whitespace-normal break-words text-[13px] font-semibold leading-[1.36] text-white sm:text-[14px]';

const TRAINING_SUBLINE_CLASS = `mt-1 line-clamp-1 text-[12px] font-normal leading-snug ${DS_TEXT_MUTED}`;

const TRAINING_BADGE_CLASS =
  '!inline-flex !h-[20px] !max-w-[4.25rem] shrink-0 !px-1.5 !text-[8px] !font-bold !uppercase !tracking-[0.07em] !leading-none';

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
    <div className={`flex w-full min-w-0 flex-col gap-5 ${className}`}>
      <div className="grid w-full grid-cols-2 gap-2.5">
        {STAT_GRID_MAIN.map(({ key, label, tone }) => (
          <div key={key} className={trainingStatBoxClass(tone)}>
            <span className={STAT_LABEL_CLASS}>{label}</span>
            <span className={STAT_VALUE_CLASS}>{counts[key]}</span>
          </div>
        ))}
        {showLegacy ? (
          <div className={`col-span-2 ${trainingStatBoxClass('neutral')}`}>
            <span className={STAT_LABEL_CLASS}>N. erf.</span>
            <span className={STAT_VALUE_CLASS}>{counts.legacyUnknown}</span>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className={`text-sm ${DS_TEXT_MUTED}`}>Lade Teilnahme…</p>
      ) : players.length === 0 ? (
        <p className={`text-sm ${DS_TEXT_MUTED}`}>Keine Spieler im Kader.</p>
      ) : (
        <ul className={`-mx-2.5 flex w-[calc(100%+1.25rem)] flex-col sm:-mx-3 sm:w-[calc(100%+1.5rem)] ${DS_LIST_GAP} pb-1`}>
          {sorted.map((player) => {
            const status = getStatus(player.id);
            const sub = getTrainingPositionDisplay(player.position);

            return (
              <li key={player.id} className="w-full min-w-0">
                <PremiumPlayerCard
                  player={player}
                  tone="training"
                  subline={sub}
                  density="compact"
                  nameClassName={TRAINING_NAME_CLASS}
                  sublineClassName={TRAINING_SUBLINE_CLASS}
                  trailing={
                    <PremiumStatusBadge
                      label={trainingAttendanceLabel(status)}
                      tone={statusTone(status)}
                      className={TRAINING_BADGE_CLASS}
                    />
                  }
                  footer={
                    <div className="grid grid-cols-4 gap-1.5">
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
