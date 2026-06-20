import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type Props = {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  stickySummary?: React.ReactNode;
};

export function TournamentCollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = false,
  stickySummary,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        {stickySummary ? (
          <div className="sticky top-[2.75rem] z-[2] -mx-0.5 mb-1.5 rounded-lg border border-white/[0.06] bg-[rgba(8,6,10,0.96)] px-2 py-1.5 backdrop-blur-sm">
            {stickySummary}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full min-h-[32px] items-center justify-between gap-2 text-left touch-manipulation"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {icon ? <span className="shrink-0 text-[13px] leading-none">{icon}</span> : null}
            <span className={`${TC_SECTION_LABEL} !text-[10px]`}>{title}</span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
        {expanded ? <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">{children}</div> : null}
      </div>
    </section>
  );
}
