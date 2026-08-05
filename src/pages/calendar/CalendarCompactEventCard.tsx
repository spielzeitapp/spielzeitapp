import React, { useState } from 'react';
import { CalendarDays, ChevronRight, Trophy } from 'lucide-react';
import type { CalendarEvent } from './calendarTypes';
import {
  formatMeetingPoint,
  formatTime,
  formatTimeRange,
  getEventTypeLabel,
  notesTitleAndDescription,
} from './calendarUtils';
import { TrainingPlayerIcon } from '../../components/schedule/TrainingPlayerIcon';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';

type Props = {
  ev: CalendarEvent;
  showTeamName?: boolean;
  onClick: (id: string) => void;
};

function accentBorderClass(type: CalendarEvent['type']): string {
  if (type === 'game') return 'border-l-red-500';
  if (type === 'training') return 'border-l-emerald-500';
  if (type === 'tournament') return 'border-l-purple-500';
  if (type === 'event') return 'border-l-blue-500';
  return 'border-l-white/30';
}

function ctaStripClass(type: CalendarEvent['type']): string {
  if (type === 'game') {
    return 'bg-gradient-to-b from-red-500/95 to-red-700/95 shadow-[0_0_14px_rgba(220,38,38,0.28)]';
  }
  if (type === 'training') {
    return 'bg-gradient-to-b from-teal-500/90 to-emerald-700/95 shadow-[0_0_14px_rgba(16,185,129,0.28)]';
  }
  if (type === 'tournament') {
    return 'bg-gradient-to-b from-purple-500/90 to-purple-800/95 shadow-[0_0_14px_rgba(168,85,247,0.24)]';
  }
  if (type === 'event') {
    return 'bg-gradient-to-b from-blue-500/85 to-blue-800/95 shadow-[0_0_14px_rgba(59,130,246,0.22)]';
  }
  return 'bg-gradient-to-b from-white/20 to-white/10';
}

function trainingHeadline(teamName: string | null, notesTitle: string | null): string {
  const team = (teamName ?? '').trim();
  let m = team.match(/\bU\s*(\d{1,2})\b/i);
  if (m) return `U${m[1]} Training`;
  m = team.match(/\bU(\d{1,2})\b/i);
  if (m) return `U${m[1]} Training`;
  const n = (notesTitle ?? '').trim();
  if (n && n.toLowerCase() !== 'training') return n;
  return 'Training';
}

function shortMatchTypeLabel(matchType: string | null | undefined): string | null {
  const raw = (matchType ?? '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === 'league' || key === 'game' || /^meisterschaft/i.test(raw)) return 'Meisterschaft';
  if (/freundschaft/i.test(raw)) return 'Freundschaft';
  if (/testspiel/i.test(raw)) return 'Testspiel';
  if (/turnier/i.test(raw)) return 'Turnier';
  return raw;
}

function homeAwayLabel(isHome: boolean | null | undefined): string | null {
  if (isHome === true) return 'Heim';
  if (isHome === false) return 'Auswärts';
  return null;
}

function ClubLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-black/40 text-sm"
        aria-hidden
      >
        ⚽
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-9 w-9 shrink-0 object-contain"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

/** Begegnung: Logos links ausgerichtet, „–“ unter dem Text (nicht isoliert links). */
function GameMatchup({
  opponent,
  isHome,
  opponentLogoUrl,
}: {
  opponent: string;
  isHome: boolean | null | undefined;
  opponentLogoUrl?: string | null;
}) {
  const ourName = getOurTeamDisplayName();
  const oppName = opponent.trim() || 'Gegner';
  const oppLogo = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });
  const ourLogo = getClubLogo(ourName, { ourTeam: true });

  const primaryName = isHome === false ? oppName : ourName;
  const secondaryName = isHome === false ? ourName : oppName;
  const primaryLogo = isHome === false ? oppLogo : ourLogo;
  const secondaryLogo = isHome === false ? ourLogo : oppLogo;

  return (
    <div className="flex min-w-0 flex-col gap-0">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex w-9 shrink-0 items-center justify-center">
          <ClubLogo src={primaryLogo} />
        </div>
        <span className="min-w-0 truncate text-[14px] font-semibold leading-tight text-white">
          {primaryName}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 leading-none">
        <div className="w-9 shrink-0" aria-hidden />
        <span className="text-[11px] font-medium text-white/40" aria-hidden>
          –
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex w-9 shrink-0 items-center justify-center">
          <ClubLogo src={secondaryLogo} />
        </div>
        <span className="min-w-0 truncate text-[13px] font-medium leading-tight text-white/78">
          {secondaryName}
        </span>
      </div>
    </div>
  );
}

