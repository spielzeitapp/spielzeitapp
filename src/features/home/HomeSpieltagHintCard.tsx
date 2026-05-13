import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Share2 } from 'lucide-react';
import type { HomeMatchCardPick } from './homeFeedBuilder';
import { HOME_FEED_HERO_STATUS_LABEL } from './homeFeedBuilder';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe } from '../../components/match/matchCardLabels';

const WELCOME_GRADIENT =
  'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)';
const WELCOME_INSET = 'inset 0 0 120px rgba(120,20,20,0.12)';

type Props = {
  pick: HomeMatchCardPick;
};

export const HomeSpieltagHintCard: React.FC<Props> = ({ pick }) => {
  const { event, status } = pick;
  const [shareHint, setShareHint] = useState<string | null>(null);
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourClub = getOurTeamDisplayName();

  const badge =
    status === 'today'
      ? HOME_FEED_HERO_STATUS_LABEL.today
      : HOME_FEED_HERO_STATUS_LABEL.tomorrow;

  const kickoff =
    event.starts_at && !Number.isNaN(new Date(event.starts_at).getTime())
      ? formatMeetupTimeOnlyDe(event.starts_at)
      : '—';
  const meeting = event.meeting_at ? formatMeetupTimeOnlyDe(event.meeting_at) : null;
  const parsed = splitCombinedLocation(event.location);
  const ort =
    (formatFullLocation(parsed.place, parsed.address || (event.address ?? '').trim()) || '').trim() || '—';

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
      <div className="relative z-[1] min-w-0 space-y-2">
        <span className="inline-block rounded-md border border-red-500/40 bg-red-950/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-100">
          {badge}
        </span>
        <p className="truncate text-[15px] font-bold text-white sm:text-base">
          vs. {opponent}
        </p>
        <dl className="grid gap-1.5 text-[13px] leading-snug text-white/75 sm:text-sm">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="font-semibold text-red-200/90">Anpfiff</dt>
            <dd className="text-white/88">{kickoff}</dd>
          </div>
          {meeting ? (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <dt className="font-semibold text-red-200/90">Treffpunkt</dt>
              <dd className="text-white/88">{meeting}</dd>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
            <dt className="shrink-0 font-semibold text-red-200/90">Ort</dt>
            <dd className="flex min-w-0 items-start gap-1 text-white/88">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/85" aria-hidden />
              <span className="min-w-0 break-words">{ort}</span>
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
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
