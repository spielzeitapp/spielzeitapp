/**
 * SpielzeitApp — Cinematic Stadium UI (Welcome / Zielbild).
 * Tiefe via Glow & Ambient Light — keine weißen Outlines.
 */

export const DS_APP_BG = '#090909';

export const DS_CARD_RADIUS = 'rounded-[22px]';
export const DS_CARD_PAD = 'px-2.5 py-2';
export const DS_CARD_INNER_GAP = 'gap-2.5';
export const DS_LIST_GAP = 'gap-1.5';
export const DS_SECTION_GAP = 'gap-3';
export const DS_STAT_GRID_GAP = 'gap-1.5';

/** cardSurface — beleuchtete Matchday-Card im Stadion. */
export const DS_CARD_BG =
  'bg-[linear-gradient(180deg,rgba(34,12,16,0.96)_0%,rgba(12,12,14,0.98)_100%)]';
export const DS_CARD_BG_MATCHDAY =
  'bg-[linear-gradient(180deg,rgba(42,14,18,0.97)_0%,rgba(14,10,12,0.98)_100%)]';
export const DS_CARD_BORDER = 'border border-transparent';

const CARD_SHADOW =
  'shadow-[0_0_40px_rgba(255,40,40,0.12),0_8px_28px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.03)]';
const CARD_SHADOW_ACTIVE =
  'shadow-[0_0_44px_rgba(255,40,40,0.16),0_10px_32px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.03)]';

export function dsCardShellClass(opts?: {
  active?: boolean;
  interactive?: boolean;
  matchday?: boolean;
  className?: string;
}): string {
  return [
    'relative w-full overflow-hidden text-left',
    DS_CARD_RADIUS,
    DS_CARD_BORDER,
    opts?.matchday ? DS_CARD_BG_MATCHDAY : DS_CARD_BG,
    opts?.active ? CARD_SHADOW_ACTIVE : CARD_SHADOW,
    DS_CARD_PAD,
    opts?.interactive
      ? 'cursor-pointer transition-[transform,box-shadow] duration-200 active:scale-[0.99] hover:shadow-[0_0_44px_rgba(255,40,40,0.14),0_10px_32px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.035)]'
      : '',
    opts?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function dsCardAmbientGlowClass(matchday?: boolean): string {
  if (matchday) {
    return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_10%_0%,rgba(255,40,40,0.14),transparent_55%),linear-gradient(180deg,rgba(255,60,60,0.04)_0%,transparent_32%)]';
  }
  return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_70%_at_8%_0%,rgba(255,40,40,0.1),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_26%)]';
}

export const DS_AVATAR_SIZE = 'h-[3.75rem] w-[3.75rem]';

export function dsAvatarRingClass(): string {
  return 'rounded-full border border-[rgba(80,24,28,0.55)] object-cover bg-[rgba(18,10,12,0.95)] shadow-[0_0_22px_rgba(255,40,40,0.14),0_4px_14px_rgba(0,0,0,0.35)]';
}

export function dsAvatarBloomClass(): string {
  return 'pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle,rgba(255,40,40,0.22)_0%,rgba(120,18,28,0.08)_45%,transparent_72%)] blur-[8px]';
}

export function dsPlayerNameClass(): string {
  return 'line-clamp-2 whitespace-normal break-words text-[15px] font-semibold leading-snug text-white';
}

export function dsPlayerSublineClass(): string {
  return 'mt-0.5 truncate text-[12px] font-normal text-[#b3b3b3]';
}

export function dsSectionLabelClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50';
}

export function dsJerseyNumberClass(): string {
  return 'text-[11px] font-medium tabular-nums text-white/40';
}

/** Trikot +10–12 %, 90 % Opacity, Stadium-Glow. */
export function dsJerseyWrapClass(): string {
  return 'pointer-events-none shrink-0 opacity-90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.38),0_0_16px_rgba(255,40,40,0.1)]';
}

export const DS_JERSEY_COMPACT = '!h-[2.92rem] !w-[2.29rem]';
export const DS_JERSEY_STARTER = '!h-[3.08rem] !w-[2.42rem]';

