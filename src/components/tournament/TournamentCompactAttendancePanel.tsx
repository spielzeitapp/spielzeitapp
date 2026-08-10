import React from 'react';
import {
  dsRsvpChoiceClass,
  dsSectionLabelClass,
  dsStatusChipClass,
  DS_LIST_GAP,
  DS_STAT_GRID_GAP,
} from '../../lib/premiumDesignSystem';
import { premiumPlayerAvatarSrc, premiumPlayerDisplayName, premiumPlayerInitials } from '../../lib/premiumPlayerCard';
import type { PlayerItem } from '../../hooks/usePlayers';
import type { DsChipTone } from '../../lib/premiumDesignSystem';

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

function CompactPlayerRow({
  player,
  badge,
  chipTone,
  bucket,
  onYes,
  onNo,
  readOnly = false,
}: {
  player: PlayerItem;
  badge: string;
  chipTone: DsChipTone;
  bucket: AttendanceBucket;
  onYes: () => void;
  onNo: () => void;
  readOnly?: boolean;
}) {
  const name = premiumPlayerDisplayName(player);
  const avatarSrc = premiumPlayerAvatarSrc(player);
  const initials = premiumPlayerInitials(name);
  const num = player.jersey_number != null ? `#${player.jersey_number}` : null;

  return (
    <li className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-1.5 py-1">
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/40">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-white/65">
            {initials}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold leading-tight text-white/92">{name}</p>
        {num ? <p className="text-[9px] text-white/42">{num}</p> : null}
      </div>
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
          chipTone === 'present'
            ? 'bg-emerald-500/15 text-emerald-200/90'
            : chipTone === 'absent'
              ? 'bg-red-500/12 text-red-200/85'
              : chipTone === 'injured'
                ? 'bg-amber-500/12 text-amber-200/85'
                : 'bg-white/8 text-white/55'
        }`}
      >
        {badge}
      </span>
      {readOnly ? null : (
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={onYes}
            className={`${dsRsvpChoiceClass('yes', bucket === 'yes')} !min-h-[26px] !px-2 !py-0.5 !text-[9px]`}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={onNo}
            className={`${dsRsvpChoiceClass('no', bucket === 'no')} !min-h-[26px] !px-2 !py-0.5 !text-[9px]`}
          >
            ✗
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

  const renderGroup = (title: 'OFFEN' | 'DABEI' | 'ABWESEND', group: PlayerItem[]) => {
    if (group.length === 0) return null;
    return (
      <div className="flex flex-col gap-0.5">
        <p className={`${dsSectionLabelClass()} !text-[9px]`}>{title}</p>
        <ul className={`flex flex-col gap-0.5 ${DS_LIST_GAP}`}>
          {group.map((player) => {
            const bucket = statusBucket(getAttendanceStatus, player.id);
            const rsvpDisplay = getMatchRsvpDisplay(player.id);
            const badge =
              rsvpDisplay === 'yes'
                ? 'DABEI'
                : rsvpDisplay === 'injured'
                  ? 'VERLETZT'
                  : rsvpDisplay === 'sick'
                    ? 'KRANK'
                    : bucket === 'no'
                      ? 'ABWESEND'
                      : 'OFFEN';
            const chipTone: DsChipTone =
              rsvpDisplay === 'yes'
                ? 'present'
                : rsvpDisplay === 'injured'
                  ? 'injured'
                  : bucket === 'no'
                    ? 'absent'
                    : 'open';

            return (
              <CompactPlayerRow
                key={player.id}
                player={player}
                badge={badge}
                chipTone={chipTone}
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
      <div className="mt-1.5 flex max-h-[min(52vh,17.5rem)] flex-col gap-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {renderGroup('OFFEN', openPlayers)}
        {renderGroup('DABEI', yesPlayers)}
        {renderGroup('ABWESEND', noPlayers)}
      </div>
    </>
  );
}
