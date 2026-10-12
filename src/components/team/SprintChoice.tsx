import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
export function SprintChoice({ label, value, options, onChange, disabled = false }: {
 label: string; value: string; options: { value: string; label: string; detail?: string }[];
 onChange: (value: string) => void; disabled?: boolean;
}) {
 const [open, setOpen] = useState(false);
 const [query, setQuery] = useState('');
 const trigger = useRef<HTMLButtonElement>(null);
 const panel = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (!open) return;
  setQuery('');
  panel.current?.querySelector<HTMLInputElement>('input')?.focus();
  return () => { trigger.current?.focus(); };
 }, [open]);
 const selected = options.find(option => option.value === value);
 const filtered = options.filter(option => option.label.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
 return <>
  <div><p className="mb-1 text-xs font-semibold text-white/55">{label}</p>
   <button type="button" ref={trigger} disabled={disabled} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-left text-sm font-semibold text-white disabled:opacity-50">
    <span className="min-w-0 break-words">{selected?.label ?? 'Auswählen'}{selected?.detail ? <span className="mt-0.5 block text-xs font-normal text-white/45">{selected.detail}</span> : null}</span>
    <ChevronDown className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
   </button>
  </div>
  <Modal open={open} onClose={() => setOpen(false)} title={label + ' auswählen'} className="!border-[rgb(var(--club-border-rgb)/0.4)] !bg-[#0d0b0d] !text-white">
   <div ref={panel} onKeyDown={event => {
     if (event.key !== 'Tab') return;
     const controls = panel.current?.querySelectorAll<HTMLElement>('input,button');
     const first = controls?.[0], last = controls?.[controls.length - 1];
     if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
     else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
   }}>
    <input type="search" aria-label={label + ' suchen'} value={query} onChange={event => setQuery(event.target.value)} placeholder="Suchen…"
     className="mb-3 min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white" />
    <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
     {filtered.map(option => <button type="button" key={option.value} aria-pressed={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}
      className={'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold ' + (option.value === value ? 'border-[rgb(var(--club-border-rgb)/0.45)] bg-[rgb(var(--club-primary-rgb)/0.2)] text-white' : 'border-white/10 text-white/80 hover:bg-white/5')}>
      <span className="min-w-0 break-words">{option.label}{option.detail ? <span className="mt-1 block text-xs font-normal text-white/45">{option.detail}</span> : null}</span>
      {option.value === value ? <Check className="sz-club-accent-text h-4 w-4 shrink-0" aria-hidden /> : null}
     </button>)}
     {!filtered.length ? <p className="py-3 text-sm text-white/50">Keine passenden Einträge.</p> : null}
    </div>
   </div>
  </Modal>
 </>;
}
