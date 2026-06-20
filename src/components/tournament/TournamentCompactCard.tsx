import React from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { resolveTournamentHeroBackgroundUrl } from '../../lib/matchCenterTournamentVisuals';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { safeOptionalText } from '../../lib/safeText';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from './tournamentCenterUtils';
import { TC_CARD, TC_META_ICON } from './tournamentCenterStyles';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  coverUrl?: unknown;
};

export function TournamentCompactCard({ title, startsAt, location, coverUrl }: Props) {
  const heroUrl = resolveTournamentHeroBackgroundUrl(safeOptionalText(coverUrl));
  const timeLabel = formatTimeHHmmDe(startsAt);
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const placeLine = formatTournamentLocationDisplay(location);

  return (
    <article className={`${TC_CARD} overflow-hidden`}>
      <div className="relative h-[5rem] w-full overflow-hidden sm:h-[5.75rem]">
        <img
          src={heroUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[84%_48%]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[rgba(4,4,6,0.96)] via-[rgba(4,4,6,0.55)] to-[rgba(4,4,6,0.15)]"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 px-3.5 pb-2.5 pt-6 sm:px-4">
          <p className="line-clamp-2 text-[16px] font-bold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] sm:text-[17px]">
            {title}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-3.5 py-2.5 sm:px-4 sm:py-3">
        <MetaRow icon={CalendarDays}>{dateLabel}</MetaRow>
        <MetaRow icon={Clock}>{timeLabel ? `${timeLabel} Uhr` : '—'}</MetaRow>
        <MetaRow icon={MapPin}>{placeLine || 'Ort folgt'}</MetaRow>
      </div>
    </article>
  );
}

function MetaRow({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <p className="inline-flex min-w-0 items-center gap-2 text-[12px] font-medium leading-snug text-white/82">
      <Icon className={TC_META_ICON} strokeWidth={2.25} aria-hidden />
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}
