/**
 * SpielzeitApp Premium Design System — Referenzbild + Visual Balance Pass.
 */

export const DS_CARD_RADIUS = 'rounded-[22px]';
export const DS_CARD_PAD = 'px-2.5 py-2';
export const DS_CARD_INNER_GAP = 'gap-2.5';
export const DS_LIST_GAP = 'gap-1.5';
export const DS_SECTION_GAP = 'gap-3';
export const DS_STAT_GRID_GAP = 'gap-1.5';

/** Leicht über App-Background (#0a0a0b) — cinematic lift. */
export const DS_CARD_BG =
  'bg-gradient-to-br from-[#1a1a1f] via-[#141418] to-[#0a0a0c]';
export const DS_CARD_BG_MATCHDAY =
  'bg-gradient-to-br from-[#1e1a1f] via-[#161214] to-[#0a080a]';
export const DS_CARD_BORDER = 'border border-transparent';

const CARD_SHADOW =
  'shadow-[0_8px_30px_rgba(0,0,0,0.52),0_0_28px_rgba(224,33,41,0.07),inset_0_1px_0_rgba(255,255,255,0.025)]';
const CARD_SHADOW_ACTIVE =
  'shadow-[0_10px_36px_rgba(0,0,0,0.58),0_0_36px_rgba(224,33,41,0.12),inset_0_1px_0_rgba(255,255,255,0.035)]';

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
      ? 'cursor-pointer transition-[transform,box-shadow] duration-200 active:scale-[0.99] hover:shadow-[0_10px_34px_rgba(0,0,0,0.55),0_0_32px_rgba(224,33,41,0.09)]'
      : '',
    opts?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function dsCardAmbientGlowClass(matchday?: boolean): string {
  if (matchday) {
    return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_75%_at_8%_0%,rgba(224,33,41,0.12),transparent_58%),radial-gradient(ellipse_55%_45%_at_100%_90%,rgba(122,15,20,0.07),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_28%)]';
  }
  return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_92%_72%_at_6%_0%,rgba(224,33,41,0.09),transparent_60%),radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(122,15,20,0.05),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_24%)]';
}

export const DS_AVATAR_SIZE = 'h-[3.75rem] w-[3.75rem]';

export function dsAvatarRingClass(): string {
  return 'rounded-full border border-[#3a2024]/90 object-cover bg-[#121214] shadow-[0_0_20px_rgba(224,33,41,0.14),0_4px_14px_rgba(0,0,0,0.38)]';
}

export function dsAvatarBloomClass(): string {
  return 'pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle,rgba(224,33,41,0.2)_0%,rgba(122,15,20,0.07)_48%,transparent_72%)] blur-[7px]';
}

export function dsPlayerNameClass(): string {
  return 'line-clamp-2 whitespace-normal break-words text-[15px] font-semibold leading-snug text-white';
}

export function dsPlayerSublineClass(): string {
  return 'mt-0.5 truncate text-[12px] font-normal text-[#b3b3b3]';
}

export function dsSectionLabelClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/48';
}

export function dsJerseyNumberClass(): string {
  return 'text-[11px] font-medium tabular-nums text-white/35';
}

/** Trikot ~12 % größer, etwas präsenter — Spieler bleibt Hero. */
export function dsJerseyWrapClass(): string {
  return 'pointer-events-none shrink-0 opacity-[0.84] drop-shadow-[0_2px_10px_rgba(0,0,0,0.35),0_0_12px_rgba(224,33,41,0.08)]';
}

export const DS_JERSEY_COMPACT = '!h-[2.65rem] !w-[2.08rem]';
export const DS_JERSEY_STARTER = '!h-[2.8rem] !w-[2.2rem]';

export const DS_CARD_FOOTER_DIVIDER = 'border-t border-[#2a2a2e]/70';

export type DsChipTone =
  | 'present'
  | 'absent'
  | 'injured'
  | 'external'
  | 'open'
  | 'neutral'
  | 'selected';

