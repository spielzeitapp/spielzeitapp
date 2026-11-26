import { AttendanceStatCard } from '../events/AttendanceStatCard';
import { AttendanceThumbControls } from '../events/AttendanceThumbControls';
import { dbStatusToTrainingAttendance, trainingAttendanceLabel, type TrainingAttendanceStatus } from '../../lib/trainingAttendance';
import { PremiumStatusBadge, type PremiumStatusBadgeTone } from '../player/PremiumStatusBadge';
import React from 'react';
import { MatchPlayerRow } from '../match/MatchPlayerRow';
import {
  dsSectionLabelClass,
  DS_LIST_GAP,
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
  onSetDetailedStatus?: (playerId: string, status: TrainingAttendanceStatus) => void;
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
  onSetDetailedStatus,
  sortPlayers,
  statusBucket,
  readOnly = false,
}: Props) {
  const summary = (
    <div className="grid w-full grid-cols-3 gap-2">
      <AttendanceStatCard label="Zugesagt" value={yesCount} tone="present" />
      <AttendanceStatCard label="Abgesagt" value={noCount} tone="absent" />
      <AttendanceStatCard label="Offen" value={openCount} tone="open" />
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
    return (
      <div className="flex flex-col gap-1.5">
        <p className={`${dsSectionLabelClass()} !text-[11px]`}>{title}</p>
        {group.length === 0 ? <p className="text-[12px] text-white/45">Keine Spieler</p> : null}
        <ul className={`flex flex-col ${DS_LIST_GAP}`}>
          {group.map((player) => {
            const bucket = statusBucket(getAttendanceStatus, player.id);
            const rsvpDisplay = getMatchRsvpDisplay(player.id);
            const status = dbStatusToTrainingAttendance(rsvpDisplay) ?? 'open';
            const reasonTone: PremiumStatusBadgeTone | undefined =
              status === 'sick' || status === 'injured' || status === 'external' ? status : undefined;

            return (
              <li key={player.id}>
                <MatchPlayerRow player={player} status={bucket} layout="team-roster" hideNumber hideSubline
                  nameStatus={reasonTone && <PremiumStatusBadge label={trainingAttendanceLabel(status)} tone={reasonTone} />}
                  trailing={readOnly ? undefined : <AttendanceThumbControls name={player.display_name ?? player.name ?? 'Spieler'} status={status} isLaz={player.is_laz_player}
                    onSelect={next => onSetDetailedStatus ? onSetDetailedStatus(player.id, next) : onSetAttendance(player.id, next === 'present' ? 'yes' : 'no')} />}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <>
      {summary}
      <div className="mt-3 flex flex-col gap-4">
        {renderGroup('ZUGESAGT', yesPlayers)}
        {renderGroup('OFFEN', openPlayers)}
        {renderGroup('ABGESAGT', noPlayers)}
      </div>
    </>
  );
}
