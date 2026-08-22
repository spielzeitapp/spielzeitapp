import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EC_CARD, EC_CARD_INNER, EC_SECTION_LABEL } from './eventCenterStyles';

type Props = {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  stickySummary?: React.ReactNode;
  /** Größere, app-typische Bereichsüberschrift für das Trainingscenter. */
  prominent?: boolean;
};

export function CenterCollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = false,
  stickySummary,
  prominent = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={EC_CARD}>
      <div className={EC_CARD_INNER}>
        {stickySummary ? (
          <div className="sticky top-[2.75rem] z-[2] -mx-0.5 mb-1.5 rounded-lg border border-white/[0.06] bg-[rgba(8,6,10,0.96)] px-2 py-1.5 backdrop-blur-sm">
            {stickySummary}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`flex w-full items-center justify-between gap-2 text-left touch-manipulation ${prominent ? 'min-h-[46px]' : 'min-h-[32px]'}`}
        >
          <span className={`inline-flex min-w-0 items-center ${prominent ? 'gap-2.5' : 'gap-1.5'}`}>
            {icon ? (
              <span className={prominent ? 'shrink-0 text-red-400 [&>svg]:h-5 [&>svg]:w-5' : 'shrink-0 text-[13px] leading-none'}>
                {icon}
              </span>
            ) : null}
            <span className={prominent ? 'truncate text-[15px] font-bold tracking-tight text-white/90' : `${EC_SECTION_LABEL} !text-[10px]`}>
              {title}
            </span>
          </span>
          <ChevronDown
            className={`${prominent ? 'h-[18px] w-[18px] text-white/55' : 'h-3.5 w-3.5 text-white/40'} shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
        {expanded ? (
          <div className={`${prominent ? 'mt-2 pt-2' : 'mt-1.5 pt-1.5'} border-t border-white/[0.06] transition-opacity duration-200`}>
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