const CHIP_TONE: Record<DsChipTone, string> = {
  present: 'border-emerald-800/55 bg-emerald-900/42 text-emerald-100/92',
  absent: 'border-red-900/55 bg-red-900/38 text-red-100/88',
  injured: 'border-amber-900/55 bg-amber-900/38 text-amber-50/90',
  external: 'border-violet-900/55 bg-violet-900/40 text-violet-100/88',
  open: 'border-[#3a3a42] bg-[#1a1a1f] text-white/58',
  neutral: 'border-[#323238] bg-[#16161a] text-white/48',
  selected: 'border-red-900/55 bg-red-900/38 text-red-50/92',
};

export function dsStatusChipClass(tone: DsChipTone = 'neutral'): string {
  return [
    'inline-flex max-w-[9rem] shrink-0 items-center justify-center rounded-full border',
    'h-[22px] px-2.5 text-[9px] font-bold uppercase tracking-[0.08em] leading-none',
    CHIP_TONE[tone],
  ].join(' ');
}

export function dsStatChipBoxClass(tone: DsChipTone): string {
  return [
    DS_CARD_RADIUS,
    'border px-2.5 py-1.5 text-center shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
    CHIP_TONE[tone],
  ].join(' ');
}

export function dsActionButtonClass(
  tone: 'absent' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const base =
    'h-8 min-w-0 rounded-[14px] border px-2 text-[10px] font-semibold transition-[background,box-shadow] duration-150 disabled:cursor-default disabled:opacity-50 sm:text-[11px]';
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    absent: {
      idle: 'border-red-900/45 bg-red-900/32 text-red-100/80 hover:bg-red-800/42 shadow-[0_2px_10px_rgba(0,0,0,0.3)]',
      on: 'border-red-800/50 bg-gradient-to-b from-red-800/55 to-red-950/50 text-red-50/95 shadow-[0_0_14px_rgba(224,33,41,0.12)]',
    },
    injured: {
      idle: 'border-amber-900/45 bg-amber-900/30 text-amber-50/80 hover:bg-amber-900/42',
      on: 'border-amber-800/50 bg-amber-900/48 text-amber-50/92 shadow-[0_0_12px_rgba(255,138,0,0.1)]',
    },
    external: {
      idle: 'border-violet-900/45 bg-violet-900/30 text-violet-100/80 hover:bg-violet-900/42',
      on: 'border-violet-800/50 bg-violet-900/48 text-violet-50/92',
    },
    present: {
      idle: 'border-emerald-900/45 bg-emerald-900/30 text-emerald-50/80 hover:bg-emerald-900/42',
      on: 'border-emerald-800/50 bg-emerald-900/48 text-emerald-50/95 shadow-[0_0_12px_rgba(25,195,125,0.1)]',
    },
  };
  return [base, active ? tones[tone].on : tones[tone].idle].join(' ');
}

export function dsRsvpChoiceClass(kind: 'yes' | 'no', active: boolean): string {
  const base =
    'inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] border font-semibold text-sm transition-[background,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50';
  if (kind === 'yes') {
    return [
      base,
      active
        ? 'border-emerald-700/45 bg-gradient-to-b from-emerald-700/55 to-emerald-950/50 text-emerald-50 shadow-[0_4px_18px_rgba(25,195,125,0.18)]'
        : 'border-[#2a2a2e] bg-gradient-to-b from-[#1a1a1f] to-[#101012] text-white/75 hover:from-[#1e1e24] hover:text-white/90',
    ].join(' ');
  }
  return [
    base,
    active
      ? 'border-red-800/45 bg-gradient-to-b from-[#c41f28]/70 to-red-950/55 text-red-50 shadow-[0_4px_18px_rgba(224,33,41,0.2)]'
      : 'border-[#2a2a2e] bg-gradient-to-b from-[#1a1a1f] to-[#101012] text-white/75 hover:from-[#1e1e24] hover:text-white/90',
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
      'bg-gradient-to-r from-emerald-950/28 via-[#141418] to-[#0a0a0c]',
      'shadow-[0_8px_28px_rgba(0,0,0,0.5),0_0_24px_rgba(25,195,125,0.09),inset_0_1px_0_rgba(255,255,255,0.02)]',
    ].join(' ');
  }
  return [base, DS_CARD_BG_MATCHDAY, CARD_SHADOW].join(' ');
}

