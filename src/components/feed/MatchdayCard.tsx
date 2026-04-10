import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { EventRow } from '../../hooks/useEvents';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import { MatchCardGameCore } from '../match/MatchCardGameCore';

type MatchdayCardProps = {
  event: EventRow;
  /** Wird für Parität mit Terminen nicht mehr für Teamnamen in der 3-Spalten-Zeile genutzt (siehe getOurTeamDisplayName). */
  teamName: string;
  /** z. B. HEUTE IST MATCHDAY / MORGEN IST MATCHDAY / NÄCHSTES SPIEL */
  statusLabel?: string;
};

export const MatchdayCard: React.FC<MatchdayCardProps> = ({
  event,
  statusLabel = 'HEUTE IST MATCHDAY',
}) => {
  const ourClubName = getOurTeamDisplayName();
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const isHome = event.is_home;

  const { leftName, rightName } = useMemo(() => {
    if (isHome === true) return { leftName: ourClubName, rightName: opponent };
    if (isHome === false) return { leftName: opponent, rightName: ourClubName };
    return { leftName: ourClubName, rightName: opponent };
  }, [ourClubName, opponent, isHome]);

  const date = event.starts_at ? new Date(event.starts_at) : null;
  const timeStr = date
    ? new Intl.DateTimeFormat('de-AT', {
        timeZone: VIENNA_TZ,
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : '–';

  const showScore = false;
  const homeScore = 0;
  const awayScore = 0;

  const noteParts = (event.notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const endRaw = noteParts.find((p) => p.toLowerCase().startsWith('ende:'));
  const endTimeLabel = endRaw
    ? endRaw.replace(/^ende:\s*/i, '').replace(/\s*uhr\s*$/i, '').trim()
    : null;
  const descriptionParts = noteParts.slice(1).filter((p) => !p.toLowerCase().startsWith('ende:'));
  const descriptionText = descriptionParts.length ? descriptionParts.join(' · ') : null;

  const parsedLocation = splitCombinedLocation(event.location);
  const placeLine = parsedLocation.place;
  const addressLine = parsedLocation.address || (event.address ?? '').trim();
  const ortLine = (formatFullLocation(placeLine, addressLine) || '').trim() || '—';
  const meetLine = formatMeetupTimeOnlyDe(event.meeting_at) || '—';

  const headerTitle = getMatchTypeLabel(event.type);
  const meetupTimeOnly = formatMeetupTimeOnlyDe(event.meeting_at);

  return (
    <div className="space-y-3">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-red-400/95">
        {statusLabel}
      </p>

      <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-black to-red-900 px-4 py-5 shadow-xl sm:px-6 sm:py-6">
        <MatchCardGameCore
          headerTitle={headerTitle}
          leftName={leftName}
          rightName={rightName}
          opponentLogoUrl={null}
          timeDisplay={timeStr}
          isMatch
          showScore={showScore}
          homeScore={homeScore}
          awayScore={awayScore}
          kickoffLocation={null}
          meetupTimeOnly={meetupTimeOnly}
          showMeetupPill={false}
          endTimeLabel={endTimeLabel}
          descriptionText={descriptionText}
          variant="home-hero"
        />

        <div className="mt-5 grid grid-cols-1 gap-2 border-t border-white/10 pt-4 text-sm text-white/85 sm:grid-cols-2">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Treffpunkt</span>
            <p className="mt-0.5 font-medium text-white">{meetLine}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Ort</span>
            <p className="mt-0.5 font-medium leading-snug text-white">{ortLine}</p>
          </div>
        </div>

        <Link
          to={`/app/events/${event.id}`}
          className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-red-500 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-red-600 active:bg-red-700"
        >
          Details &amp; Zu-/Absage
        </Link>
      </div>
    </div>
  );
};
