import React from 'react';
import { ChevronDown } from 'lucide-react';
import { TC_CARD, TC_CARD_INNER } from './tournamentCenterStyles';

type Props = {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  stickySummary?: React.ReactNode;
  prominent?: boolean;
};

/** Native details keep the preparation controls mounted as the assistant changes steps. */
export function TournamentCollapsibleSection({ title, icon, children, defaultExpanded = false, stickySummary }: Props) {
  return <details className={`${TC_CARD} group/tournament-section`} open={defaultExpanded || undefined}>
    <summary className={`${TC_CARD_INNER} flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-[17px] font-bold text-white [&::-webkit-details-marker]:hidden`}>
      <span className="flex min-w-0 items-center gap-3"><span className="sz-club-accent-text shrink-0 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>{title}</span>
      <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-white/55 transition-transform group-open/tournament-section:rotate-180" />
    </summary>
    <div className={`${TC_CARD_INNER} border-t border-white/[0.08] !pt-4`}>
      {stickySummary}{children}
    </div>
  </details>;
}
