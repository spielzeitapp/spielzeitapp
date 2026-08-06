import React from 'react';
import { useDemoMode } from '../DemoContext';

/** Dezentes DEMO-Badge für den produktiven Header — keine eigene Designsprache. */
export function DemoBadge(): React.ReactElement | null {
  const demo = useDemoMode();
  if (!demo) return null;
  return (
    <span
      className="shrink-0 rounded border border-[#FF2D2D]/45 bg-[#FF2D2D]/12 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#FF8A8A]"
      title="Demo-Modus – keine echten Daten, keine Speicherung"
    >
      Demo
    </span>
  );
}
