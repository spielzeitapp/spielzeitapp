import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import {
  CHAMPIONSHIP_SCHEDULE_DEEP_LINK,
  parseChampionshipMatchChangedPayload,
  parseChampionshipSchedulePayload,
} from '../../lib/championshipScheduleFeed';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';
import {
  FEED_POST_BODY_CLASS,
  FEED_POST_HEADER_CLASS,
  FEED_TIMESTAMP_CLASS,
} from './feedTypography';
import { formatDateTimeMediumDeVienna } from '../../lib/notifications/format';
import { utcIsoToViennaTimeHHmm } from '../../lib/viennaTime';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  post: TeamFeedPostDbRow;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

export function ChampionshipScheduleFeedPostCard({
  post,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
}: Props) {
  const basePath = useInternalBasePath();
  const payload = parseChampionshipSchedulePayload(post.payload);
  const sub = [payload?.age_group, payload?.season_name].filter(Boolean).join(' · ');
  const deepLink = basePath === '/demo' ? `${basePath}/termine` : CHAMPIONSHIP_SCHEDULE_DEEP_LINK;
  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);
  const seasonBadge = seasonLabel?.trim() || sub || null;

  return (
    <article className="overflow-hidden rounded-[18px] border border-emerald-500/25 bg-[linear-gradient(165deg,rgba(6,60,40,0.35)_0%,rgba(10,8,12,0.96)_48%)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
      <div className={FEED_POST_HEADER_CLASS}>
        <FeedCardHeaderBrand teamLabel={teamLabel} seasonLabel={seasonBadge} />
        {staffCanDelete ? (
          <FeedPostDeleteButton
            input={toFeedPostDeleteInput(post)}
            onDeleted={() => onFeedPostDeleted?.()}
          />
        ) : null}
      </div>
      <div className={`${FEED_POST_BODY_CLASS} px-3 py-3 sm:px-4`}>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200/90">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Meisterschaft
        </p>
        <h3 className="mt-1.5 text-[15px] font-semibold text-white sm:text-[16px]">
          Meisterschaftsspielplan veröffentlicht
        </h3>
        {sub ? <p className="mt-1 text-[13px] text-white/70">{sub}</p> : null}
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">
          {(post.caption || '').replace(/^📅\s*Meisterschaftsspielplan veröffentlicht\s*/i, '').trim() ||
            'Der Meisterschaftsspielplan ist jetzt verfügbar.'}
        </p>
        <div className="mt-3">
          <Link
            to={deepLink}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-950/50 px-3.5 text-[13px] font-semibold text-emerald-100"
          >
            Spielplan ansehen
          </Link>
        </div>
        <p className={FEED_TIMESTAMP_CLASS}>{whenLabel}</p>
      </div>
    </article>
  );
}

export function ChampionshipMatchChangedFeedPostCard({
  post,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
}: Props) {
  const basePath = useInternalBasePath();
  const payload = parseChampionshipMatchChangedPayload(post.payload);
  const deepLink =
    payload?.deep_link ||
    (payload?.event_id ? `${basePath}/events/${payload.event_id}` : `${basePath}/termine`);
  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);
  const meetup = payload?.meeting_at ? utcIsoToViennaTimeHHmm(payload.meeting_at) : null;

  return (
    <article className="overflow-hidden rounded-[18px] border border-amber-500/30 bg-[linear-gradient(165deg,rgba(88,62,12,0.28)_0%,rgba(10,8,12,0.96)_45%)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
      <div className={FEED_POST_HEADER_CLASS}>
        <FeedCardHeaderBrand teamLabel={teamLabel} seasonLabel={seasonLabel} />
        {staffCanDelete ? (
          <FeedPostDeleteButton
            input={toFeedPostDeleteInput(post)}
            onDeleted={() => onFeedPostDeleted?.()}
          />
        ) : null}
      </div>
      <div className={`${FEED_POST_BODY_CLASS} px-3 py-3 sm:px-4`}>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-200/90">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Terminänderung
        </p>
        <h3 className="mt-1.5 text-[15px] font-semibold text-white sm:text-[16px]">
          Spieltermin geändert
        </h3>
        {payload?.encounter ? (
          <p className="mt-1 text-[14px] font-medium text-white/90">{payload.encounter}</p>
        ) : null}
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">
          {post.caption?.trim() || 'Der Termin wurde aktualisiert.'}
        </p>
        {meetup || payload?.location ? (
          <ul className="mt-2 space-y-0.5 text-[12px] text-white/65">
            {meetup ? <li>Treffpunkt: {meetup}</li> : null}
            {payload?.location ? <li>Spielort: {payload.location}</li> : null}
          </ul>
        ) : null}
        <div className="mt-3">
          <Link
            to={deepLink}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-amber-400/40 bg-amber-950/45 px-3.5 text-[13px] font-semibold text-amber-100"
          >
            Termin ansehen
          </Link>
        </div>
        <p className={FEED_TIMESTAMP_CLASS}>{whenLabel}</p>
      </div>
    </article>
  );
}
