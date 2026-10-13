import React, { useState } from 'react';
import { FeedPostShareActions } from './FeedPostShareActions';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Download, ArrowRight } from 'lucide-react';
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
import { useSession } from '../../auth/useSession';
import { canSeeMeetup, normalizeRole } from '../../lib/roles';
import { AutoFeedPostMediaEditButton } from './AutoFeedPostMediaEditButton';
import { AutoFeedPostCustomImage } from './AutoFeedPostCustomImage';
import { useDemoMode } from '../../demo/DemoContext';
import { downloadDemoSeasonPlanPdf } from '../../demo/demoSchedulePdf';
import './schedulePoster.css';

type Props = {
  post: TeamFeedPostDbRow;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
  onFeedPostUpdated?: () => void;
};

export function ChampionshipScheduleFeedPostCard({
  post,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
  onFeedPostUpdated,
}: Props) {
  const basePath = useInternalBasePath();
  const demo = useDemoMode();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const downloadDemoPlan = async () => {
    if (!demo || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const result = await downloadDemoSeasonPlanPdf(demo.data);
      if (result.error) setPdfError(result.error);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.');
    } finally {
      setPdfBusy(false);
    }
  };
  const payload = parseChampionshipSchedulePayload(post.payload);
  const sub = [payload?.age_group, payload?.season_name].filter(Boolean).join(' · ');
  const deepLink = basePath === '/demo' ? `${basePath}/spielplan` : CHAMPIONSHIP_SCHEDULE_DEEP_LINK;
  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);
  const seasonBadge = seasonLabel?.trim() || sub || null;

  return (
    <article className={`sz-club-feed-shell overflow-hidden rounded-[18px] border ${demo ? 'schedule-feed-shell' : ''}`}>
      <div className={FEED_POST_HEADER_CLASS}>
        <FeedCardHeaderBrand teamLabel={teamLabel} seasonLabel={seasonBadge} />
        {staffCanDelete ? (
          <div className="flex items-center gap-2">
            <AutoFeedPostMediaEditButton post={post} title="Spielplanbild" onUpdated={onFeedPostUpdated ?? (() => onFeedPostDeleted?.())} />
            <FeedPostDeleteButton
              input={toFeedPostDeleteInput(post)}
              onDeleted={() => onFeedPostDeleted?.()}
            />
          </div>
        ) : null}
      </div>
      {post.media_url?.trim() ? (
        <AutoFeedPostCustomImage mediaUrl={post.media_url} alt="Eigenes Spielplanbild" />
      ) : null}
      {demo ? <>
        {!post.media_url?.trim() ? <div className="schedule-poster" data-whatsapp-status-poster data-manager-artwork>
          <p className="schedule-poster-kicker"><CalendarDays aria-hidden />Dein Team. Deine Termine.</p>
          <h3>Dein Spielplan.<span>Alles im Blick.</span></h3>
          <p className="schedule-poster-meta">Treffpunkt · Anstoß · Spielort</p>
          <p className="schedule-poster-note">Zum Ausdrucken. Zum Teilen.</p>
        </div> : null}
        <div className="schedule-feed-actions">
          <button type="button" disabled={pdfBusy} onClick={() => void downloadDemoPlan()} className="schedule-feed-download">
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            {pdfBusy ? 'PDF wird erstellt…' : 'Spielplan herunterladen'}
          </button>
          <Link to={deepLink} className="schedule-feed-link">Spielplan ansehen<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          {pdfError ? <p role="alert" className="mt-2 text-sm text-red-300">{pdfError}</p> : null}
          <p className={`${FEED_TIMESTAMP_CLASS} mt-2`}>{whenLabel}</p>
        </div>
      </> : <div className={`${FEED_POST_BODY_CLASS} px-3 py-3 sm:px-4`}>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200/90">
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {demo ? 'Spielplan' : 'Meisterschaft'}
        </p>
        <h3 className="mt-1.5 text-[15px] font-semibold text-white sm:text-[16px]">
          {demo ? 'Hol dir deinen aktuellen Spielplan' : 'Meisterschaftsspielplan veröffentlicht'}
        </h3>
        {sub ? <p className="mt-1 text-[13px] text-white/70">{sub}</p> : null}
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">
          {(post.caption || '').replace(/^📅\s*Meisterschaftsspielplan veröffentlicht\s*/i, '').trim() ||
            'Der Meisterschaftsspielplan ist jetzt verfügbar.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {demo ? <button type="button" disabled={pdfBusy} onClick={() => void downloadDemoPlan()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-400/40 bg-red-950/50 px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {pdfBusy ? 'PDF wird erstellt…' : 'Spielplan herunterladen'}
          </button> : null}
          <Link
            to={deepLink}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-950/50 px-3.5 text-[13px] font-semibold text-emerald-100"
          >
            Spielplan ansehen
          </Link>
        </div>
        {pdfError ? <p role="alert" className="mt-2 text-sm text-red-300">{pdfError}</p> : null}
        <p className={FEED_TIMESTAMP_CLASS}>{whenLabel}</p>
      </div>}
      <FeedPostShareActions post={post} />
    </article>
  );
}

export function ChampionshipMatchChangedFeedPostCard({
  post,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
  onFeedPostUpdated,
}: Props) {
  const basePath = useInternalBasePath();
  const { backendRole, membershipRole } = useSession();
  const viewerRole = normalizeRole(membershipRole) ?? normalizeRole(backendRole);
  const viewerCanSeeMeetup = canSeeMeetup(viewerRole);
  const payload = parseChampionshipMatchChangedPayload(post.payload);
  const deepLink =
    payload?.deep_link ||
    (payload?.event_id ? `${basePath}/events/${payload.event_id}` : `${basePath}/termine`);
  const whenLabel = formatDateTimeMediumDeVienna(post.created_at);
  const meetup = payload?.meeting_at ? utcIsoToViennaTimeHHmm(payload.meeting_at) : null;

  return (
    <article className="sz-club-feed-shell overflow-hidden rounded-[18px] border">
      <div className={FEED_POST_HEADER_CLASS}>
        <FeedCardHeaderBrand teamLabel={teamLabel} seasonLabel={seasonLabel} />
        {staffCanDelete ? (
          <div className="flex items-center gap-2">
            <AutoFeedPostMediaEditButton post={post} title="Terminbild" onUpdated={onFeedPostUpdated ?? (() => onFeedPostDeleted?.())} />
            <FeedPostDeleteButton
              input={toFeedPostDeleteInput(post)}
              onDeleted={() => onFeedPostDeleted?.()}
            />
          </div>
        ) : null}
      </div>
      {post.media_url?.trim() ? (
        <AutoFeedPostCustomImage mediaUrl={post.media_url} alt="Eigenes Bild zur Terminänderung" />
      ) : null}
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
        {(viewerCanSeeMeetup && meetup) || payload?.location ? (
          <ul className="mt-2 space-y-0.5 text-[12px] text-white/65">
            {viewerCanSeeMeetup && meetup ? <li>Treffpunkt: {meetup}</li> : null}
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
      <FeedPostShareActions post={post} />
    </article>
  );
}
