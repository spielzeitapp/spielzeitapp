import React, { useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type Props = {
  children: React.ReactNode;
  defaultExpanded?: boolean;
};

export function TournamentTrainerAdminAccordion({
  children,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full min-h-[40px] items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left touch-manipulation transition hover:bg-white/[0.05] active:bg-white/[0.04]"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 shrink-0 text-red-400/80" strokeWidth={2.25} aria-hidden />
            <span className="text-[13px] font-semibold text-white/90">Trainer &amp; Verwaltung</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/45 transition-transform ${expanded ? 'rotate-180' : ''}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>

        {expanded ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2">{children}</div>
        ) : (
          <p className="mt-1.5 text-[11px] leading-snug text-white/40">
            Zu-/Absagen, Turnierplan, Aliase und Feed
          </p>
        )}
      </div>
    </section>
  );
}

export function TournamentTrainerAdminSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className={TC_SECTION_LABEL}>{title}</p>
      {children}
    </div>
  );
}
