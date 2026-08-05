import React from 'react';
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

function typeIconClass(type: CalendarEvent['type']): string {
  if (type === 'game') return 'text-red-300';
  if (type === 'training') return 'text-emerald-300';
  if (type === 'tournament') return 'text-purple-300';
  if (type === 'event') return 'text-blue-300';
  return 'text-white/70';
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

export const CalendarCompactEventCard: React.FC<Props> = ({ ev, showTeamName = false, onClick }) => {
  const typeLabel = getEventTypeLabel(ev.type);
  const { title: notesTitle } = notesTitleAndDescription(ev.notes);
  const venue = (ev.venue_short ?? '').trim() || null;
  const meetingLine = formatMeetingPoint(ev.meeting_at);
  const timeLine = formatTimeRange(ev.starts_at, ev.end_at);

  let headline = ev.title;
  const metaLines: string[] = [];

  if (ev.type === 'training') {
    headline = trainingHeadline(ev.team_name, notesTitle);
    if (timeLine) metaLines.push(timeLine);
    if (meetingLine) metaLines.push(meetingLine);
  } else if (ev.type === 'game') {
    headline = (ev.opponent ?? ev.title ?? 'Spiel').trim() || 'Spiel';
    const matchLabel = shortMatchTypeLabel(ev.match_type);
    if (matchLabel) metaLines.push(matchLabel);
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

  const icon =
    ev.type === 'training' ? (
      <TrainingPlayerIcon variant="compact" />
    ) : ev.type === 'tournament' ? (
      <Trophy className={`h-5 w-5 shrink-0 ${typeIconClass(ev.type)}`} strokeWidth={2} aria-hidden />
    ) : ev.type === 'game' ? (
      <span className={`text-base leading-none ${typeIconClass(ev.type)}`} aria-hidden>
        ⚽
      </span>
    ) : (
      <CalendarDays className={`h-5 w-5 shrink-0 ${typeIconClass(ev.type)}`} aria-hidden />
    );

  return (
    <button
      type="button"
      onClick={() => onClick(ev.id)}
      className={[
        'flex w-full min-h-[44px] items-stretch gap-3 rounded-xl border border-white/10 border-l-[3px] bg-black/40 px-3 py-2.5 text-left transition active:bg-white/[0.04]',
        accentBorderClass(ev.type),
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{icon}</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/55">{typeLabel}</span>
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

        <p className="min-w-0 truncate text-[15px] font-semibold leading-tight text-white">{headline}</p>

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

      <span className="flex shrink-0 items-center self-center text-white/25" aria-hidden>
        <ChevronRight className="h-5 w-5" strokeWidth={2} />
      </span>
    </button>
  );
};
