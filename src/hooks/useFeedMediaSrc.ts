import { useEffect, useState } from 'react';
import { getCachedFeedMediaUrl, resolveFeedMediaUrl } from '../lib/feedMediaUrl';

/** Für img/video src: signierte URL bei Bucket-Pfad, sonst direkter https-String. */
export function useFeedMediaSrc(raw: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => getCachedFeedMediaUrl(raw));

  useEffect(() => {
    let cancelled = false;
    setUrl(getCachedFeedMediaUrl(raw));
    void (async () => {
      const resolved = await resolveFeedMediaUrl(raw ?? null);
      if (!cancelled) setUrl(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [raw]);

  return url;
}
