import { useEffect, useState } from 'react';
import { getCachedFeedMediaUrl, resolveFeedMediaUrl, type FeedMediaVariant } from '../lib/feedMediaUrl';

/** The feed preview and full-size media have separate caches and signing requests. */
export function useFeedMediaSrc(raw: string | null | undefined, variant: FeedMediaVariant = 'original'): string | null {
  const [state, setState] = useState(() => ({ raw, variant, url: getCachedFeedMediaUrl(raw, variant) }));
  useEffect(() => {
    let cancelled = false;
    setState({ raw, variant, url: getCachedFeedMediaUrl(raw, variant) });
    void resolveFeedMediaUrl(raw, variant).then(url => {
      if (!cancelled) setState({ raw, variant, url });
    }).catch(() => {
      if (!cancelled) setState({ raw, variant, url: null });
    });
    return () => { cancelled = true; };
  }, [raw, variant]);
  return state.raw === raw && state.variant === variant ? state.url : getCachedFeedMediaUrl(raw, variant);
}
