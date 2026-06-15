import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Trophy } from 'lucide-react';
import { FeedCardHeaderBrand } from './FeedCardHeaderBrand';

export const FEED_HASHTAG = '#GEMEINSAMEINTEAM';

export const FEED_CAPTION_CLASS =
  'whitespace-pre-line px-0.5 text-[15px] font-medium leading-[1.45] text-white/94 sm:text-[16px]';

export const FEED_TIMESTAMP_CLASS = 'mt-1 text-[11px] leading-tight text-white/50 sm:text-xs';

export const FEED_POST_HEADER_CLASS =
  'flex items-start justify-between gap-3 border-b border-white/[0.05] bg-black/35 px-3 py-2.5 sm:px-4 sm:py-3';

export const FEED_POST_BADGE_ROW_CLASS =
  'flex items-center border-b border-white/[0.04] bg-black/25 px-3 py-1.5 sm:px-4';

/** Premium-Pill (Wettbewerb, Formation) — einheitliche Familie, roter Glow, keine weiße Kante. */
export const FEED_PREMIUM_BADGE_CLASS =
  'inline-flex min-h-[26px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-500/32 bg-red-950/55 px-3 py-1 text-[10px] font-semibold leading-none text-red-50/95 shadow-[0_0_20px_rgba(220,38,38,0.18)] sm:min-h-[28px] sm:text-[11px]';

export function FeedPremiumBadge({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`${FEED_PREMIUM_BADGE_CLASS} ${className}`.trim()}>{children}</span>;
}

export function FeedFormationBadge({ formation }: { formation: string }) {
  return (
    <FeedPremiumBadge className="tabular-nums font-bold tracking-[0.12em] text-white/95">
      {formation}
    </FeedPremiumBadge>
  );
}

/** Sektionskopf wie TORSCHÜTZEN / STARTELF — Icon + Label + roter Divider. */
export function FeedSectionHeader({
  icon,
  label,
}: {
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2 border-b border-red-500/20 pb-2">
      {icon ? (
        <span className="text-[11px] leading-none opacity-90" aria-hidden>
          {icon}
        </span>
      ) : null}
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200/95 sm:text-[11px]">{label}</p>
      <div className="h-px flex-1 bg-gradient-to-r from-red-500/40 via-red-500/20 to-transparent" aria-hidden />
    </div>
  );
}

export const FEED_HERO_TITLE_CLASS =
  'text-[16px] font-black uppercase leading-none tracking-[0.2em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.85),0_0_22px_rgba(255,71,71,0.5)] sm:text-[19px] sm:tracking-[0.24em]';

export const FEED_RESULT_SCORE_CLASS =
  'text-[2.65rem] font-black tabular-nums leading-none tracking-tight text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.75),0_0_32px_rgba(255,71,71,0.25)] min-[390px]:text-[3rem] sm:text-[3.5rem]';

export const FEED_POST_TYPE_BADGE_CLASS =
  'inline-flex min-h-[22px] items-center rounded-full border border-red-500/35 bg-red-950/55 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/95 shadow-[0_0_14px_rgba(220,38,38,0.12)]';

export const FEED_POST_TYPE_BADGE_LIVE_CLASS =
  'inline-flex min-h-[22px] items-center rounded-full border border-red-500/50 bg-red-600/85 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_0_16px_rgba(220,38,38,0.45)]';

export const FEED_POST_BODY_CLASS = 'min-w-0 px-0 pb-0 pt-0';

/** Stadion-Backdrop wie Welcome-Screen / Ergebnis-Post. */
export const FEED_STADIUM_BG_URL = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

export const FEED_STADIUM_HERO_SHELL_CLASS =
  'relative min-w-0 overflow-hidden rounded-none border-y border-red-500/20 bg-gradient-to-br from-[#180000] via-black to-[#240000] px-2 pb-4 pt-3 shadow-[0_10px_40px_rgba(255,0,0,0.18)] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-[20px] sm:border sm:px-2.5 sm:pb-4 sm:pt-3.5';

export const FEED_STADIUM_ARTICLE_SHADOW =
  'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 40px rgba(255,0,0,0.18), 0 14px 32px rgba(0,0,0,0.45)';

export function FeedStadiumHeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <img
        src={FEED_STADIUM_BG_URL}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full scale-110 object-cover object-[center_28%] opacity-[0.08] brightness-[0.28] saturate-[0.35]"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#180000]/95 via-black/97 to-[#240000]/95" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,38,38,0.14),transparent_55%)] opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(120,8,18,0.22)_0%,transparent_62%)]" />
    </div>
  );
}

/** Text/Actions unter Vollbreite-Medien — ein Padding-Layer (12–16px). */
export const FEED_POST_BODY_INSET_CLASS = 'px-3 sm:px-4';

export const FEED_POST_CAPTION_AFTER_MEDIA_CLASS = 'mt-3 mb-1 px-3 sm:px-4';

export const FEED_CAPTION_FOOTER_CLASS =
  'min-w-0 border-t border-white/[0.04] bg-[#060606]/95 px-3 pb-[max(0.75rem,calc(0.35rem+env(safe-area-inset-bottom,0px)))] pt-3 sm:px-4';

