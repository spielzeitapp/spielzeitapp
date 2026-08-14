import React from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import {
  feedPostHasCta,
  openFeedCtaUrl,
  resolveFeedCtaLabel,
  validateFeedCtaUrl,
} from '../../lib/feedCtaLink';

type Props = {
  ctaUrl: string | null | undefined;
  ctaLabel?: string | null | undefined;
  className?: string;
};

/** Roter Full-Width-CTA unter dem Beitragstext — nur wenn cta_url gültig ist. */
export const FeedPostCtaButton: React.FC<Props> = ({ ctaUrl, ctaLabel, className = '' }) => {
  if (!feedPostHasCta({ cta_url: ctaUrl })) return null;
  const validated = validateFeedCtaUrl(ctaUrl);
  if (!validated.ok || !validated.url) return null;

  const label = resolveFeedCtaLabel(ctaLabel);
  const looksLikeStream = /livestream|live\s*stream|ansehen/i.test(label);
  const href = validated.url;

  return (
    <div className={`mt-3 w-full min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => openFeedCtaUrl(href)}
        className={`${dsPrimaryCtaClass()} flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2 px-4 py-3 text-[13px] font-bold uppercase tracking-[0.04em]`}
      >
        {looksLikeStream ? (
          <Play className="h-4 w-4 shrink-0 fill-current" strokeWidth={2.25} aria-hidden />
        ) : (
          <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        )}
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
};
