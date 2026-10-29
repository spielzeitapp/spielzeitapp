import React, { useEffect, useState } from 'react';
import { prepareLogoFile, displayLogoUrl } from '../../lib/logoPreparation';

// Share processing across the header, picker and manager; a failed URL stays usable as-is.
const prepared = new Map<string, Promise<string>>();
function preparedSource(src: string): Promise<string> {
  let pending = prepared.get(src);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(displayLogoUrl(src));
        if (!response.ok) return src;
        const blob = await response.blob();
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) || blob.size > 5 * 1024 * 1024) return src;
        const result = await prepareLogoFile(new File([blob], 'club-logo', { type: blob.type }));
        if (!result.changed) return src;
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(result.file);
        });
      } catch { return src; }
    })();
    prepared.set(src, pending);
    if (prepared.size > 60) prepared.delete(prepared.keys().next().value!);
  }
  return pending;
}

/** Conservative white-edge removal, shared by every club; the original crest is retained. */
export function ClubLogo({ src, ...props }: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string }) {
  const [resolved, setResolved] = useState<{ original: string; src: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void preparedSource(src).then(result => { if (!cancelled) setResolved({ original: src, src: result }); });
    return () => { cancelled = true; };
  }, [src]);
  return <img {...props} src={resolved?.original === src ? resolved.src : displayLogoUrl(src)} />;
}
