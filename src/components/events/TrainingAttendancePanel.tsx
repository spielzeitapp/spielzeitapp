import { MatchPlayerRow } from '../match/MatchPlayerRow';
import { AttendanceThumbControls } from './AttendanceThumbControls';
import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  computeSessionParticipationPct,
  countTrainingAttendanceByStatus,
  trainingAttendanceBucketRank,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../../lib/trainingAttendance';
import {
  ATTENDANCE_ACTION_GLASS_IDLE,
  ATTENDANCE_ACTION_LAZ_ON,
  ATTENDANCE_STAT_BOX_LAZ,
} from '../../lib/attendanceColors';
import { DS_TEXT_MUTED, type DsChipTone } from '../../lib/premiumDesignSystem';
import { useDemoMode } from '../../demo/DemoContext';
import { PlayerSpecialStatusBadges } from '../player/PlayerSpecialStatusBadges';
import { PremiumStatusBadge, type PremiumStatusBadgeTone } from '../player/PremiumStatusBadge';
import { playerCardFamilyName, playerCardName, playerMedia } from '../team/TeamSquadShowcase';

type Props = {
  players: PlayerItem[];
  getStatus: (playerId: string) => TrainingAttendanceStatus;
  onSetStatus: (playerId: string, status: TrainingAttendanceStatus, note?: string) => void;
  getNote?: (playerId: string) => string | undefined;
  loading?: boolean;
  className?: string;
  /** Archiv / Soft-Lock: Status anzeigen, keine Buttons. */
  readOnly?: boolean;
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
  if (status === 'sick') return 'sick';
  if (status === 'injured') return 'injured';
  if (status === 'external') return 'external';
  if (status === 'other_team') return 'neutral';
  return 'present';
}

const STAT_GRID_MAIN: {
  key: keyof ReturnType<typeof countTrainingAttendanceByStatus> | 'participation';
  label: string;
  tone: DsChipTone | 'participation';
}[] = [
  { key: 'present', label: 'Dabei', tone: 'present' },
  { key: 'absent', label: 'Abwesend', tone: 'absent' },
  { key: 'sick', label: 'Krank', tone: 'sick' },
  { key: 'injured', label: 'Verletzt', tone: 'injured' },
  { key: 'external', label: 'LAZ', tone: 'external' },
  { key: 'otherTeam', label: 'Andere Mannschaft', tone: 'neutral' },
  { key: 'participation', label: 'Beteiligung', tone: 'participation' },
];

const STAT_BOX_BASE =
  'flex min-h-[4.75rem] flex-col items-center justify-center rounded-[16px] border px-2 py-2.5 text-center';

const STAT_BOX_TONE: Record<DsChipTone, string> = {
  present:
    'border-[rgba(40,255,120,0.14)] bg-[radial-gradient(ellipse_92%_82%_at_50%_0%,rgba(40,255,120,0.13)_0%,rgba(9,12,10,0.97)_54%,rgba(8,10,9,0.98)_100%)] text-[#9DFFC5] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_26px_rgba(40,255,120,0.11),0_8px_24px_rgba(0,0,0,0.38)]',
  absent:
    'border-[rgba(255,45,85,0.12)] bg-[radial-gradient(ellipse_96%_78%_at_50%_100%,rgba(110,16,28,0.2)_0%,rgba(11,8,10,0.97)_52%,rgba(10,8,9,0.98)_100%)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_rgba(255,45,85,0.14),0_8px_24px_rgba(0,0,0,0.4)]',
  sick:
    'border-[rgba(80,160,255,0.14)] bg-[radial-gradient(ellipse_90%_72%_at_50%_0%,rgba(60,130,220,0.16)_0%,rgba(10,12,18,0.97)_48%,rgba(8,10,14,0.98)_100%)] text-[#8EC5FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_22px_rgba(80,160,255,0.1),0_8px_24px_rgba(0,0,0,0.38)]',
  injured:
    'border-[rgba(255,160,60,0.13)] bg-[radial-gradient(ellipse_90%_72%_at_50%_0%,rgba(255,138,0,0.15)_0%,rgba(14,11,9,0.96)_48%,rgba(12,10,9,0.97)_100%)] text-[#FFC078] shadow-[inset_0_1px_0_rgba(255,200,120,0.06),0_0_22px_rgba(255,138,0,0.12),0_8px_24px_rgba(0,0,0,0.38)]',
  external: ATTENDANCE_STAT_BOX_LAZ,
  open:
    'border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,12,0.97)] text-[#AEAEB2] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.38)]',
  neutral:
    'border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,12,0.97)] text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.38)]',
  selected:
    'border-[rgba(255,45,85,0.12)] bg-[radial-gradient(ellipse_96%_78%_at_50%_100%,rgba(110,16,28,0.18)_0%,rgba(11,8,10,0.97)_52%,rgba(10,8,9,0.98)_100%)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_22px_rgba(255,45,85,0.12)]',
};