export const FEED_ACTIONS_ROW_BASE =
  'flex items-center justify-between gap-0 px-3 pb-[max(0.75rem,calc(0.35rem+env(safe-area-inset-bottom,0px)))] pt-2 sm:px-4';

export const FEED_ACTIONS_ROW_CLASS = `${FEED_ACTIONS_ROW_BASE} border-t border-white/[0.06]`;

/** Primärer Feed-CTA „Zum Spiel“ — einheitlich rot. */
export const FEED_GAME_CTA_CLASS =
  'inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl border border-red-500/45 bg-gradient-to-b from-[#FF4747] to-[#E31D2F] px-4 text-[14px] font-bold tracking-[0.02em] text-white shadow-[0_8px_22px_rgba(227,29,47,0.32),inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:brightness-110 active:scale-[0.98]';

export function FeedGameCtaLink({
  to,
  children = 'Zum Spiel',
  className = '',
}: {
  to: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={`${FEED_GAME_CTA_CLASS} ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function FeedMatchMetaBadge({ line, className = '' }: { line: string | null; className?: string }) {
  if (!line?.trim()) return null;
  const parts = line
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className={`flex items-center justify-center gap-2.5 px-1 ${className}`.trim()}>
      <div
        className="h-px min-w-[1.5rem] flex-1 max-w-[3rem] bg-gradient-to-r from-transparent via-red-500/40 to-red-500/20 sm:max-w-[4rem]"
        aria-hidden
      />
      <FeedPremiumBadge>
        <Trophy className="h-3 w-3 shrink-0 text-amber-400/95" strokeWidth={2.25} aria-hidden />
        {parts.map((part, i) => (
          <React.Fragment key={`${part}-${i}`}>
            {i > 0 ? <span className="text-red-300/45" aria-hidden>·</span> : null}
            <span className={/^U\d/i.test(part) ? 'font-bold tracking-wide' : 'tracking-[0.02em]'}>{part}</span>
          </React.Fragment>
        ))}
      </FeedPremiumBadge>
      <div
        className="h-px min-w-[1.5rem] flex-1 max-w-[3rem] bg-gradient-to-l from-transparent via-red-500/40 to-red-500/20 sm:max-w-[4rem]"
        aria-hidden
      />
    </div>
  );
}

export function FeedMatchDateVenueLine({
  dateLabel,
  venueLabel,
  className = '',
}: {
  dateLabel: string | null;
  venueLabel: string | null;
  className?: string;
}) {
  if (!dateLabel && !venueLabel) return null;
  return (
    <p
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[12px] font-medium leading-snug text-white/82 sm:text-[13px] ${className}`.trim()}
    >
      {dateLabel ? (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>📅</span>
          {dateLabel}
        </span>
      ) : null}
      {venueLabel ? (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>📍</span>
          {venueLabel}
        </span>
      ) : null}
    </p>
  );
}

export function FeedPostActionsFooter({
  shareHint,
  children,
  className = '',
}: {
  shareHint?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${FEED_CAPTION_FOOTER_CLASS} ${className}`.trim()}>
      {shareHint ? <p className="mb-2 text-center text-[12px] text-white/55">{shareHint}</p> : null}
      {children}
    </div>
  );
}

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
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'live';
  className?: string;
}) {
  const badgeClass = variant === 'live' ? FEED_POST_TYPE_BADGE_LIVE_CLASS : FEED_POST_TYPE_BADGE_CLASS;
  return (
    <div className={FEED_POST_BADGE_ROW_CLASS}>
      <span className={`${badgeClass} ${className}`.trim()}>{children}</span>
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
  inFooter = false,
}: {
  liked: boolean;
  onToggleLike: () => void;
  onShare: () => void;
  likeLabel?: string;
  commentHref?: string;
  className?: string;
  /** Innerhalb von FeedPostActionsFooter — kein doppelter Top-Border. */
  inFooter?: boolean;
}) {
  const rowClass = inFooter ? FEED_ACTIONS_ROW_BASE : FEED_ACTIONS_ROW_CLASS;
  return (
    <div
      className={`${rowClass} ${className}`.trim()}
      style={inFooter ? undefined : { boxShadow: 'inset 0 1px 0 rgba(220,38,38,0.05)' }}
    >
      <button
        type="button"
        onClick={onToggleLike}
        className={`${FEED_ACTION_BUTTON_CLASS} ${
          liked ? 'text-red-400' : 'text-white/62 hover:bg-white/[0.06] hover:text-white/90'
        }`}
        aria-pressed={liked}
      >
        <Heart className={`h-4 w-4 shrink-0 ${liked ? 'fill-current' : ''}`} strokeWidth={2} aria-hidden />
        {likeLabel}
      </button>
      <Link
        to={commentHref}
        className={`${FEED_ACTION_BUTTON_CLASS} text-white/58 hover:bg-white/[0.04] hover:text-white/88`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        Kommentar
      </Link>
      <button
        type="button"
        onClick={onShare}
        className={`${FEED_ACTION_BUTTON_CLASS} text-white/62 hover:bg-white/[0.06] hover:text-white/90`}
      >
        <Share2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
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
