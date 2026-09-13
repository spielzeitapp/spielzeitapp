import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { computeMatchCenterCountdown } from '../../lib/matchCenterUtils';
import { formatFeedVenueShort } from '../../lib/eventLocation';
import { formatVisibleMatchEncounter } from '../../lib/oefbTeamNameNormalize';
import { getClubLogo, getTeamInitials } from '../../lib/teamLogos';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { formatHeroDateParts, formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { MatchCenterCountdown } from './MatchCenterCountdown';

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
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-black/50 text-[13px] font-black text-white/80">
        {getTeamInitials(name)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_5px_12px_rgba(0,0,0,0.65)] sm:h-[4.5rem] sm:w-[4.5rem]"
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
  const place = formatFeedVenueShort(event.location ?? event.address);
  const matchLabel = getMatchTypeLabel(event.match_type ?? event.type);

  return (
    <article className="sz-club-schedule-hero-card relative overflow-hidden rounded-[22px] border shadow-[0_0_32px_rgba(220,38,38,0.13),0_16px_48px_rgba(0,0,0,0.55)]">
      <div className="sz-club-schedule-hero-backdrop pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative border-b border-[rgb(var(--club-border-rgb)/0.16)] bg-black/35 px-4 py-3 backdrop-blur-sm">
        <p className="text-[12px] font-black uppercase tracking-[0.22em] text-red-300/90">
          Nächstes Spiel
        </p>
        {matchLabel ? (
          <p className="mt-1 text-[13px] font-semibold text-white/55">{matchLabel}</p>
        ) : null}
      </div>

      <div className="relative min-w-0 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
            <div className="flex min-w-0 flex-col items-center gap-2">
              <TeamLogoMark name={homeTeam} logoUrl={homeLogoUrl} />
              <p className="line-clamp-2 w-full text-center text-[14px] font-black leading-[1.15] text-white sm:text-[15px]">
                {homeTeam}
              </p>
            </div>
            <div className="flex min-w-[5.5rem] flex-col items-center pt-1 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-red-300/85">Anpfiff</span>
              <span className="mt-1 text-[2rem] font-black tabular-nums leading-none tracking-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.7)]">{kickoff}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">Uhr</span>
            </div>
            <div className="flex min-w-0 flex-col items-center gap-2">
              <TeamLogoMark name={awayTeam} logoUrl={awayLogoUrl} />
              <p className="line-clamp-2 w-full text-center text-[14px] font-black leading-[1.15] text-white sm:text-[15px]">
                {awayTeam}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[4.25rem_1fr] overflow-hidden rounded-[16px] border border-white/[0.08] bg-black/38 shadow-inner backdrop-blur-sm">
            <span className="inline-flex min-h-[4.5rem] flex-col items-center justify-center border-r border-white/[0.08] px-2 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-red-300/85">
                {dateParts.wd}
              </span>
              <span className="text-[25px] font-black tabular-nums leading-none text-white">{dateParts.day}</span>
              <span className="mt-0.5 text-[10px] font-bold uppercase text-white/58">{dateParts.mon}</span>
            </span>
            <div className="flex min-w-0 flex-col justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-white/76">
              {place ? (
                <p className="inline-flex min-w-0 items-start gap-1.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-400/85" aria-hidden />
                  <span className="min-w-0 break-words leading-snug">{place}</span>
                </p>
              ) : null}
              <p className="inline-flex items-center gap-1.5 text-white/48">
                <Clock className="h-4 w-4 shrink-0 text-red-400/65" aria-hidden />
                <span>Spielbeginn {kickoff} Uhr</span>
              </p>
            </div>
          </div>

          {countdown ? (
            <div className="mt-3">
              <MatchCenterCountdown parts={countdown} />
            </div>
          ) : null}

          <Link
            to={`/app/events/${event.id}`}
            className={`${dsPrimaryCtaClass()} mt-3 inline-flex min-h-[46px] w-full touch-manipulation items-center justify-center px-4 py-2.5 text-[15px] font-black`}
          >
            Zum Spiel
          </Link>
      </div>
    </article>
  );
}
