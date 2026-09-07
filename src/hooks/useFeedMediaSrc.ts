import { useEffect, useState } from 'react';
import { resolveFeedMediaUrl } from '../lib/feedMediaUrl';

/** Für img/video src: signierte URL bei Bucket-Pfad, sonst direkter https-String. */
export function useFeedMediaSrc(raw: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
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
