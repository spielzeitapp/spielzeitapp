import React, { useEffect, useState } from 'react';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';

type Props = {
  mediaUrl: string | null | undefined;
  alt: string;
};

export const AutoFeedPostCustomImage: React.FC<Props> = ({ mediaUrl, alt }) => {
  const src = useFeedMediaSrc(mediaUrl);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setAspectRatio(null);
  }, [mediaUrl]);

  return (
    <div
      className="sz-club-feed-media-frame relative max-h-[min(78vh,720px)] w-full overflow-hidden rounded-none border-y bg-black sm:rounded-2xl sm:border"
      style={{ aspectRatio: aspectRatio ?? 4 / 5 }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className={`h-full w-full object-contain transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setAspectRatio(image.naturalWidth / image.naturalHeight);
            }
            setLoaded(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : null}
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(160deg,rgba(42,12,17,0.55),rgba(0,0,0,0.96))] text-xs font-medium text-white/45">
          {failed ? 'Bild konnte nicht geladen werden.' : 'Bild wird geladen…'}
        </div>
      ) : null}
    </div>
  );
};
