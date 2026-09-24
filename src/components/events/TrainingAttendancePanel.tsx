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
  onSetStatus: (playerId: string, status: TrainingAttendanceStatus) => void;
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

function trainingActionButtonClass(
  tone: 'absent' | 'sick' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const base =
    'flex min-h-[42px] w-full min-w-0 items-center justify-center rounded-[12px] border border-transparent px-1.5 text-[12px] font-semibold leading-tight transition-[background,box-shadow] duration-150 disabled:cursor-default disabled:opacity-45';
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    present: {
      idle: ATTENDANCE_ACTION_GLASS_IDLE,
      on: 'border border-[rgba(40,255,120,0.18)] bg-[rgba(18,110,68,0.4)] text-[#9DFFC5] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_0_28px_rgba(40,255,120,0.24)]',
    },
    external: {
      idle: ATTENDANCE_ACTION_GLASS_IDLE,
      on: ATTENDANCE_ACTION_LAZ_ON,
    },
    absent: {
      idle: ATTENDANCE_ACTION_GLASS_IDLE,
      on: 'border border-[rgba(255,45,85,0.16)] bg-[rgba(82,12,22,0.44)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_26px_rgba(255,45,85,0.22)]',
    },
    sick: {
      idle: ATTENDANCE_ACTION_GLASS_IDLE,
      on: 'border border-[rgba(80,160,255,0.16)] bg-[rgba(24,64,120,0.42)] text-[#A8D4FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_24px_rgba(80,160,255,0.18)]',
    },
    injured: {
      idle: ATTENDANCE_ACTION_GLASS_IDLE,
      on: 'border border-[rgba(255,160,60,0.14)] bg-[rgba(88,46,10,0.42)] text-[#FFC878] shadow-[inset_0_1px_0_rgba(255,220,140,0.07),0_0_24px_rgba(255,160,60,0.2)]',
    },
  };
  return [base, active ? tones[tone].on : tones[tone].idle].join(' ');
}

const TRAINING_BADGE_CLASS =
  '!inline-flex !h-[22px] !max-w-[5.5rem] shrink-0 !px-2 !text-[9px] !font-bold !uppercase !tracking-[0.04em] !leading-none';

export const TrainingAttendancePanel: React.FC<Props> = ({
  players,
  getStatus,
  onSetStatus,
  loading = false,
  className = '',
  readOnly = false,
}) => {
  const demo = useDemoMode();
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const chooseStatus = (playerId: string, status: TrainingAttendanceStatus) => {
    onSetStatus(playerId, status);
    setExpandedPlayerId(null);
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
            const media = playerMedia(player, Boolean(demo));
            const isUnavailable = status !== 'present';
            const expanded = expandedPlayerId === player.id && !readOnly;
            const playerName = `${playerCardName(player)} ${playerCardFamilyName(player)}`.trim();

            return (
              <li key={player.id} className="w-full min-w-0">
                <div className={`sz-club-list-card sz-club-surface sz-club-surface--quiet w-full overflow-hidden rounded-[15px] border ${expanded ? 'border-red-500/40' : ''}`}>
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-expanded={readOnly ? undefined : expanded}
                    aria-label={`${playerName}: ${trainingAttendanceLabel(status)}${readOnly ? '' : ', Status ändern'}`}
                    onClick={() => setExpandedPlayerId(expanded ? null : player.id)}
                    className="flex min-h-[66px] w-full items-center px-2.5 text-left disabled:cursor-default"
                  >
                    <div className="relative mr-2 h-[56px] w-[48px] shrink-0 self-end overflow-hidden">
                      <img
                        src={media.src}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = media.fallbackSrc;
                        }}
                        className={`h-full w-full origin-top scale-[1.55] object-contain object-top ${media.isUpperBodyDemo ? 'sz-club-placeholder-player' : ''} ${
                          media.isCutout
                            ? ''
                            : media.isUpperBodyDemo
                              ? 'object-contain'
                              : 'object-cover'
                        }`}
                      />
                    </div>
                    <span className="sz-club-number-divider w-10 shrink-0 border-l pl-2 text-[23px] font-black leading-none text-white">
                      {player.jersey_number ?? '–'}
                    </span>
                    <span className="min-w-0 flex-1 pl-2">
                      <span className="block truncate text-[12px] font-semibold leading-tight text-white/55">
                        {playerCardName(player)}
                      </span>
                      <span className="block truncate text-[16px] font-black leading-tight text-white sm:text-[18px]">
                        {playerCardFamilyName(player) || playerCardName(player)}
                      </span>
                    </span>
                    <div className="ml-1 flex shrink-0 flex-col items-end gap-1">
                      <PremiumStatusBadge
                        label={trainingAttendanceLabel(status)}
                        tone={statusTone(status)}
                        className={TRAINING_BADGE_CLASS}
                      />
                      <PlayerSpecialStatusBadges
                        isLaz={player.is_laz_player}
                        isInjured={player.is_injured}
                        size="xs"
                      />
                      {(player.status ?? 'active') === 'paused' ? (
                        <span className="text-[9px] font-bold uppercase text-amber-200">Pausiert</span>
                      ) : null}
                    </div>
                    {!readOnly ? <ChevronDown className={`ml-1 h-4 w-4 shrink-0 text-white/45 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden /> : null}
                  </button>
                  {expanded ? (
                    <div className="border-t border-white/[0.08] px-2.5 pb-2.5 pt-2">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">Status wählen</p>
                      <div className="grid grid-cols-2 gap-1.5">
                      {isUnavailable ? (
                        <button
                          type="button"
                          onClick={() => chooseStatus(player.id, 'present')}
                          className={`${trainingActionButtonClass('present', true)} col-span-2`}
                        >
                          Wieder dabei
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={status === 'absent'}
                        onClick={() => chooseStatus(player.id, 'absent')}
                        className={trainingActionButtonClass('absent', status === 'absent')}
                      >
                        Abwesend
                      </button>
                      <button
                        type="button"
                        disabled={status === 'sick'}
                        onClick={() => chooseStatus(player.id, 'sick')}
                        className={trainingActionButtonClass('sick', status === 'sick')}
                      >
                        Krank
                      </button>
                      <button
                        type="button"
                        disabled={status === 'injured'}
                        onClick={() => chooseStatus(player.id, 'injured')}
                        className={trainingActionButtonClass('injured', status === 'injured')}
                      >
                        Verletzt
                      </button>
                      <button
                        type="button"
                        disabled={status === 'external'}
                        onClick={() => chooseStatus(player.id, 'external')}
                        className={trainingActionButtonClass('external', status === 'external')}
                      >
                        LAZ
                      </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
