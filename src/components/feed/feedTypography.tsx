import React, { useMemo } from 'react';

export const FEED_HASHTAG = '#GEMEINSAMEINTEAM';

export const FEED_CAPTION_CLASS =
  'whitespace-pre-line px-0.5 text-[16px] font-medium leading-[1.45] text-white/94 sm:text-[17px]';

export const FEED_TIMESTAMP_CLASS = 'mt-1 text-[11px] leading-tight text-white/50 sm:text-xs';

export const FEED_POST_HEADER_CLASS =
  'flex items-start justify-between gap-3 border-b border-white/[0.05] bg-black/35 px-3 py-3 sm:px-4';

export const FEED_POST_BODY_CLASS = 'min-w-0 space-y-3.5 px-3 pb-3 pt-3.5 sm:px-4';

export const FEED_CAPTION_FOOTER_CLASS =
  'min-w-0 border-t border-white/[0.04] bg-[#060606]/95 px-3 pb-[max(0.5rem,calc(0.25rem+env(safe-area-inset-bottom,0px)))] pt-3.5 sm:px-4';

export const FEED_ACTIONS_ROW_CLASS =
  'flex items-center justify-between gap-0.5 border-t border-white/[0.06] px-0.5 pt-3';

export const FEED_MATCH_META_CLASS =
  'text-[10px] font-medium uppercase tracking-[0.14em] text-white/45 sm:text-[11px]';

export function FeedCaption({ text }: { text: string }) {
  const nodes = useMemo(() => {
    if (!text.includes(FEED_HASHTAG)) {
      return { before: text, tag: null as string | null };
    }
    const i = text.lastIndexOf(FEED_HASHTAG);
    return {
      before: text.slice(0, i).replace(/\s+$/, ''),
      tag: FEED_HASHTAG,
    };
  }, [text]);

  if (!nodes.tag) {
    return <p className={FEED_CAPTION_CLASS}>{text}</p>;
  }

  return (
    <p className={FEED_CAPTION_CLASS}>
      {nodes.before ? (
        <>
          {nodes.before}
          {'\n'}
        </>
      ) : null}
      <span className="bg-gradient-to-r from-red-500 via-red-400 to-white bg-clip-text font-extrabold tracking-wide text-transparent drop-shadow-[0_0_18px_rgba(248,113,113,0.45)]">
        {nodes.tag}
      </span>
    </p>
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
