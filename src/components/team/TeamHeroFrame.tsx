import React from 'react';

/** Shared by the team page and editor, including the crop and lower caption. */
export function TeamHeroFrame({ photoSrc, photoStyle, className = '', children, onPhotoLoad, onPhotoError }: {
  photoSrc?: string | null;
  photoStyle?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
}) {
  return <div data-app-artwork className={`${className} relative w-full overflow-hidden`}>
    <div data-team-hero-photo className="relative aspect-[16/10] w-full overflow-hidden">
      {photoSrc ? <img key={photoSrc} src={photoSrc} style={photoStyle} alt="Mannschaftsfoto" draggable={false} onLoad={onPhotoLoad} onError={onPhotoError} className="absolute inset-0 h-full w-full select-none object-cover" /> : <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(var(--club-primary-rgb)/0.65),#09090b)]" aria-hidden />}
    </div>
    <div data-team-hero-details className="absolute inset-0 z-10 flex flex-col justify-end bg-[linear-gradient(180deg,transparent_42%,rgba(3,4,7,0.12)_58%,rgba(3,4,7,0.8)_100%)] px-4 pb-3 pt-6 sm:px-5 sm:pb-4">{children}</div>
  </div>;
}

/** Render at the page's real width, then scale the entire frame into the editor. */
export function TeamHeroEditorPreview({ referenceWidth, children, ...photo }: {
  referenceWidth: number;
  children: React.ReactNode;
  photoSrc?: string | null;
  photoStyle?: React.CSSProperties;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const natural = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: referenceWidth, height: referenceWidth * 10 / 16 });
  React.useLayoutEffect(() => {
    const outer = container.current, inner = natural.current;
    if (!outer || !inner) return;
    outer.inert = true;
    const measure = () => setSize({ width: outer.clientWidth || referenceWidth, height: inner.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer); observer.observe(inner);
    return () => observer.disconnect();
  }, [referenceWidth]);
  const width = Math.max(1, referenceWidth);
  const scale = Math.min(1, size.width / width);
  return <div ref={container} data-team-hero-preview className="pointer-events-none relative w-full overflow-hidden" style={{ height: size.height * scale }}>
    <div ref={natural} className="absolute left-0 top-0 origin-top-left" style={{ width, transform: `scale(${scale})` }}>
      <TeamHeroFrame {...photo}>{children}</TeamHeroFrame>
    </div>
  </div>;
}
