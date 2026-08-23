import React, { useEffect, useState } from 'react';
import { getTrainingExerciseSketchUrl } from '../../lib/trainingExercises';

type Props = {
  path: string | null;
  title: string;
  large?: boolean;
  /** Optional pre-resolved URL (avoids duplicate fetches in lists). */
  url?: string | null;
  compact?: boolean;
};

export function TrainingExerciseImage({
  path,
  title,
  large = false,
  url: urlProp,
  compact = false,
}: Props): React.ReactElement {
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

  const boxClass = compact
    ? 'flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 sm:h-28 sm:w-28'
    : large
      ? 'flex min-h-[220px] w-full items-center justify-center rounded-xl border border-slate-100 bg-slate-50 sm:min-h-[280px]'
      : 'flex h-36 w-full items-center justify-center rounded-xl border border-slate-100 bg-slate-50 sm:h-40';

  if (loading) {
    return <div className={`${boxClass} text-[12px] text-slate-400`}>Skizze wird geladen…</div>;
  }

  if (url) {
    return (
      <img
        src={url}
        alt={`Skizze: ${title}`}
        className={
          compact
            ? 'h-24 w-24 rounded-xl border border-slate-100 bg-white object-contain sm:h-28 sm:w-28'
            : large
              ? 'max-h-[320px] w-full rounded-xl border border-slate-100 bg-white object-contain'
              : 'h-36 w-full rounded-xl border border-slate-100 bg-white object-contain sm:h-40'
        }
      />
    );
  }

  return (
    <div
      className={`${boxClass} bg-gradient-to-br from-slate-100 to-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-400`}
    >
      Keine Skizze
    </div>
  );
}
