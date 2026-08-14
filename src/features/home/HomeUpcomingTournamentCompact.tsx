import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, MapPin, Trophy, Users } from 'lucide-react';
import type { HomeSportingCardPick } from './homeFeedBuilder';
import { HOME_NEXT_TOURNAMENT_ORG_LABEL } from './homeFeedBuilder';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { eventNotesTitle } from '../../components/schedule/scheduleEventViewUtils';
import { formatMeetupTimeOnlyDe } from '../../components/match/matchCardLabels';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { PremiumCard } from '../../ui';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  pick: HomeSportingCardPick;
};

export const HomeUpcomingTournamentCompact: React.FC<Props> = ({ pick }) => {
  const basePath = useInternalBasePath();
  const { event, status } = pick;
  const title =
    safeText(
      eventNotesTitle(event.notes) ?? safeOptionalText(event.opponent) ?? 'Turnier',
    ) || 'Turnier';
  const statusLabel = HOME_NEXT_TOURNAMENT_ORG_LABEL[status];

  const dateLine = useMemo(() => {
    if (!event.starts_at) return '–';
    const d = new Date(event.starts_at);
    if (Number.isNaN(d.getTime())) return '–';
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }, [event.starts_at]);

  const timeLine = useMemo(() => {
    if (!event.starts_at) return null;
    const d = new Date(event.starts_at);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }, [event.starts_at]);

  const meetupLine = useMemo(() => {
    if (!event.meeting_at) return null;
    const raw = formatMeetupTimeOnlyDe(event.meeting_at);
    const core = raw.replace(/\s*Uhr$/i, '').trim();
    return core || null;
  }, [event.meeting_at]);

  const parsedLocation = splitCombinedLocation(event.location);
  const placeShort = (
    formatFullLocation(parsedLocation.place, parsedLocation.address || (event.address ?? '').trim()) ||
    ''
  ).trim();

  return (
    <PremiumCard
      as="section"
      matchday
      className="border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(22,22,24,0.98)] to-[rgba(12,8,10,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_28px_rgba(0,0,0,0.45)]"
      aria-label="Nächstes Turnier"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />
      <Link
        to={`${basePath}/events/${event.id}`}
        className="relative flex min-h-[80px] items-stretch gap-3 px-3 py-3.5 pr-2 transition-colors hover:bg-white/[0.02] active:bg-white/[0.04]"
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-950/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100/95">
              <Trophy className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              {statusLabel}
            </span>
          </div>
          <p className="text-[15px] font-semibold leading-snug text-white">{title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/62">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
              {dateLine}
              {timeLine ? ` · Beginn ${timeLine}` : ''}
            </span>
            {meetupLine ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
                Treffpunkt {meetupLine}
              </span>
            ) : null}
            {placeShort ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
                <span className="min-w-0 break-words">{placeShort}</span>
              </span>
            ) : null}
          </div>
          <span className="text-[12px] font-semibold text-red-300/90">Turnier öffnen</span>
        </div>
        <div className="flex shrink-0 items-center self-center pr-1 text-white/32">
          <ChevronRight className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </div>
      </Link>
    </PremiumCard>
  );
};
