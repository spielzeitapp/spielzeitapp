import React from 'react';
import { FlaskConical } from 'lucide-react';
import { isStagingApp } from '../lib/appEnvironment';

/** Keep Test unmistakable without changing the Live layout. */
export function TestEnvironmentNotice(): React.ReactElement | null {
  if (!isStagingApp()) return null;
  return (
    <div className="flex min-h-7 items-center justify-center gap-2 border-b border-amber-400/30 bg-amber-300 px-3 py-1 text-center text-[11px] font-semibold leading-4 text-amber-950 sm:text-xs">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span><strong className="font-black tracking-wide">TESTAPP</strong> · nicht die Live-App</span>
    </div>
  );
}
