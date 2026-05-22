/**
 * SpielzeitApp Premium Design System — Referenzbild als Source of Truth.
 * Einheitliche Geometrie, Typografie, Chips; keine weißen Outlines.
 */

export const DS_CARD_RADIUS = 'rounded-[22px]';
export const DS_CARD_PAD = 'px-2.5 py-2';
export const DS_CARD_INNER_GAP = 'gap-2.5';
export const DS_LIST_GAP = 'gap-1.5';
export const DS_SECTION_GAP = 'gap-3';
export const DS_STAT_GRID_GAP = 'gap-1.5';

export const DS_CARD_BG =
  'bg-gradient-to-br from-[#121214] via-[#0a0a0c] to-black';
export const DS_CARD_BORDER = 'border border-transparent';

const CARD_SHADOW =
  'shadow-[0_6px_28px_rgba(0,0,0,0.55),0_0_24px_rgba(224,33,41,0.05),inset_0_1px_0_rgba(255,255,255,0.01)]';
const CARD_SHADOW_ACTIVE =
  'shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_32px_rgba(224,33,41,0.09),inset_0_1px_0_rgba(255,255,255,0.012)]';

export function dsCardShellClass(opts?: {
  active?: boolean;
  interactive?: boolean;
  className?: string;
}): string {
  return [
    'relative w-full overflow-hidden text-left',
    DS_CARD_RADIUS,
    DS_CARD_BORDER,
    DS_CARD_BG,
    opts?.active ? CARD_SHADOW_ACTIVE : CARD_SHADOW,
    DS_CARD_PAD,
    opts?.interactive
      ? 'cursor-pointer transition-[transform,box-shadow] duration-200 active:scale-[0.99] hover:shadow-[0_8px_30px_rgba(0,0,0,0.58),0_0_28px_rgba(224,33,41,0.07)]'
      : '',
    opts?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function dsCardAmbientGlowClass(): string {
  return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_92%_72%_at_6%_0%,rgba(224,33,41,0.08),transparent_60%),radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(122,15,20,0.04),transparent_58%)]';
}

/** Hero-Avatar: 60px (Referenz mobile). */
export const DS_AVATAR_SIZE = 'h-[3.75rem] w-[3.75rem]';

export function dsAvatarRingClass(): string {
  return 'rounded-full border border-[#2a2a2e] object-cover bg-[#0a0a0b] shadow-[0_0_18px_rgba(224,33,41,0.1),0_4px_14px_rgba(0,0,0,0.4)]';
}

export function dsAvatarBloomClass(): string {
  return 'pointer-events-none absolute -inset-0.5 rounded-full bg-[radial-gradient(circle,rgba(224,33,41,0.16)_0%,rgba(122,15,20,0.05)_50%,transparent_72%)] blur-[6px]';
}

export function dsPlayerNameClass(): string {
  return 'line-clamp-2 whitespace-normal break-words text-[15px] font-semibold leading-snug text-white';
}

export function dsPlayerSublineClass(): string {
  return 'mt-0.5 truncate text-[12px] font-normal text-[#b3b3b3]/90';
}

export function dsSectionLabelClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45';
}

export function dsJerseyNumberClass(): string {
  return 'text-[11px] font-medium tabular-nums text-white/28';
}

export function dsJerseyWrapClass(): string {
  return 'pointer-events-none shrink-0 opacity-[0.72] drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]';
}

export const DS_JERSEY_COMPACT = '!h-[2.35rem] !w-[1.85rem]';
export const DS_JERSEY_STARTER = '!h-[2.5rem] !w-[1.95rem]';

export const DS_CARD_FOOTER_DIVIDER = 'border-t border-[#2a2a2e]/80';

/** Status-Chip (Badge / Stat). */
export type DsChipTone =
  | 'present'
  | 'absent'
  | 'injured'
  | 'external'
  | 'open'
  | 'neutral'
  | 'selected';

const CHIP_TONE: Record<DsChipTone, string> = {
  present: 'border-emerald-900/60 bg-emerald-950/50 text-emerald-200/85',
  absent: 'border-red-950/70 bg-red-950/45 text-red-200/80',
  injured: 'border-amber-950/65 bg-amber-950/40 text-amber-100/85',
  external: 'border-violet-950/65 bg-violet-950/45 text-violet-100/85',
  open: 'border-[#2a2a2e] bg-[#121214] text-white/50',
  neutral: 'border-[#2a2a2e] bg-black/50 text-white/42',
  selected: 'border-red-950/65 bg-red-950/40 text-red-100/85',
};