const PARTICIPATION_BOX =
  'border-[rgba(255,255,255,0.1)] bg-[radial-gradient(ellipse_90%_80%_at_50%_0%,rgba(220,38,38,0.08)_0%,rgba(11,10,12,0.98)_55%,rgba(7,7,9,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(220,38,38,0.06),0_8px_24px_rgba(0,0,0,0.38)]';

const STAT_LABEL_CLASS =
  'text-[9px] font-medium uppercase tracking-[0.08em] text-[#8E8E93] leading-[1.45]';

const STAT_VALUE_CLASS = 'mt-1.5 text-[25px] font-bold tabular-nums leading-none tracking-tight text-inherit';

function trainingStatBoxClass(tone: DsChipTone | 'participation'): string {
  if (tone === 'participation') return [STAT_BOX_BASE, PARTICIPATION_BOX].join(' ');
  return [STAT_BOX_BASE, STAT_BOX_TONE[tone]].join(' ');
}

const TRAINING_BADGE_CLASS =
  '!inline-flex !h-[22px] !max-w-[5.5rem] shrink-0 !px-2 !text-[9px] !font-bold !uppercase !tracking-[0.04em] !leading-none';

export const TrainingAttendancePanel: React.FC<Props> = ({
  players,
  getStatus,
  getNote,
  onSetStatus,
  loading = false,
  className = '',
  readOnly = false,
}) => {
  const chooseStatus = (playerId: string, status: TrainingAttendanceStatus, note?: string) => {
    onSetStatus(playerId, status, note);
  };
  const counts = useMemo(() => {
    const statuses = players.map((p) => getStatus(p.id));
    return countTrainingAttendanceByStatus(statuses);
  }, [players, getStatus]);

  const participationPct = useMemo(() => computeSessionParticipationPct(counts), [counts]);

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

  return (
    <div className={`flex w-full min-w-0 flex-col gap-4 ${className}`}>
      <div className="grid w-full grid-cols-3 gap-2">
        {STAT_GRID_MAIN.map(({ key, label, tone }) => (
          <div key={key} className={trainingStatBoxClass(tone)}>
            <span className={STAT_LABEL_CLASS}>{label}</span>
            <span className={STAT_VALUE_CLASS}>
              {key === 'participation'
                ? participationPct != null
                  ? `${participationPct} %`
                  : '—'
                : counts[key]}
            </span>
          </div>
        ))}
      </div>

      {loading ? (
        <p className={`text-sm ${DS_TEXT_MUTED}`}>Lade Teilnahme…</p>
      ) : players.length === 0 ? (
        <p className={`text-sm ${DS_TEXT_MUTED}`}>Keine Spieler im Kader.</p>
      ) : (
        <ul className="flex w-full flex-col gap-2 pb-1">
          {sorted.map((player) => {
            const status = getStatus(player.id);
            const playerName = `${playerCardName(player)} ${playerCardFamilyName(player)}`.trim();

            return (
              <li key={player.id} className="w-full min-w-0">
                <MatchPlayerRow player={player} layout="team-roster" hideSubline
                  nameStatus={<><PremiumStatusBadge label={status === 'other_team' ? 'Anderes Team' : trainingAttendanceLabel(status)} tone={status === 'open' || status === 'legacy_unknown' ? 'open' : statusTone(status)} className={TRAINING_BADGE_CLASS} />{status === 'other_team' && getNote?.(player.id) ? <span className="block max-w-full truncate text-[11px] text-violet-200" title={getNote(player.id)}>{getNote(player.id)}</span> : null}
                    {(player.status ?? 'active') === 'paused' ? <span className="ml-1 text-[10px] text-amber-200">Pausiert</span> : null}</>}
                  trailing={readOnly ? undefined : <AttendanceThumbControls allowOtherTeam name={playerName} status={status} isLaz={player.is_laz_player} onSelect={(next, note) => chooseStatus(player.id, next, note)} />}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