export const CalendarCompactEventCard: React.FC<Props> = ({ ev, showTeamName = false, onClick }) => {
  const typeLabel = getEventTypeLabel(ev.type);
  const { title: notesTitle } = notesTitleAndDescription(ev.notes);
  const venue = (ev.venue_short ?? '').trim() || null;
  const meetingLine = formatMeetingPoint(ev.meeting_at);
  const timeLine = formatTimeRange(ev.starts_at, ev.end_at);

  let headline = ev.title;
  const metaLines: string[] = [];
  let typeBadge = typeLabel;

  if (ev.type === 'training') {
    headline = trainingHeadline(ev.team_name, notesTitle);
    if (timeLine) metaLines.push(timeLine);
    if (meetingLine) metaLines.push(meetingLine);
  } else if (ev.type === 'game') {
    headline = (ev.opponent ?? ev.title ?? 'Spiel').trim() || 'Spiel';
    const matchLabel = shortMatchTypeLabel(ev.match_type);
    if (matchLabel) typeBadge = matchLabel;
    if (meetingLine) metaLines.push(meetingLine);
    const kickoff = formatTime(ev.starts_at);
    if (kickoff) metaLines.push(`Anpfiff ${kickoff}`);
  } else if (ev.type === 'tournament') {
    headline = notesTitle ?? ev.title ?? 'Turnier';
    if (meetingLine) metaLines.push(meetingLine);
    const kickoff = formatTime(ev.starts_at);
    if (kickoff) metaLines.push(`Beginn ${kickoff}`);
  } else {
    headline = notesTitle ?? ev.title ?? 'Termin';
    if (timeLine) metaLines.push(timeLine);
  }

  const homeAway = ev.type === 'game' ? homeAwayLabel(ev.is_home) : null;

  const leftSlot =
    ev.type === 'training' ? (
      <div className="flex w-[52px] shrink-0 items-center justify-center self-center pl-1.5">
        <TrainingPlayerIcon variant="list" className="!ml-0 !mr-0 !w-[48px]" />
      </div>
    ) : ev.type === 'tournament' ? (
      <div className="flex w-11 shrink-0 items-center justify-center self-center pl-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-950/45">
          <Trophy className="h-5 w-5 text-amber-300/95" strokeWidth={2} aria-hidden />
        </span>
      </div>
    ) : ev.type === 'game' ? null : (
      <div className="flex w-11 shrink-0 items-center justify-center self-center pl-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-950/40">
          <CalendarDays className="h-5 w-5 text-blue-200/90" aria-hidden />
        </span>
      </div>
    );

  return (
    <button
      type="button"
      onClick={() => onClick(ev.id)}
      className={[
        'flex w-full min-h-[44px] items-stretch overflow-hidden rounded-xl border border-white/10 border-l-[3px] bg-black/40 text-left transition active:bg-white/[0.04]',
        accentBorderClass(ev.type),
      ].join(' ')}
    >
      {leftSlot}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-2 pl-2 pr-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/38">
            {typeBadge}
          </span>
          {homeAway ? (
            <span
              className={[
                'ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold',
                ev.is_home
                  ? 'border border-emerald-500/35 bg-emerald-950/50 text-emerald-200'
                  : 'border border-red-500/35 text-red-300/90',
              ].join(' ')}
            >
              {homeAway}
            </span>
          ) : null}
        </div>

        {ev.type === 'game' ? (
          <GameMatchup
            opponent={headline}
            isHome={ev.is_home}
            opponentLogoUrl={ev.opponent_logo_url}
          />
        ) : (
          <p className="min-w-0 truncate text-[15px] font-semibold leading-tight text-white">{headline}</p>
        )}

        {metaLines.map((line) => (
          <p key={line} className="min-w-0 truncate text-[12px] leading-snug text-white/68">
            {line}
          </p>
        ))}

        {venue ? (
          <p className="min-w-0 truncate text-[12px] leading-snug text-white/55">{venue}</p>
        ) : null}

        {showTeamName && ev.team_name ? (
          <p className="min-w-0 truncate text-[11px] text-white/45">{ev.team_name}</p>
        ) : null}
      </div>

      <span
        className={[
          'flex w-11 shrink-0 items-center justify-center self-stretch text-white',
          ctaStripClass(ev.type),
        ].join(' ')}
        aria-hidden
      >
        <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
      </span>
    </button>
  );
};
