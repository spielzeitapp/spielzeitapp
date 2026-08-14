import React from 'react';
import { DEMO_AI_DISCLOSURE_TEXT } from '../demoPlayers';

/** Sichtbare KI-Kennzeichnung — nur innerhalb von /demo verwenden. */
export function DemoAiDisclosure({ className = '' }: { className?: string }): React.ReactElement {
  return (
    <aside
      role="note"
      aria-label="Hinweis zu KI-generierten Demo-Inhalten"
      className={[
        'rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[12px] leading-snug text-white/70 sm:text-[13px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="font-semibold uppercase tracking-[0.08em] text-white/45 text-[10px] sm:text-[11px]">
        KI-generiert · Demo
      </p>
      <p className="mt-1">{DEMO_AI_DISCLOSURE_TEXT}</p>
    </aside>
  );
}
