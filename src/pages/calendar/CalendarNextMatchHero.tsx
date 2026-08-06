import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import { formatMeetingPoint, formatNextMatchWeekdayDate, formatTime } from './calendarUtils';
import { getClubLogo } from '../../lib/teamLogos';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  match: CalendarEvent;
};

function TeamLogo({ name }: { name: string }) {
  const [failed, setFailed] = React.useState(false);
  const src = getClubLogo(name);
  if (!name.trim() || failed) return null;

  return (
    <img
      src={src}
      alt=""
      className="h-7 w-7 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export const CalendarNextMatchHero: React.FC<Props> = ({ match }) => {
  const navigate = useNavigate();
  const basePath = useInternalBasePath();
  const homeTeam = (match.team_name ?? '').trim() || 'Unser Team';
  const awayTeam = (match.opponent ?? match.title ?? '').trim() || 'Gegner';
  const dateLine = formatNextMatchWeekdayDate(match.starts_at);
  const kickoffLine = formatTime(match.starts_at);
  const meetingLine = formatMeetingPoint(match.meeting_at);

  return (
    <div className="overflow-hidden rounded-xl border border-red-500/25 bg-gradient-to-br from-red-950/35 via-black/45 to-black/55 p-3 shadow-[0_0_22px_rgba(220,38,38,0.14)] backdrop-blur-[2px]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/85">
        Nächstes Spiel
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogo name={homeTeam} />
          <span className="truncate text-sm font-bold uppercase leading-tight text-white">
            {homeTeam}
          </span>
        </div>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/45">
          vs
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-bold uppercase leading-tight text-white">
            {awayTeam}
          </span>
          <TeamLogo name={awayTeam} />
        </div>
      </div>

      <div className="mt-2.5 space-y-0.5 text-[12px] leading-snug text-white/78">
        {dateLine ? <p>{dateLine}</p> : null}
        {kickoffLine ? <p>Anpfiff {kickoffLine}</p> : null}
        {meetingLine ? <p>{meetingLine}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => navigate(`${basePath}/events/${match.id}`)}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-red-500/35 bg-red-600/90 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_16px_rgba(220,38,38,0.2)] transition hover:bg-red-600"
      >
        Zum Spiel
      </button>
    </div>
  );
};