export function dsLineupPositionPillClass(role: 'starter' | 'bench'): string {
  if (role === 'starter') {
    return 'inline-flex h-[20px] items-center rounded-md border border-red-900/55 bg-red-900/42 px-1.5 text-[9px] font-bold uppercase tracking-wide text-red-100/85';
  }
  return 'inline-flex h-[20px] items-center rounded-md border border-[#323238] bg-[#1a1a1f] px-1.5 text-[9px] font-bold uppercase tracking-wide text-white/50';
}

export function dsBenchTileClass(selected?: boolean): string {
  return [
    'flex min-h-[6.25rem] w-[6.1rem] shrink-0 flex-col items-center',
    'rounded-[18px] border border-transparent px-1.5 py-1.5 transition-[box-shadow,transform] duration-200 active:scale-[0.99] sm:w-[6.4rem]',
    DS_CARD_BG_MATCHDAY,
    selected
      ? 'shadow-[0_8px_26px_rgba(0,0,0,0.5),0_0_22px_rgba(25,195,125,0.1)]'
      : CARD_SHADOW,
  ].join(' ');
}

export function dsFormationTabClass(active: boolean): string {
  return [
    'h-8 shrink-0 rounded-[14px] border px-2.5 text-[11px] font-semibold leading-none transition-[background,box-shadow] duration-150',
    active
      ? 'border-red-800/40 bg-gradient-to-r from-[#d42830]/90 to-[#a81820]/95 text-white shadow-[0_4px_14px_rgba(224,33,41,0.22)]'
      : 'border-transparent bg-[#1a1a1f] text-white/48 hover:bg-[#222228] hover:text-white/65',
  ].join(' ');
}

export function dsSegmentTabClass(active: boolean): string {
  return [
    'flex-1 rounded-[10px] px-2 text-center text-sm font-semibold transition-[background,box-shadow,color] duration-150',
    active
      ? 'bg-gradient-to-r from-[#e02129] to-[#b81820] text-white shadow-[0_4px_16px_rgba(224,33,41,0.28)]'
      : 'bg-transparent text-white/42 hover:bg-white/[0.04] hover:text-white/62',
  ].join(' ');
}

export function dsStickyCtaBarClass(): string {
  return 'fixed inset-x-0 z-[70] border-t border-[#2a2a2e]/50 bg-[#0a0a0b]/82 px-4 py-2.5 shadow-[0_-10px_36px_rgba(0,0,0,0.42)] backdrop-blur-xl';
}

export function dsPrimaryCtaClass(): string {
  return [
    'rounded-[18px] border border-[#ff5a5f]/20',
    'bg-gradient-to-r from-[#ef3b43] via-[#e02129] to-[#c41a22]',
    'px-4 py-2.5 text-sm font-semibold text-white',
    'shadow-[0_8px_26px_rgba(224,33,41,0.32),0_0_18px_rgba(224,33,41,0.14)]',
    'transition-[background,box-shadow,transform] duration-150',
    'hover:from-[#f24a52] hover:via-[#e82a32] hover:shadow-[0_10px_28px_rgba(224,33,41,0.38)]',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}

export function dsSecondaryCtaClass(): string {
  return [
    'rounded-[18px] border border-[#2a2a2e]/80',
    'bg-gradient-to-b from-[#1e1e24] to-[#121214]',
    'px-4 py-2.5 text-sm font-semibold text-white/88',
    'shadow-[0_4px_18px_rgba(0,0,0,0.35)]',
    'transition-[background,box-shadow] duration-150 hover:from-[#24242c] hover:text-white',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}
