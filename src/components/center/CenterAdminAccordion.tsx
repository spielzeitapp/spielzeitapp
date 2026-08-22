import React, { useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { EC_CARD, EC_CARD_INNER, EC_SECTION_LABEL } from './eventCenterStyles';

type Props = {
  children: React.ReactNode;
  defaultExpanded?: boolean;
  prominent?: boolean;
};

export function CenterAdminAccordion({ children, defaultExpanded = false, prominent = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={EC_CARD}>
      <div className={EC_CARD_INNER}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={prominent
            ? 'flex min-h-[46px] w-full items-center justify-between gap-3 text-left touch-manipulation'
            : 'flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-left touch-manipulation transition hover:bg-white/[0.05] active:bg-white/[0.04]'}
        >
          <span className={`inline-flex min-w-0 items-center ${prominent ? 'gap-2.5' : 'gap-1.5'}`}>
            <Settings2 className={`${prominent ? 'h-5 w-5' : 'h-3.5 w-3.5'} shrink-0 text-red-400/80`} strokeWidth={2.25} aria-hidden />
            <span className={prominent ? 'text-[15px] font-bold tracking-tight text-white/90' : 'text-[12px] font-semibold text-white/88'}>Trainer &amp; Verwaltung</span>
          </span>
          <ChevronDown
            className={`${prominent ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5'} shrink-0 text-white/45 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
        {expanded ? (
          <div className="mt-1.5 flex flex-col gap-1.5 border-t border-white/[0.06] pt-1.5">{children}</div>
        ) : prominent ? null : (
          <p className="mt-1 text-[10px] leading-snug text-white/38">Verwaltung und erweiterte Einstellungen</p>
        )}
      </div>
    </section>
  );
}

export function CenterAdminSection({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.05] bg-white/[0.015]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full min-h-[32px] items-center justify-between gap-2 px-2.5 py-1.5 text-left touch-manipulation hover:bg-white/[0.03]"
      >
        <span className={EC_SECTION_LABEL}>{title}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          strokeWidth={2.25}
          aria-hidden
        />
      </button>
      {expanded ? <div className="border-t border-white/[0.05] px-2 pb-2 pt-1.5">{children}</div> : null}
    </div>
  );
}
