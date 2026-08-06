import React from 'react';

/** Dezentes DEMO-Badge — gleiche Chip-Größe wie Staging-TEST, keine Header-Höhenänderung. */
export function DemoBadge(): React.ReactElement {
  return (
    <span
      className="shrink-0 rounded border border-[#FF2D2D]/40 bg-[#FF2D2D]/12 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#FF8A8A]"
      title="Demo-Modus – keine echten Daten"
    >
      Demo
    </span>
  );
}
