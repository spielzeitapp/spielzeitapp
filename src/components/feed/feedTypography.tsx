import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';

export const FEED_HASHTAG = '#GEMEINSAMEINTEAM';

export const FEED_CAPTION_CLASS =
  'whitespace-pre-line px-0.5 text-[15px] font-medium leading-[1.45] text-white/94 sm:text-[16px]';

export const FEED_TIMESTAMP_CLASS = 'mt-1 text-[11px] leading-tight text-white/50 sm:text-xs';

export const FEED_POST_HEADER_CLASS =
  'flex items-start justify-between gap-3 border-b border-white/[0.05] bg-black/35 px-3 py-2.5 sm:px-4 sm:py-3';

export const FEED_POST_BADGE_ROW_CLASS =
  'flex items-center border-b border-white/[0.04] bg-black/25 px-3 py-1.5 sm:px-4';

export const FEED_POST_TYPE_BADGE_CLASS =
  'inline-flex rounded-full border border-red-500/35 bg-red-950/55 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/95';

export const FEED_POST_BODY_CLASS = 'min-w-0 px-0 pb-0 pt-0';

/** Text/Actions unter Vollbreite-Medien — ein Padding-Layer (12–16px). */
export const FEED_POST_BODY_INSET_CLASS = 'px-3 sm:px-4';

export const FEED_POST_CAPTION_AFTER_MEDIA_CLASS = 'mt-3 mb-1 px-3 sm:px-4';

export const FEED_CAPTION_FOOTER_CLASS =
  'min-w-0 border-t border-white/[0.04] bg-[#060606]/95 px-3 pb-[max(0.75rem,calc(0.35rem+env(safe-area-inset-bottom,0px)))] pt-3 sm:px-4';

export const FEED_ACTIONS_ROW_CLASS =
  'flex items-center justify-between gap-0 border-t border-white/[0.06] px-3 pb-1 pt-2 sm:px-4';

export const FEED_ACTION_BUTTON_CLASS =
  'inline-flex min-h-[40px] flex-1 touch-manipulation items-center justify-center gap-1 rounded-lg py-1.5 text-[13px] font-semibold transition-colors sm:min-h-[42px] sm:text-sm';

export const FEED_CAPTION_TOGGLE_CLASS =
  'mt-1.5 touch-manipulation text-left text-[13px] font-semibold text-red-400 transition-colors hover:text-red-300 active:text-red-200';

export const FEED_MATCH_META_CLASS =
  'text-[10px] font-medium uppercase tracking-[0.14em] text-white/45 sm:text-[11px]';

function renderCaptionInline(text: string): React.ReactNode {
  if (!text.includes(FEED_HASHTAG)) return text;
  const i = text.lastIndexOf(FEED_HASHTAG);
  const before = text.slice(0, i).replace(/\s+$/, '');
  return (
    <>
      {before ? (
        <>
          {before}
          {'\n'}
        </>
      ) : null}
      <span className="bg-gradient-to-r from-red-500 via-red-400 to-white bg-clip-text font-extrabold tracking-wide text-transparent drop-shadow-[0_0_18px_rgba(248,113,113,0.45)]">
        {FEED_HASHTAG}
      </span>
    </>
  );
}

export function FeedCaption({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [text, expanded]);

  const showToggle = overflows || expanded;

  return (
    <div className="min-w-0">
      <p ref={bodyRef} className={`${FEED_CAPTION_CLASS} ${expanded ? '' : 'line-clamp-3'}`}>
        {renderCaptionInline(text)}
      </p>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={FEED_CAPTION_TOGGLE_CLASS}
          aria-expanded={expanded}
        >
          {expanded ? 'weniger anzeigen' : 'mehr anzeigen'}
        </button>
      ) : null}
    </div>
  );
}

export function FeedPostHeader({
  teamLabel,
  whenLabel,
  headerClassName = '',
  actions,
}: {
  teamLabel: string;
  whenLabel: string;
  headerClassName?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={`${FEED_POST_HEADER_CLASS} ${headerClassName}`.trim()}>
      <div className="min-w-0 flex-1">
        <FeedCardHeaderBrand teamLabel={teamLabel} />
        <p className={FEED_TIMESTAMP_CLASS}>{whenLabel}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function FeedPostTypeBadge({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={FEED_POST_BADGE_ROW_CLASS}>
      <span className={`${FEED_POST_TYPE_BADGE_CLASS} ${className}`.trim()}>{children}</span>
    </div>
  );
}

export function FeedStandardActions({
  liked,
  onToggleLike,
  onShare,
  likeLabel = 'Gefällt mir',
  commentHref = '/app/nachrichten',
  className = '',
}: {
  liked: boolean;
  onToggleLike: () => void;
  onShare: () => void;
  likeLabel?: string;
  commentHref?: string;
  className?: string;
}) {
  return (
    <div
      className={`${FEED_ACTIONS_ROW_CLASS} ${className}`.trim()}
      style={{ boxShadow: 'inset 0 1px 0 rgba(220,38,38,0.05)' }}
    >
      <button
        type="button"
        onClick={onToggleLike}
        className={`${FEED_ACTION_BUTTON_CLASS} ${
          liked ? 'text-red-400' : 'text-white/68 hover:bg-white/[0.06] hover:text-white/92'
        }`}
        aria-pressed={liked}
      >
        <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} strokeWidth={2} />
        {likeLabel}
      </button>
      <Link
        to={commentHref}
        className={`${FEED_ACTION_BUTTON_CLASS} text-white/55 hover:bg-white/[0.04] hover:text-white/88`}
      >
        <MessageCircle className="h-4 w-4" strokeWidth={2} />
        Kommentar
      </Link>
      <button
        type="button"
        onClick={onShare}
        className={`${FEED_ACTION_BUTTON_CLASS} text-white/68 hover:bg-white/[0.06] hover:text-white/92`}
      >
        <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} />
        Teilen
      </button>
    </div>
  );
}

export function FeedMatchMetaLine({
  line,
  className = '',
}: {
  line: string | null;
  className?: string;
}) {
  if (!line) return null;
  return <p className={`${FEED_MATCH_META_CLASS} ${className}`.trim()}>{line}</p>;
}
