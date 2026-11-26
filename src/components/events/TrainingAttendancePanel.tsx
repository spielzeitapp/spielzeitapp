import { MatchPlayerRow } from '../match/MatchPlayerRow';
import { AttendanceThumbControls } from './AttendanceThumbControls';
import React, { useMemo } from 'react';
import { AttendanceStatCard } from './AttendanceStatCard';
import { Users } from 'lucide-react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  computeSessionParticipationPct,
  computeSessionTrainingActivityPct,
  countTrainingAttendanceByStatus,
  trainingAttendanceBucketRank,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../../lib/trainingAttendance';
import { DS_TEXT_MUTED, type DsChipTone } from '../../lib/premiumDesignSystem';
import { PremiumStatusBadge, type PremiumStatusBadgeTone } from '../player/PremiumStatusBadge';
import { playerCardFamilyName, playerCardName } from '../team/TeamSquadShowcase';

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
  return 'open';
}

const STAT_GRID_MAIN: {
  key: keyof ReturnType<typeof countTrainingAttendanceByStatus>;
  label: string;
  tone: DsChipTone;
}[] = [
  { key: 'present', label: 'Dabei', tone: 'present' },
  { key: 'absent', label: 'Abwesend', tone: 'absent' },
  { key: 'sick', label: 'Krank', tone: 'sick' },
  { key: 'injured', label: 'Verletzt', tone: 'injured' },
  { key: 'external', label: 'LAZ', tone: 'external' },
  { key: 'otherTeam', label: 'Andere Mannschaft', tone: 'neutral' },
];

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
  const activityPct = useMemo(() => computeSessionTrainingActivityPct(counts), [counts]);

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
          <AttendanceStatCard key={key} label={label} value={counts[key] ?? 0} tone={tone} />
        ))}
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        <AttendanceStatCard label="Beim eigenen Team" value={participationPct == null ? '—' : `${participationPct} %`} tone="participation" hint="An diesem Training vor Ort" />
        <AttendanceStatCard label="Trainingsaktivität" value={activityPct == null ? '—' : `${activityPct} %`} tone="participation" hint="Inkl. LAZ und anderer Mannschaft" />
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

            const showBadge = readOnly || (status !== 'present' && status !== 'absent' && status !== 'open');
            const otherTeamNote = status === 'other_team' ? getNote?.(player.id) : undefined;
            const statusBadge = status === 'other_team' ? (
              <span title={otherTeamNote || 'Training bei anderer Mannschaft'} className="inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-1 text-[10px] font-bold leading-none text-violet-200">
                <Users className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate whitespace-nowrap">Training · {(otherTeamNote || 'Anderes Team').split(' · ')[0].replace(/U[- ](\d+)/i, 'U$1')}</span>
              </span>
            ) : showBadge ? (
              <PremiumStatusBadge label={trainingAttendanceLabel(status)} tone={statusTone(status)} className={TRAINING_BADGE_CLASS} />
            ) : null;
            const paused = player.status === 'paused';

            return (
              <li key={player.id} className="w-full min-w-0">
                <MatchPlayerRow player={player} layout="team-roster" hideNumber hideSubline
                  nameStatus={(statusBadge || paused) ? <>
                    {statusBadge}
                    {paused && <span className="ml-1 text-[10px] text-amber-200">Pausiert</span>}
                  </> : null}
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