export function dsStatusChipClass(tone: DsChipTone = 'neutral'): string {
  return [
    'inline-flex max-w-[8rem] shrink-0 items-center justify-center rounded-full border',
    'h-[22px] px-2 text-[9px] font-bold uppercase tracking-[0.08em] leading-none',
    CHIP_TONE[tone],
  ].join(' ');
}

export function dsStatChipBoxClass(tone: DsChipTone): string {
  return [
    DS_CARD_RADIUS,
    'border px-2 py-1.5 text-center',
    CHIP_TONE[tone],
  ].join(' ');
}

export function dsActionButtonClass(
  tone: 'absent' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const base =
    'h-8 min-w-0 rounded-[14px] border px-2 text-[10px] font-semibold transition-colors disabled:cursor-default disabled:opacity-50 sm:text-[11px]';
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    absent: {
      idle: 'border-red-950/55 bg-red-950/30 text-red-200/75 hover:bg-red-950/45',
      on: 'border-red-900/50 bg-red-950/55 text-red-100/80',
    },
    injured: {
      idle: 'border-amber-950/55 bg-amber-950/28 text-amber-100/75 hover:bg-amber-950/40',
      on: 'border-amber-900/50 bg-amber-950/50 text-amber-100/85',
    },
    external: {
      idle: 'border-violet-950/55 bg-violet-950/28 text-violet-100/75 hover:bg-violet-950/40',
      on: 'border-violet-900/50 bg-violet-950/50 text-violet-100/85',
    },
    present: {
      idle: 'border-emerald-950/55 bg-emerald-950/28 text-emerald-100/75 hover:bg-emerald-950/40',
      on: 'border-emerald-900/50 bg-emerald-950/50 text-emerald-100/85',
    },
  };
  return [base, active ? tones[tone].on : tones[tone].idle].join(' ');
}

/** Lineup-Listenzeile (Trikot links) — gleiche Card-Sprache. */
export function dsLineupRowClass(opts: { role: 'starter' | 'bench'; selected?: boolean }): string {
  const base = [
    'flex w-full shrink-0 items-center',
    DS_CARD_INNER_GAP,
    DS_CARD_RADIUS,
    DS_CARD_BORDER,
    DS_CARD_PAD,
    'text-left transition-[box-shadow,transform] duration-200 active:scale-[0.99]',
  ].join(' ');

  if (opts.role === 'starter') {
    return [base, DS_CARD_BG, CARD_SHADOW_ACTIVE].join(' ');
  }
  if (opts.selected) {
    return [
      base,
      'bg-gradient-to-r from-emerald-950/22 via-[#0a0a0c] to-black',
      'shadow-[0_6px_24px_rgba(0,0,0,0.52),0_0_22px_rgba(25,195,125,0.07)]',
    ].join(' ');
  }
  return [base, DS_CARD_BG, CARD_SHADOW].join(' ');
}

export function dsLineupPositionPillClass(role: 'starter' | 'bench'): string {
  if (role === 'starter') {
    return 'inline-flex h-[20px] items-center rounded-md border border-red-950/70 bg-red-950/50 px-1.5 text-[9px] font-bold uppercase tracking-wide text-red-200/75';
  }
  return 'inline-flex h-[20px] items-center rounded-md border border-[#2a2a2e] bg-[#121214] px-1.5 text-[9px] font-bold uppercase tracking-wide text-white/45';
}

export function dsBenchTileClass(selected?: boolean): string {
  return [
    'flex min-h-[6.25rem] w-[6.1rem] shrink-0 flex-col items-center',
    'rounded-[18px] border border-transparent px-1.5 py-1.5 transition-[box-shadow,transform] duration-200 active:scale-[0.99] sm:w-[6.4rem]',
    DS_CARD_BG,
    selected
      ? 'shadow-[0_6px_22px_rgba(0,0,0,0.5),0_0_20px_rgba(25,195,125,0.08)]'
      : CARD_SHADOW,
  ].join(' ');
}

export function dsFormationTabClass(active: boolean): string {
  return [
    'h-8 shrink-0 rounded-[14px] border px-2.5 text-[11px] font-semibold leading-none transition-colors',
    active
      ? 'border-red-950/60 bg-red-950/45 text-white/90'
      : 'border-transparent bg-[#121214] text-white/45 hover:bg-[#1a1a1e]',
  ].join(' ');
}

export function dsStickyCtaBarClass(): string {
  return 'fixed inset-x-0 z-[70] border-t border-[#2a2a2e]/60 bg-black/75 px-4 py-2.5 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl';
}

export function dsPrimaryCtaClass(): string {
  return 'rounded-[18px] border border-red-950/50 bg-[#e02129]/90 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(224,33,41,0.2)] transition-opacity hover:bg-[#e02129] disabled:cursor-not-allowed disabled:opacity-40';
}
