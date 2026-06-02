import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, MapPin, Share2 } from 'lucide-react';
import type { HomeMatchCardPick } from './homeFeedBuilder';
import { HOME_FEED_HERO_STATUS_LABEL } from './homeFeedBuilder';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe } from '../../components/match/matchCardLabels';
import { FeedClubName } from '../../components/feed/FeedClubName';

const WELCOME_GRADIENT =
  'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)';
const WELCOME_INSET = 'inset 0 0 120px rgba(120,20,20,0.12)';
const PLACEHOLDER = '/logos/placeholder-shield-a.png';

function LogoWithFallback({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const url = failed ? PLACEHOLDER : src || PLACEHOLDER;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/35 bg-black/45 shadow-[0_0_0_1px_rgba(220,38,38,0.18),0_8px_18px_rgba(0,0,0,0.45)]">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => {
          if (!url.endsWith('/logos/placeholder-shield-a.png')) setFailed(true);
        }}
        className="h-14 w-14 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]"
      />
    </div>
  );
}

type Props = {
  pick: HomeMatchCardPick;
};

export const HomeSpieltagHintCard: React.FC<Props> = ({ pick }) => {
  const { event, status } = pick;
  const [shareHint, setShareHint] = useState<string | null>(null);
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourClub = getOurTeamDisplayName();
  const isHome = event.is_home !== false;
  const homeName = isHome ? ourClub : opponent;
  const awayName = isHome ? opponent : ourClub;
  const homeLogo = isHome
    ? getClubLogo(ourClub)
    : getClubLogo(homeName, { logoUrl: event.opponent_logo_url ?? undefined });
  const awayLogo = isHome
    ? getClubLogo(awayName, { logoUrl: event.opponent_logo_url ?? undefined })
    : getClubLogo(ourClub);

  const badge = status === 'today' ? HOME_FEED_HERO_STATUS_LABEL.today : HOME_FEED_HERO_STATUS_LABEL.tomorrow;

  const kickoff =
    event.starts_at && !Number.isNaN(new Date(event.starts_at).getTime())
      ? formatMeetupTimeOnlyDe(event.starts_at)
      : '—';
  const parsed = splitCombinedLocation(event.location);
  const ort =
    (formatFullLocation(parsed.place, parsed.address || (event.address ?? '').trim()) || '').trim() || '—';
  const dateLabel =
    event.starts_at && !Number.isNaN(new Date(event.starts_at).getTime())
      ? new Intl.DateTimeFormat('de-AT', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        }).format(new Date(event.starts_at))
      : '—';

  const eventUrl =
    typeof window !== 'undefined'
      ? new URL(`app/events/${event.id}`, `${window.location.origin}${import.meta.env.BASE_URL || '/'}`).href
      : '';

  const onShare = useCallback(async () => {
    if (!eventUrl) return;
    const title = 'SpielzeitApp · Spieltag';
    const text = `${ourClub} vs. ${opponent} · Anpfiff ${kickoff}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const data: ShareData = { title, text, url: eventUrl };
        if (typeof navigator.canShare !== 'function' || navigator.canShare(data)) {
          await navigator.share(data);
          return;
        }
      }
      await navigator.clipboard.writeText(`${text}\n${eventUrl}`);
      setShareHint('Link kopiert.');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setShareHint('Teilen nicht möglich.');
    }
    window.setTimeout(() => setShareHint(null), 2200);
  }, [eventUrl, kickoff, opponent, ourClub]);

  return (
    <section
      className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-red-600/35 px-3 py-3 shadow-lg sm:px-4 sm:py-3.5"
      style={{
        background: WELCOME_GRADIENT,
        boxShadow: `${WELCOME_INSET}, 0 0 0 1px rgba(220,38,38,0.12), 0 12px 32px rgba(0,0,0,0.5)`,
      }}
      aria-label="Spieltag"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(248,113,113,0.45), transparent 70%)',
        }}
      />
      <div className="relative z-[1] min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-block rounded-full border border-red-500/45 bg-red-950/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100">
            {badge}
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">SpielzeitApp</p>
        </div>
        <h2 className="text-center text-[36px] font-black uppercase leading-[0.88] tracking-[0.12em] text-white [text-shadow:0_0_20px_rgba(220,38,38,0.3)]">
          SPIELTAG
        </h2>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0 space-y-2">
            <div className="flex justify-center">
              <LogoWithFallback src={homeLogo} alt={`${homeName} Logo`} />
            </div>
            <FeedClubName fullName={homeName} variant="poster" className="w-full px-0.5" />
          </div>
          <div className="px-1 text-center">
            <span className="text-[26px] font-black uppercase tracking-[0.1em] text-white/88">VS</span>
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex justify-center">
              <LogoWithFallback src={awayLogo} alt={`${awayName} Logo`} />
            </div>
            <FeedClubName fullName={awayName} variant="poster" className="w-full px-0.5" />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="min-w-0">
              <dt className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200/90">
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Anpfiff
              </dt>
              <dd className="mt-0.5 text-[12px] font-semibold text-white/92">{kickoff}</dd>
            </div>
            <div className="min-w-0">
              <dt className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200/90">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Datum
              </dt>
              <dd className="mt-0.5 truncate text-[12px] font-semibold text-white/92">{dateLabel}</dd>
            </div>
            <div className="min-w-0">
              <dt className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200/90">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Ort
              </dt>
              <dd className="mt-0.5 line-clamp-2 break-words text-[12px] font-semibold leading-snug text-white/88">
                {ort}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/app/events/${event.id}`}
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-xl border border-red-500/45 bg-red-600/90 px-4 text-sm font-bold text-white shadow-md transition hover:bg-red-500 sm:flex-initial sm:min-w-[8.5rem]"
          >
            Zum Spiel
          </Link>
          <button
            type="button"
            onClick={() => void onShare()}
            className="inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl border border-white/18 bg-black/35 px-4 text-sm font-semibold text-white/90 backdrop-blur-sm transition hover:bg-white/10 sm:flex-initial sm:min-w-[8.5rem]"
          >
            <Share2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Teilen
          </button>
        </div>
        {shareHint ? <p className="text-center text-[12px] text-white/60">{shareHint}</p> : null}
      </div>
    </section>
  );
};
