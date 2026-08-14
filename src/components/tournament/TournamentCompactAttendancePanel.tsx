import React from 'react';
import { MatchPlayerRow } from '../match/MatchPlayerRow';
import {
  dsRsvpChoiceClass,
  dsSectionLabelClass,
  dsStatusChipClass,
  DS_LIST_GAP,
  DS_STAT_GRID_GAP,
} from '../../lib/premiumDesignSystem';
import type { PlayerItem } from '../../hooks/usePlayers';

type AttendanceBucket = 'open' | 'yes' | 'no';

type Props = {
  players: PlayerItem[];
  playersLoading: boolean;
  loadingAttendance: boolean;
  yesCount: number;
  noCount: number;
  openCount: number;
  getAttendanceStatus: (playerId: string) => string | null | undefined;
  getMatchRsvpDisplay: (playerId: string) => string | null | undefined;
  onSetAttendance: (playerId: string, status: 'yes' | 'no') => void;
  sortPlayers: (
    players: PlayerItem[],
    getStatus: (playerId: string) => string | null | undefined,
  ) => PlayerItem[];
  statusBucket: (
    getStatus: (playerId: string) => string | null | undefined,
    playerId: string,
  ) => AttendanceBucket;
  readOnly?: boolean;
};

function AttendancePlayerRow({
  player,
  badge,
  status,
  bucket,
  onYes,
  onNo,
  readOnly = false,
}: {
  player: PlayerItem;
  badge: string;
  status: 'open' | 'yes' | 'no';
  bucket: AttendanceBucket;
  onYes: () => void;
  onNo: () => void;
  readOnly?: boolean;
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <MatchPlayerRow player={player} status={status} rightLabel={badge} selected={bucket === 'yes'} />
      {readOnly ? null : (
        <div className="grid grid-cols-2 gap-1.5 px-0.5">
          <button
            type="button"
            onClick={onYes}
            aria-label={`${badge === 'ZUGESAGT' ? 'Zugesagt belassen' : 'Zusage setzen'} für ${player.display_name ?? 'Spieler'}`}
            className={`${dsRsvpChoiceClass('yes', bucket === 'yes')} !min-h-[44px] !rounded-xl !px-3 !py-2 !text-[13px] !font-bold touch-manipulation`}
          >
            ✓ Zusagen
          </button>
          <button
            type="button"
            onClick={onNo}
            aria-label={`Absage setzen für ${player.display_name ?? 'Spieler'}`}
            className={`${dsRsvpChoiceClass('no', bucket === 'no')} !min-h-[44px] !rounded-xl !px-3 !py-2 !text-[13px] !font-bold touch-manipulation`}
          >
            ✕ Absagen
          </button>
        </div>
      )}
    </li>
  );
}

export function TournamentCompactAttendancePanel({
  players,
  playersLoading,
  loadingAttendance,
  yesCount,
  noCount,
  openCount,
  getAttendanceStatus,
  getMatchRsvpDisplay,
  onSetAttendance,
  sortPlayers,
  statusBucket,
  readOnly = false,
}: Props) {
  const summary = (
    <div className={`flex flex-wrap ${DS_STAT_GRID_GAP}`}>
      <span className={dsStatusChipClass('present')}>✅ Zugesagt: {yesCount}</span>
      <span className={dsStatusChipClass('absent')}>❌ Abgesagt: {noCount}</span>
      <span className={dsStatusChipClass('open')}>❓ Offen: {openCount}</span>
    </div>
  );

  if (playersLoading || loadingAttendance) {
    return (
      <>
        {summary}
        <p className="mt-1.5 text-[12px] text-white/55">Lade Verfügbarkeit…</p>
      </>
    );
  }

  if (players.length === 0) {
    return (
      <>
        {summary}
        <p className="mt-1.5 text-[12px] text-white/55">Keine Spieler im Kader.</p>
      </>
    );
  }

  const sorted = sortPlayers(players, getAttendanceStatus);
  const openPlayers = sorted.filter((p) => statusBucket(getAttendanceStatus, p.id) === 'open');
  const yesPlayers = sorted.filter((p) => statusBucket(getAttendanceStatus, p.id) === 'yes');
  const noPlayers = sorted.filter((p) => statusBucket(getAttendanceStatus, p.id) === 'no');

  const renderGroup = (title: 'OFFEN' | 'ZUGESAGT' | 'ABGESAGT', group: PlayerItem[]) => {
    if (group.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <p className={`${dsSectionLabelClass()} !text-[9px]`}>{title}</p>
        <ul className={`flex flex-col ${DS_LIST_GAP}`}>
          {group.map((player) => {
            const bucket = statusBucket(getAttendanceStatus, player.id);
            const rsvpDisplay = getMatchRsvpDisplay(player.id);
            const badge =
              rsvpDisplay === 'yes'
                ? 'ZUGESAGT'
                : rsvpDisplay === 'injured'
                  ? 'VERLETZT'
                  : rsvpDisplay === 'sick'
                    ? 'KRANK'
                    : bucket === 'no'
                      ? 'ABGESAGT'
                      : 'OFFEN';
            const status: 'open' | 'yes' | 'no' =
              bucket === 'yes' ? 'yes' : bucket === 'no' ? 'no' : 'open';

            return (
              <AttendancePlayerRow
                key={player.id}
                player={player}
                badge={badge}
                status={status}
                bucket={bucket}
                onYes={() => onSetAttendance(player.id, 'yes')}
                onNo={() => onSetAttendance(player.id, 'no')}
                readOnly={readOnly}
              />
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <>
      {summary}
      <div className="mt-2 flex max-h-[min(70vh,32rem)] flex-col gap-2.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {renderGroup('OFFEN', openPlayers)}
        {renderGroup('ZUGESAGT', yesPlayers)}
        {renderGroup('ABGESAGT', noPlayers)}
      </div>
    </>
  );
}
