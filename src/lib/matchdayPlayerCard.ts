/** Matchday-only UI-Helfer (Startaufstellung / Live / Lineup-Listen). */

const MATCHDAY_ROW_SHADOW =
  'shadow-[0_6px_24px_rgba(0,0,0,0.52),0_0_28px_rgba(224,33,41,0.06),inset_0_1px_0_rgba(255,255,255,0.012)]';
const MATCHDAY_ROW_SHADOW_STARTER =
  'shadow-[0_6px_26px_rgba(0,0,0,0.55),0_0_32px_rgba(224,33,41,0.1),inset_0_1px_0_rgba(255,255,255,0.015)]';
const MATCHDAY_ROW_SHADOW_SELECTED =
  'shadow-[0_6px_24px_rgba(0,0,0,0.5),0_0_26px_rgba(25,195,125,0.09),inset_0_1px_0_rgba(255,255,255,0.012)]';

export function matchdayLineupListRowClass(opts: {
  role: 'starter' | 'bench';
  selected?: boolean;
}): string {
  const base =
    'flex w-full shrink-0 items-center gap-2.5 rounded-[20px] border border-transparent px-2 py-1.5 text-left transition-[box-shadow,transform] duration-200 active:scale-[0.99]';

  if (opts.role === 'starter') {
    return [
      base,
      'bg-gradient-to-r from-[#101012]/98 via-[#08080a]/95 to-black',
      MATCHDAY_ROW_SHADOW_STARTER,
      'hover:shadow-[0_8px_28px_rgba(0,0,0,0.58),0_0_34px_rgba(224,33,41,0.12)]',
    ].join(' ');
  }

  if (opts.selected) {
    return [
      base,
      'bg-gradient-to-r from-emerald-950/25 via-[#08080a]/95 to-black',
      MATCHDAY_ROW_SHADOW_SELECTED,
    ].join(' ');
  }

  return [
    base,
    'bg-gradient-to-r from-[#0e0e10]/98 via-black/90 to-black',
    MATCHDAY_ROW_SHADOW,
    'hover:shadow-[0_8px_26px_rgba(0,0,0,0.55),0_0_30px_rgba(224,33,41,0.08)]',
  ].join(' ');
}

export function matchdayLineupPositionBadgeClass(role: 'starter' | 'bench'): string {
  if (role === 'starter') {
    return 'inline-flex w-fit rounded-md border border-red-950/70 bg-red-950/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-200/80';
  }
  return 'inline-flex w-fit rounded-md border border-zinc-800/80 bg-zinc-900/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-300/75';
}

export function matchdayBenchTileClass(selected?: boolean): string {
  return [
    'flex min-h-[6.5rem] w-[6.25rem] shrink-0 flex-col items-center rounded-xl border border-transparent px-1.5 py-1.5 transition-[box-shadow,transform] duration-200 active:scale-[0.99] sm:w-[6.5rem] sm:min-h-[6.75rem]',
    selected
      ? 'bg-gradient-to-b from-emerald-950/30 to-black shadow-[0_6px_22px_rgba(0,0,0,0.5),0_0_22px_rgba(25,195,125,0.1)]'
      : 'bg-gradient-to-b from-[#101012] to-black shadow-[0_6px_20px_rgba(0,0,0,0.48),0_0_20px_rgba(224,33,41,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.52),0_0_24px_rgba(224,33,41,0.07)]',
  ].join(' ');
}

/** Trikot dezent — weniger Glow als Avatar. */
export function matchdayJerseyWrapClass(): string {
  return 'pointer-events-none shrink-0 opacity-[0.88] drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]';
}