export const DS_CARD_FOOTER_DIVIDER = 'border-t border-[rgba(80,24,28,0.35)]';

export type DsChipTone =
  | 'present'
  | 'absent'
  | 'injured'
  | 'external'
  | 'open'
  | 'neutral'
  | 'selected';

const CHIP_BASE =
  'inline-flex max-w-[9rem] shrink-0 items-center justify-center rounded-full border border-transparent';

const CHIP_TONE: Record<DsChipTone, string> = {
  present:
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none bg-[rgba(20,110,70,0.30)] text-[#8DFFB7] shadow-[0_0_18px_rgba(40,255,120,0.10)]',
  external:
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none bg-[rgba(16,70,48,0.24)] text-[#63D98D]',
  absent:
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none bg-[rgba(120,18,28,0.32)] text-[#FF8D98]',
  injured:
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none bg-[rgba(120,60,10,0.30)] text-[#FFB15A]',
  open:
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none bg-[rgba(18,18,22,0.75)] text-[#8E8E93]',
  neutral:
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none bg-[rgba(18,18,22,0.65)] text-white/45',
  selected:
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none bg-[rgba(120,18,28,0.36)] text-[#FF8D98] shadow-[0_0_14px_rgba(255,40,40,0.08)]',
};

export function dsStatusChipClass(tone: DsChipTone = 'neutral'): string {
  return [CHIP_BASE, CHIP_TONE[tone]].join(' ');
}

export function dsStatChipBoxClass(tone: DsChipTone): string {
  return [DS_CARD_RADIUS, 'border border-transparent px-2.5 py-1.5 text-center', CARD_SHADOW, CHIP_TONE[tone]].join(
    ' ',
  );
}

const ACTION_BASE =
  'h-8 min-w-0 rounded-[14px] border border-transparent px-2 text-[10px] font-semibold transition-[background,box-shadow] duration-150 disabled:cursor-default disabled:opacity-50 sm:text-[11px]';

export function dsActionButtonClass(
  tone: 'absent' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    present: {
      idle: 'bg-[rgba(20,110,70,0.22)] text-[#8DFFB7] hover:bg-[rgba(20,110,70,0.30)]',
      on: 'bg-[rgba(20,110,70,0.30)] text-[#8DFFB7] shadow-[0_0_18px_rgba(40,255,120,0.10)]',
    },
    external: {
      idle: 'bg-[rgba(16,70,48,0.18)] text-[#63D98D] hover:bg-[rgba(16,70,48,0.24)]',
      on: 'bg-[rgba(16,70,48,0.24)] text-[#63D98D]',
    },
    absent: {
      idle: 'bg-[rgba(120,18,28,0.22)] text-[#FF8D98] hover:bg-[rgba(120,18,28,0.30)]',
      on: 'bg-[rgba(120,18,28,0.32)] text-[#FF8D98] shadow-[0_0_14px_rgba(255,40,40,0.08)]',
    },
    injured: {
      idle: 'bg-[rgba(120,60,10,0.22)] text-[#FFB15A] hover:bg-[rgba(120,60,10,0.28)]',
      on: 'bg-[rgba(120,60,10,0.30)] text-[#FFB15A]',
    },
  };
  return [ACTION_BASE, active ? tones[tone].on : tones[tone].idle].join(' ');
}

export function dsRsvpChoiceClass(kind: 'yes' | 'no', active: boolean): string {
  const base =
    'inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-transparent font-semibold text-sm transition-[background,box-shadow,transform] duration-150 active:scale-[0.98] disabled:opacity-50';
  if (kind === 'yes') {
    return [
      base,
      active
        ? 'bg-[rgba(20,110,70,0.30)] text-[#8DFFB7] shadow-[0_0_18px_rgba(40,255,120,0.10)]'
        : 'bg-[rgba(18,18,22,0.88)] text-[#F2F2F2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)] hover:bg-[rgba(24,14,16,0.92)]',
    ].join(' ');
  }
  return [
    base,
    active
      ? 'bg-[rgba(120,18,28,0.32)] text-[#FF8D98] shadow-[0_0_18px_rgba(255,40,40,0.12)]'
      : 'bg-[rgba(18,18,22,0.88)] text-[#F2F2F2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)] hover:bg-[rgba(24,14,16,0.92)]',
  ].join(' ');
}

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
    return [base, DS_CARD_BG_MATCHDAY, CARD_SHADOW_ACTIVE].join(' ');
  }
  if (opts.selected) {
    return [
      base,
      'bg-[linear-gradient(180deg,rgba(20,90,55,0.28)_0%,rgba(12,12,14,0.98)_100%)]',
      'shadow-[0_0_32px_rgba(40,255,120,0.08),0_8px_28px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.03)]',
    ].join(' ');
  }
  return [base, DS_CARD_BG_MATCHDAY, CARD_SHADOW].join(' ');
}

export function dsLineupPositionPillClass(role: 'starter' | 'bench'): string {
  if (role === 'starter') {
    return 'inline-flex h-[20px] items-center rounded-md border border-transparent bg-[rgba(120,18,28,0.28)] px-1.5 text-[9px] font-bold uppercase tracking-wide text-[#FF8D98]';
  }
  return 'inline-flex h-[20px] items-center rounded-md border border-transparent bg-[rgba(18,18,22,0.75)] px-1.5 text-[9px] font-bold uppercase tracking-wide text-[#8E8E93]';
}

export function dsBenchTileClass(selected?: boolean): string {
  return [
    'flex min-h-[6.25rem] w-[6.1rem] shrink-0 flex-col items-center',
    'rounded-[18px] border border-transparent px-1.5 py-1.5 transition-[box-shadow,transform] duration-200 active:scale-[0.99] sm:w-[6.4rem]',
    DS_CARD_BG_MATCHDAY,
    selected
      ? 'shadow-[0_0_32px_rgba(40,255,120,0.08),0_8px_26px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]'
      : CARD_SHADOW,
  ].join(' ');
}

const TAB_INACTIVE =
  'border border-transparent bg-[rgba(18,18,22,0.88)] text-white/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)] hover:bg-[rgba(24,14,16,0.9)] hover:text-white/68';

export function dsFormationTabClass(active: boolean): string {
  return [
    'h-8 shrink-0 rounded-[14px] px-2.5 text-[11px] font-semibold leading-none transition-[background,box-shadow] duration-150',
    active
      ? 'border border-transparent bg-[linear-gradient(135deg,#FF4747_0%,#E31D2F_100%)] text-white shadow-[0_0_22px_rgba(255,40,40,0.2)]'
      : TAB_INACTIVE,
  ].join(' ');
}

export function dsSegmentTabClass(active: boolean): string {
  return [
    'flex-1 rounded-[10px] px-2 text-center text-sm font-semibold transition-[background,box-shadow,color] duration-150',
    active
      ? 'border border-transparent bg-[linear-gradient(135deg,#FF4747_0%,#E31D2F_100%)] text-white shadow-[0_0_22px_rgba(255,40,40,0.2)]'
      : TAB_INACTIVE,
  ].join(' ');
}

export function dsStickyCtaBarClass(): string {
  return 'fixed inset-x-0 z-[70] border-t border-[rgba(80,24,28,0.4)] bg-[rgba(9,9,9,0.88)] px-4 py-2.5 shadow-[0_-10px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl';
}

export function dsPrimaryCtaClass(): string {
  return [
    'rounded-[18px] border border-transparent',
    'bg-[linear-gradient(135deg,#FF4747_0%,#E31D2F_100%)]',
    'px-4 py-2.5 text-sm font-semibold text-white',
    'shadow-[0_0_28px_rgba(255,40,40,0.22)]',
    'transition-[box-shadow,transform] duration-150',
    'hover:shadow-[0_0_32px_rgba(255,40,40,0.28)]',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}

export function dsSecondaryCtaClass(): string {
  return [
    'rounded-[18px] border border-transparent',
    'bg-[rgba(18,18,22,0.88)] text-[#F2F2F2]',
    'px-4 py-2.5 text-sm font-semibold',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)]',
    'transition-[background,box-shadow] duration-150',
    'hover:bg-[rgba(24,14,16,0.92)]',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}
