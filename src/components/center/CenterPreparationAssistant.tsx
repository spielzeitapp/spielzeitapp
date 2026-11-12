import React from 'react';
import { Check, ChevronRight, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TC_CARD, TC_CARD_INNER } from '../tournament/tournamentCenterStyles';

export type PreparationStep = {
  id: string; title: string; detail: string; done: boolean; optional?: boolean;
  onClick?: () => void; to?: string; disabled?: boolean;
};

export function CenterPreparationAssistant({ title, readyLabel, steps, loading = false, error }: {
  title: string; readyLabel: string; steps: PreparationStep[]; loading?: boolean; error?: string | null;
}) {
  const required = steps.filter(step => !step.optional);
  const completed = required.filter(step => step.done && !step.disabled).length;
  const ready = !loading && !error && required.length > 0 && completed === required.length;
  return <section className={TC_CARD} aria-label={title}>
    <div className={TC_CARD_INNER}>
      <h2 className="sz-club-accent-text flex items-center gap-2 text-[16px] font-extrabold uppercase tracking-[0.08em]"><ClipboardList className="h-5 w-5 shrink-0" aria-hidden />{title}</h2>
      <p className={`mt-4 text-[16px] font-semibold ${ready ? 'text-emerald-300' : 'text-white/65'}`} role="status">{loading ? 'Vorbereitung wird geladen…' : ready ? `${readyLabel} ✓` : `${completed} von ${required.length} Vorbereitungspunkten erledigt`}</p>
      <div className="mt-2 flex gap-1.5" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={loading || error ? 0 : completed}>
        {required.map(step => <span key={step.id} className={`h-2 flex-1 rounded-full ${!loading && !error && step.done && !step.disabled ? 'bg-emerald-400' : 'bg-white/15'}`} />)}
      </div>
      {error ? <p role="alert" className="mt-3 text-[15px] text-red-200">{error}</p> : null}
      <div className="mt-4 space-y-2">
        {steps.map((step, index) => {
          const content = <><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] font-bold ${step.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/10 sz-club-accent-text'}`}>{step.done ? <Check className="h-5 w-5" aria-hidden /> : step.optional ? <ClipboardList className="h-4 w-4" aria-hidden /> : index + 1}</span><span className="min-w-0 flex-1"><span className="block text-[18px] font-bold leading-snug text-white">{step.title}</span><span className="mt-1 block text-[15px] leading-snug text-white/60">{step.detail}{step.optional ? ' · Optional' : ''}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-white/45" aria-hidden /></>;
          const className = 'sz-club-event-action flex min-h-[76px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50';
          return step.to && !step.disabled ? <Link key={step.id} to={step.to} className={className}>{content}</Link> : <button key={step.id} type="button" className={className} disabled={step.disabled} onClick={step.onClick} aria-haspopup="dialog">{content}</button>;
        })}
      </div>
    </div>
  </section>;
}
