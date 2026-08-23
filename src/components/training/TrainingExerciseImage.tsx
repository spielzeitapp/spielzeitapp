import React, { useEffect, useState } from 'react';
import { getTrainingExerciseSketchUrl } from '../../lib/trainingExercises';

export type TrainingExerciseImageVariant = 'library' | 'session-card' | 'detail';

type Props = {
  path: string | null;
  title: string;
  variant?: TrainingExerciseImageVariant;
  /** Optional pre-resolved URL (avoids duplicate fetches in lists). */
  url?: string | null;
  /** @deprecated Use variant="detail" instead. */
  large?: boolean;
  /** @deprecated Use variant="session-card" instead. */
  compact?: boolean;
};

function resolveVariant({
  variant,
  large,
  compact,
}: Pick<Props, 'variant' | 'large' | 'compact'>): TrainingExerciseImageVariant {
  if (variant) return variant;
  if (large) return 'detail';
  if (compact) return 'session-card';
  return 'library';
}

const VARIANT_STYLES: Record<
  TrainingExerciseImageVariant,
  { frame: string; image: string; fallback: string }
> = {
  library: {
    frame:
      'flex h-36 w-full items-center justify-center rounded-xl border border-slate-100 bg-slate-50 sm:h-40',
    image: 'h-full w-full rounded-xl border border-slate-100 bg-white object-contain',
    fallback:
      'bg-gradient-to-br from-slate-100 to-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-400',
  },
  'session-card': {
    frame:
      'flex w-full aspect-video min-h-[210px] max-h-[240px] items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white md:aspect-auto md:min-h-[200px] md:max-h-[220px] md:min-w-[280px] md:max-w-[340px]',
    image: 'max-h-full max-w-full object-contain p-2',
    fallback:
      'bg-gradient-to-br from-slate-50 to-slate-100 text-[12px] font-semibold uppercase tracking-wide text-slate-400',
  },
  detail: {
    frame:
      'flex min-h-[220px] w-full items-center justify-center rounded-xl border border-slate-100 bg-slate-50 sm:min-h-[280px]',
    image: 'max-h-[320px] w-full rounded-xl border border-slate-100 bg-white object-contain',
    fallback:
      'bg-gradient-to-br from-slate-100 to-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-400',
  },
};

export function TrainingExerciseImage({
  path,
  title,
  variant: variantProp,
  url: urlProp,
  large = false,
  compact = false,
}: Props): React.ReactElement {
  const variant = resolveVariant({ variant: variantProp, large, compact });
  const styles = VARIANT_STYLES[variant];
  const [url, setUrl] = useState<string | null>(urlProp ?? null);
  const [loading, setLoading] = useState(Boolean(path) && urlProp === undefined);

  useEffect(() => {
    if (urlProp !== undefined) {
      setUrl(urlProp);
      setLoading(false);
      return;
    }
    let active = true;
    setUrl(null);
    setLoading(Boolean(path));
    if (path) {
      void getTrainingExerciseSketchUrl(path).then((nextUrl) => {
        if (!active) return;
        setUrl(nextUrl);
        setLoading(false);
      });
    }
    return () => {
      active = false;
    };
  }, [path, urlProp]);

  if (loading) {
    return <div className={`${styles.frame} text-[12px] text-slate-400`}>Skizze wird geladen…</div>;
  }

  if (url) {
    return (
      <div className={styles.frame}>
        <img src={url} alt={`Skizze: ${title}`} className={styles.image} />
      </div>
    );
  }

  return <div className={`${styles.frame} ${styles.fallback}`}>Keine Skizze</div>;
}
