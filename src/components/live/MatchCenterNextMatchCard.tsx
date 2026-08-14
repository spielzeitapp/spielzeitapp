import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { computeMatchCenterCountdown } from '../../lib/matchCenterUtils';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { formatVisibleMatchEncounter } from '../../lib/oefbTeamNameNormalize';
import { getClubLogo, getTeamInitials } from '../../lib/teamLogos';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { formatHeroDateParts, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { MatchCenterCountdown } from './MatchCenterCountdown';

const stadiumBgUrl = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

type Props = {
  event: EventRow;
  ourTeamName: string;
  now: Date;
};

function TeamLogoMark({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const src = getClubLogo(name, { logoUrl });
  if (failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/50 text-[12px] font-bold text-white/80">
        {getTeamInitials(name)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-12 w-12 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function MatchCenterNextMatchCard({ event, ourTeamName, now }: Props) {
  const enc = formatVisibleMatchEncounter({
    isHome: event.is_home,
    ourTeamName,
    opponentName: event.opponent,
  });
  const homeTeam = enc.home;
  const awayTeam = enc.away;
  const homeLogoUrl = event.is_home === false ? event.opponent_logo_url : null;
  const awayLogoUrl = event.is_home === false ? null : event.opponent_logo_url;

  const countdown = useMemo(
    () => computeMatchCenterCountdown(event.starts_at, now),
    [event.starts_at, now],
  );
  const dateParts = formatHeroDateParts(event.starts_at);
  const kickoff = formatTimeHHmmDe(event.starts_at);
  const parsedLocation = splitCombinedLocation(event.location);
  const place = formatFullLocation(parsedLocation.place, parsedLocation.address || (event.address ?? ''));
  const matchLabel = getMatchTypeLabel(event.match_type ?? event.type);

  return (
    <article className="relative overflow-hidden rounded-[20px] border border-[rgba(220,38,38,0.32)] shadow-[0_0_32px_rgba(220,38,38,0.12),0_16px_48px_rgba(0,0,0,0.55)]">
      <div className="relative bg-black px-3 py-2.5 sm:px-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/85">
          Nächstes Spiel
        </p>
        {matchLabel ? (
          <p className="mt-0.5 text-[11px] font-medium text-white/45">{matchLabel}</p>
        ) : null}
      </div>

      <div className="relative min-w-0 overflow-hidden">
        <img
          src={stadiumBgUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover object-[center_28%] opacity-[0.16] brightness-[0.55] saturate-[0.8]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,10,12,0.82)_0%,rgba(14,8,10,0.94)_55%,rgba(8,6,8,0.97)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(255,240,220,0.12)_0%,rgba(122,29,42,0.16)_32%,transparent_62%)]"
          aria-hidden
        />

        <div className="relative px-3 py-3.5 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <TeamLogoMark name={homeTeam} logoUrl={homeLogoUrl} />
              <p className="line-clamp-2 w-full text-center text-[11px] font-bold leading-snug text-white">
                {homeTeam}
              </p>
            </div>
            <span className="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
              vs
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <TeamLogoMark name={awayTeam} logoUrl={awayLogoUrl} />
              <p className="line-clamp-2 w-full text-center text-[11px] font-bold leading-snug text-white">
                {awayTeam}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[12px] text-white/72">
            <span className="inline-flex min-w-[3rem] flex-col items-center rounded-lg border border-red-500/25 bg-black/35 px-2 py-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-red-300/80">
                {dateParts.wd}
              </span>
              <span className="text-[18px] font-bold leading-none text-white">{dateParts.day}</span>
              <span className="text-[10px] font-semibold uppercase text-white/55">{dateParts.mon}</span>
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
                <span>Anpfiff {kickoff} Uhr</span>
              </p>
              {place ? (
                <p className="inline-flex min-w-0 items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/80" aria-hidden />
                  <span className="min-w-0 break-words leading-snug">{place}</span>
                </p>
              ) : null}
            </div>
          </div>

          {countdown ? (
            <div className="mt-3.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
                Countdown
              </p>
              <MatchCenterCountdown parts={countdown} />
            </div>
          ) : null}

          <Link
            to={`/app/events/${event.id}`}
            className={`${dsPrimaryCtaClass()} mt-4 inline-flex min-h-[48px] w-full touch-manipulation items-center justify-center px-4 py-3 text-[14px] font-semibold`}
          >
            Zum Spiel
          </Link>
        </div>
      </div>
    </article>
  );
}
