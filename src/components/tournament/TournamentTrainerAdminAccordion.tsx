import React from 'react';
import { Settings2 } from 'lucide-react';
import { TournamentCollapsibleSection } from './TournamentCollapsibleSection';

export function TournamentTrainerAdminAccordion({ children, defaultExpanded = false }: { children: React.ReactNode; defaultExpanded?: boolean }) {
  return <TournamentCollapsibleSection title="Trainer & Verwaltung" icon={<Settings2 />} defaultExpanded={defaultExpanded}>
    <div className="space-y-3">{children}</div>
  </TournamentCollapsibleSection>;
}
export function TournamentTrainerAdminSection({ title, children, defaultExpanded = false }: { title: string; children: React.ReactNode; defaultExpanded?: boolean }) {
  return <details open={defaultExpanded || undefined} className="group/admin rounded-2xl border sz-club-surface">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[16px] font-semibold text-white/90 [&::-webkit-details-marker]:hidden">{title}<span aria-hidden className="sz-club-accent-text group-open/admin:rotate-180">⌄</span></summary>
    <div className="border-t border-white/[0.08] p-4">{children}</div>
  </details>;
}
