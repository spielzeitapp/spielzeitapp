import React, { useEffect, useState } from 'react';
import { isValidLogoUrl } from '../../utils/logoResolver';

export const FEED_MATCH_LOGO_SIZE_CLASS = 'h-[4.25rem] w-[4.25rem] sm:h-[5.25rem] sm:w-[5.25rem]';

export const FEED_MATCH_GRID_CLASS =
  'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:gap-x-6 md:gap-x-8';

export const FEED_MATCH_TEAM_COL_CLASS =
  'flex min-w-0 flex-col items-center justify-center gap-2 text-center sm:gap-2';

export function FeedMatchLogoBlock({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const valid = !failed && isValidLogoUrl(src);
  if (!valid) {
    return (
      <div
        className={`flex ${FEED_MATCH_LOGO_SIZE_CLASS} shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-black/55 shadow-[0_0_20px_rgba(227,29,47,0.22)]`}
        aria-label={alt}
      >
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-red-200/80">Club</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${FEED_MATCH_LOGO_SIZE_CLASS} shrink-0 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.65)]`}
    />
  );
}
