/** Matchday-only UI-Helfer (Startaufstellung / Live / Lineup-Listen). */

export function matchdayLineupListRowClass(opts: {
  role: 'starter' | 'bench';
  selected?: boolean;
}): string {
  const base =
    'flex w-full shrink-0 items-center gap-2 rounded-[20px] px-2 py-1.5 text-left transition-all active:scale-[0.99]';

  if (opts.role === 'starter') {
    return [
      base,
      'border border-red-500/18 bg-gradient-to-r from-[#141416]/98 via-black/85 to-black',
      'shadow-[0_4px_22px_rgba(0,0,0,0.45),0_0_24px_rgba(224,33,41,0.08)]',
      'hover:border-red-500/28',
    ].join(' ');
  }

  if (opts.selected) {
    return [
      base,
      'border border-emerald-500/32 bg-gradient-to-r from-emerald-950/30 via-black/80 to-black',
      'shadow-[0_4px_20px_rgba(0,0,0,0.42),0_0_20px_rgba(25,195,125,0.08)] ring-1 ring-emerald-400/30',
    ].join(' ');
  }

  return [
    base,
    'border border-white/[0.1] bg-gradient-to-r from-[#121214]/95 via-black/80 to-black',
    'shadow-[0_4px_18px_rgba(0,0,0,0.4)] hover:border-white/16',
  ].join(' ');
}

export function matchdayLineupPositionBadgeClass(role: 'starter' | 'bench'): string {
  if (role === 'starter') {
    return 'inline-flex w-fit rounded-md border border-red-500/28 bg-red-950/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-100/95';
  }
  return 'inline-flex w-fit rounded-md border border-white/14 bg-zinc-800/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-200/90';
}

export function matchdayBenchTileClass(selected?: boolean): string {
  return [
    'flex min-h-[6.5rem] w-[6.25rem] shrink-0 flex-col items-center rounded-xl border px-1.5 py-1.5 transition-all active:scale-[0.99] sm:w-[6.5rem] sm:min-h-[6.75rem]',
    selected
      ? 'border-emerald-500/45 bg-gradient-to-b from-emerald-950/35 to-black shadow-[0_0_24px_rgba(25,195,125,0.12)] ring-1 ring-emerald-400/35'
      : 'border-white/[0.1] bg-gradient-to-b from-[#121214] to-black shadow-[0_4px_20px_rgba(0,0,0,0.4),0_0_18px_rgba(224,33,41,0.05)] hover:border-white/18',
  ].join(' ');
}

export function matchdayJerseyGlowWrapClass(): string {
  return 'pointer-events-none shrink-0 drop-shadow-[0_4px_14px_rgba(224,33,41,0.18)]';
}
