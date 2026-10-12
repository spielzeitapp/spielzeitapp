import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Timer } from 'lucide-react';
import { PremiumCard } from '../../ui';
import { dsPanelRowClass } from '../../lib/premiumDesignSystem';
export function SprintChallengeCard({ eventId, disabled = false }: { eventId?: string; disabled?: boolean }) {
  return <PremiumCard variant="subtle" showAmbientGlow={false} className="w-full sm:p-4">
    <div className="flex items-center gap-2"><Timer className="sz-club-accent-text h-5 w-5" aria-hidden /><h3 className="text-lg font-bold text-white">Sprint-Challenge</h3></div>
    <p className="mt-2 text-sm text-white/60">Torlinie → 16er · 16,5 m<br />3 Versuche · beste Zeit zählt</p>
    {disabled ? <p className="mt-3 text-xs text-white/50">In der Demo und im Archiv nicht bearbeitbar.</p> : <Link to={'/app/team/sprint-challenge' + (eventId ? '?event=' + encodeURIComponent(eventId) : '')} className={dsPanelRowClass() + ' mt-3 flex min-h-11 items-center justify-between gap-3'}>
      <span className="text-sm font-semibold text-white">Sprint-Challenge öffnen</span><ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
    </Link>}
  </PremiumCard>;
}
