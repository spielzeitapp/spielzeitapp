import React, { useMemo } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  countTrainingAttendanceByStatus,
  trainingAttendanceBucketRank,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../../lib/trainingAttendance';
import {
  dsActionButtonClass,
  dsStatChipBoxClass,
  DS_LIST_GAP,
  DS_SECTION_GAP,
  DS_STAT_GRID_GAP,
  type DsChipTone,
} from '../../lib/premiumDesignSystem';
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

const STAT_CHIPS: { key: keyof ReturnType<typeof countTrainingAttendanceByStatus>; label: string; tone: DsChipTone }[] = [
  { key: 'present', label: 'Dabei', tone: 'present' },
  { key: 'absent', label: 'Abwesend', tone: 'absent' },
  { key: 'injured', label: 'Verletzt', tone: 'injured' },
  { key: 'external', label: 'LAZ', tone: 'external' },
  { key: 'open', label: 'Offen', tone: 'open' },
  { key: 'legacyUnknown', label: 'N. erf.', tone: 'neutral' },
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
    <div className={`flex flex-col ${DS_SECTION_GAP} ${className}`}>
      <div className={`grid grid-cols-2 ${DS_STAT_GRID_GAP} sm:grid-cols-3`}>
        {visibleChips.map(({ key, label, tone }) => (
          <div key={key} className={dsStatChipBoxClass(tone)}>
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-80">{label}</div>
            <div className="mt-0.5 text-[17px] font-bold tabular-nums leading-none">{counts[key]}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-white/50">Lade Teilnahme…</p>
      ) : players.length === 0 ? (
        <p className="text-[13px] text-white/50">Keine Spieler im Kader.</p>
      ) : (
        <ul className={`flex flex-col ${DS_LIST_GAP} pb-1`}>
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
                    <div className={`grid grid-cols-2 ${DS_STAT_GRID_GAP} sm:grid-cols-4`}>
                      <button
                        type="button"
                        disabled={status === 'absent'}
                        onClick={() => onSetStatus(player.id, 'absent')}
                        className={dsActionButtonClass('absent', status === 'absent')}
                      >
                        Abwesend
                      </button>
                      <button
                        type="button"
                        disabled={status === 'injured'}
                        onClick={() => onSetStatus(player.id, 'injured')}
                        className={dsActionButtonClass('injured', status === 'injured')}
                      >
                        Verletzt
                      </button>
                      <button
                        type="button"
                        disabled={status === 'external'}
                        onClick={() => onSetStatus(player.id, 'external')}
                        className={dsActionButtonClass('external', status === 'external')}
                      >
                        LAZ
                      </button>
                      <button
                        type="button"
                        disabled={status === 'present'}
                        onClick={() => onSetStatus(player.id, 'present')}
                        className={dsActionButtonClass('present', status === 'present')}
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
