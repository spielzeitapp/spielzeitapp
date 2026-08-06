import React from 'react';

/**
 * Dezentes DEMO-Badge — gleiche Chip-Größe wie Staging-TEST,
 * neutrale Glasfarben (keine neue Designfarbe), keine Header-Höhenänderung.
 */
export function DemoBadge(): React.ReactElement {
  return (
    <span
      className="shrink-0 rounded border border-white/20 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/70"
      title="Demo-Modus – keine echten Daten"
    >
      Demo
    </span>
  );
}
