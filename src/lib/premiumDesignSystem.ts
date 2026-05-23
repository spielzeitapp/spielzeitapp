/**
 * SpielzeitApp — Welcome-driven Cinematic Stadium UI.
 * Master-Referenz: Welcome / Intro (Flutlicht, Abendspiel, Rot-Glow).
 */

export const DS_APP_BG = '#080808';

/** Vollseiten-Shell mit schwarzem Basis-Hintergrund. */
export function dsPageShellClass(extra = ''): string {
  return ['relative min-h-[100dvh] bg-[#080808] text-white', extra].filter(Boolean).join(' ');
}

const PAGE_ATMOSPHERE_GRADIENT =
  'bg-[radial-gradient(circle_at_50%_0%,rgba(120,0,0,0.22),transparent_55%)]';

/** Stadium-Glow-Layer hinter Page-Content (fixed, pointer-events-none). */
export function dsPageAtmosphereClass(): string {
  return `pointer-events-none fixed inset-0 z-0 ${PAGE_ATMOSPHERE_GRADIENT}`;
}

/** Stadium-Glow innerhalb eines Containers (z. B. Wechsel-Sheet). */
export function dsPageAtmosphereAbsoluteClass(): string {
  return `pointer-events-none absolute inset-0 z-0 ${PAGE_ATMOSPHERE_GRADIENT}`;
}

export function dsPageContentClass(extra = ''): string {
  return ['relative z-[1]', extra].filter(Boolean).join(' ');
}

export function dsPageHeaderClass(): string {
  return 'sticky top-0 z-20 border-b border-transparent bg-[rgba(8,8,8,0.82)] px-4 py-3.5 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,0.38)]';
}

export const DS_CARD_RADIUS = 'rounded-[22px]';
export const DS_CARD_PAD = 'px-2.5 py-2';
export const DS_CARD_INNER_GAP = 'gap-2.5';
export const DS_LIST_GAP = 'gap-1.5';
export const DS_SECTION_GAP = 'gap-3.5';
export const DS_STAT_GRID_GAP = 'gap-2';

/** Cinematic Stadium Surface — leicht heller als #080808. */
export const DS_CARD_BG = 'bg-[rgba(18,18,22,0.92)]';
/** Mehr Schwarz, Rot nur oben/seitlich (Startaufstellung). */
export const DS_CARD_BG_MATCHDAY = 'bg-[rgba(14,12,14,0.94)]';
export const DS_CARD_BORDER = 'border border-transparent';

const CARD_SHADOW =
  'shadow-[0_0_36px_rgba(255,40,40,0.10),0_8px_28px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.03)]';
const CARD_SHADOW_ACTIVE =
  'shadow-[0_0_42px_rgba(255,40,40,0.14),0_10px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.035)]';

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
      ? 'cursor-pointer transition-[transform,box-shadow] duration-200 active:scale-[0.99] hover:shadow-[0_0_40px_rgba(255,40,40,0.12),0_10px_32px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.035)]'
      : '',
    opts?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function dsCardAmbientGlowClass(matchday?: boolean): string {
  if (matchday) {
    return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_12%_0%,rgba(255,40,40,0.11),transparent_52%),radial-gradient(ellipse_40%_50%_at_100%_30%,rgba(120,0,0,0.08),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_24%)]';
  }
  return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_10%_0%,rgba(255,40,40,0.08),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_22%)]';
}

export const DS_AVATAR_SIZE = 'h-[3.75rem] w-[3.75rem]';

export function dsAvatarRingClass(): string {
  return 'rounded-full border border-[rgba(90,28,32,0.5)] object-cover bg-[rgba(12,10,12,0.95)] shadow-[0_0_22px_rgba(255,40,40,0.14),0_4px_14px_rgba(0,0,0,0.35)]';
}

export function dsAvatarBloomClass(): string {
  return 'pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle,rgba(255,40,40,0.22)_0%,rgba(120,0,0,0.08)_48%,transparent_72%)] blur-[8px]';
}

export function dsPlayerNameClass(): string {
  return 'line-clamp-2 whitespace-normal break-words text-[15px] font-semibold leading-snug text-white';
}

export function dsPlayerSublineClass(): string {
  return 'mt-0.5 truncate text-[12px] font-normal text-[#b3b3b3]/95';
}

export function dsSectionLabelClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42';
}

export function dsJerseyNumberClass(): string {
  return 'text-[11px] font-medium tabular-nums text-white/38';
}

export function dsJerseyWrapClass(): string {
  return 'pointer-events-none shrink-0 opacity-90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35),0_0_18px_rgba(255,40,40,0.11)]';
}

export const DS_JERSEY_COMPACT = '!h-[2.92rem] !w-[2.29rem]';
export const DS_JERSEY_STARTER = '!h-[3.08rem] !w-[2.42rem]';

export const DS_CARD_FOOTER_DIVIDER = 'border-t border-[rgba(60,24,28,0.45)]';

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
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(20,110,70,0.32)] text-[#8DFFB7] shadow-[0_0_20px_rgba(40,255,120,0.12)]',
  external:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(16,70,48,0.26)] text-[#63D98D]',
  absent:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(120,18,28,0.34)] text-[#FF8D98] shadow-[0_0_16px_rgba(255,40,40,0.08)]',
  injured:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(120,60,10,0.32)] text-[#FFB15A] shadow-[0_0_14px_rgba(255,138,0,0.08)]',
  open:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(18,18,22,0.88)] text-[#8E8E93]',
  neutral:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(18,18,22,0.75)] text-white/42',
  selected:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(120,18,28,0.36)] text-[#FF8D98] shadow-[0_0_16px_rgba(255,40,40,0.1)]',
};

export function dsStatusChipClass(tone: DsChipTone = 'neutral'): string {
  return [CHIP_BASE, CHIP_TONE[tone]].join(' ');
}

export function dsStatChipBoxClass(tone: DsChipTone): string {
  return [
    DS_CARD_RADIUS,
    'border border-transparent px-2.5 py-2 text-center',
    CARD_SHADOW,
    CHIP_TONE[tone],
  ].join(' ');
}

const ACTION_BASE =
  'h-9 min-w-0 rounded-[16px] border border-transparent px-2.5 text-[11px] font-semibold transition-[background,box-shadow] duration-150 disabled:cursor-default disabled:opacity-50 sm:text-[12px]';

export function dsActionButtonClass(
  tone: 'absent' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    present: {
      idle: 'bg-[rgba(20,110,70,0.24)] text-[#8DFFB7] hover:bg-[rgba(20,110,70,0.32)] shadow-[0_0_14px_rgba(40,255,120,0.06)]',
      on: 'bg-[rgba(20,110,70,0.32)] text-[#8DFFB7] shadow-[0_0_20px_rgba(40,255,120,0.12)]',
    },
    external: {
      idle: 'bg-[rgba(16,70,48,0.2)] text-[#63D98D] hover:bg-[rgba(16,70,48,0.26)]',
      on: 'bg-[rgba(16,70,48,0.26)] text-[#63D98D] shadow-[0_0_14px_rgba(40,255,120,0.06)]',
    },
    absent: {
      idle: 'bg-[rgba(120,18,28,0.24)] text-[#FF8D98] hover:bg-[rgba(120,18,28,0.32)]',
      on: 'bg-[rgba(120,18,28,0.34)] text-[#FF8D98] shadow-[0_0_18px_rgba(255,40,40,0.1)]',
    },
    injured: {
      idle: 'bg-[rgba(120,60,10,0.24)] text-[#FFB15A] hover:bg-[rgba(120,60,10,0.30)]',
      on: 'bg-[rgba(120,60,10,0.32)] text-[#FFB15A] shadow-[0_0_14px_rgba(255,138,0,0.08)]',
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
        ? 'bg-[rgba(20,110,70,0.32)] text-[#8DFFB7] shadow-[0_0_20px_rgba(40,255,120,0.12)]'
        : 'bg-[rgba(18,18,22,0.88)] text-[#F2F2F2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_20px_rgba(255,40,40,0.06)] hover:bg-[rgba(22,14,16,0.92)]',
    ].join(' ');
  }
  return [
    base,
    active
      ? 'bg-[rgba(120,18,28,0.34)] text-[#FF8D98] shadow-[0_0_20px_rgba(255,40,40,0.14)]'
      : 'bg-[rgba(18,18,22,0.88)] text-[#F2F2F2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_20px_rgba(255,40,40,0.06)] hover:bg-[rgba(22,14,16,0.92)]',
  ].join(' ');
}

/** Mehr-Menü / Welcome-Panel-Zeilen. */
export function dsPanelRowClass(): string {
  return [
    'flex items-center justify-between gap-3 rounded-xl border border-transparent',
    'bg-[rgba(18,18,22,0.92)] px-4 py-3.5 text-left text-[16px] font-semibold text-white',
    'shadow-[0_0_36px_rgba(255,40,40,0.10),inset_0_1px_0_rgba(255,255,255,0.03)]',
    'transition-[box-shadow,background] duration-150',
    'hover:shadow-[0_0_40px_rgba(255,40,40,0.12)]',
  ].join(' ');
}

export function dsGlassToggleTrack(on: boolean): string {
  return [
    'relative h-7 w-12 shrink-0 rounded-full border border-transparent transition-colors duration-200',
    on
      ? 'bg-[rgba(20,110,70,0.35)] shadow-[0_0_16px_rgba(40,255,120,0.1)]'
      : 'bg-[rgba(18,18,22,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_14px_rgba(255,40,40,0.05)]',
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
      'bg-[rgba(18,18,22,0.92)]',
      'shadow-[0_0_32px_rgba(40,255,120,0.1),0_0_36px_rgba(255,40,40,0.08),inset_0_1px_0_rgba(255,255,255,0.03)]',
    ].join(' ');
  }
  return [base, DS_CARD_BG_MATCHDAY, CARD_SHADOW].join(' ');
}

export function dsLineupPositionPillClass(role: 'starter' | 'bench'): string {
  if (role === 'starter') {
    return 'inline-flex h-[20px] items-center rounded-md border border-transparent bg-[rgba(120,18,28,0.26)] px-1.5 text-[9px] font-bold uppercase tracking-wide text-[#FF8D98]';
  }
  return 'inline-flex h-[20px] items-center rounded-md border border-transparent bg-[rgba(18,18,22,0.88)] px-1.5 text-[9px] font-bold uppercase tracking-wide text-[#8E8E93]';
}

export function dsBenchTileClass(selected?: boolean): string {
  return [
    'flex min-h-[6.25rem] w-[6.1rem] shrink-0 flex-col items-center',
    'rounded-[18px] border border-transparent px-1.5 py-1.5 transition-[box-shadow,transform] duration-200 active:scale-[0.99] sm:w-[6.4rem]',
    DS_CARD_BG_MATCHDAY,
    selected
      ? 'shadow-[0_0_32px_rgba(40,255,120,0.1),0_0_36px_rgba(255,40,40,0.08),inset_0_1px_0_rgba(255,255,255,0.03)]'
      : CARD_SHADOW,
  ].join(' ');
}

const TAB_INACTIVE =
  'border border-transparent bg-[rgba(18,18,22,0.88)] text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)] hover:bg-[rgba(22,14,16,0.9)] hover:text-white/65';

const SEGMENT_TRACK =
  'flex overflow-hidden rounded-[12px] border border-transparent bg-[rgba(18,18,22,0.88)] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(255,40,40,0.05)]';

export function dsSegmentTrackClass(): string {
  return SEGMENT_TRACK;
}

export function dsFormationTabClass(active: boolean): string {
  return [
    'h-8 shrink-0 rounded-[14px] px-2.5 text-[11px] font-semibold leading-none transition-[background,box-shadow] duration-150',
    active
      ? 'border border-transparent bg-[linear-gradient(135deg,#FF4747_0%,#E31D2F_100%)] text-white shadow-[0_0_24px_rgba(255,50,50,0.24)]'
      : TAB_INACTIVE,
  ].join(' ');
}

export function dsSegmentTabClass(active: boolean): string {
  return [
    'flex-1 rounded-[10px] px-2 text-center text-sm font-semibold transition-[background,box-shadow,color] duration-150',
    active
      ? 'border border-transparent bg-[linear-gradient(135deg,#FF4747_0%,#E31D2F_100%)] text-white shadow-[0_0_24px_rgba(255,50,50,0.24)]'
      : 'bg-transparent text-white/42 hover:text-white/58',
  ].join(' ');
}

/** LIVE / START in Live-Aufstellung. */
export function dsLineupViewTabClass(view: 'live' | 'kickoff', active: boolean): string {
  const base =
    'inline-flex h-[38px] min-w-[4.75rem] shrink-0 items-center justify-center rounded-[18px] border border-transparent px-3 text-[11px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 active:scale-[0.987] sm:min-w-[5rem] sm:text-sm';
  if (!active) return `${base} ${TAB_INACTIVE}`;
  if (view === 'live') {
    return `${base} bg-gradient-to-br from-emerald-800/75 to-emerald-950/85 text-emerald-50 shadow-[0_0_22px_rgba(40,255,120,0.14)]`;
  }
  return `${base} bg-[linear-gradient(135deg,#FF4747_0%,#E31D2F_100%)] text-white shadow-[0_0_24px_rgba(255,50,50,0.24)]`;
}

/** Wechsel-Screen: Spieler-Pick-Zeile (Matchday-Panel). */
export function dsWechselPickRowClass(opts: {
  selected?: boolean;
  recommended?: boolean;
  side?: 'out' | 'in';
}): string {
  const base = [
    'flex h-[61px] min-h-[58px] max-h-[66px] shrink-0 items-center gap-1.5 rounded-[18px] border border-transparent px-2 py-1.5 text-left transition-all active:scale-[0.99]',
    DS_CARD_BG_MATCHDAY,
    CARD_SHADOW,
  ].join(' ');
  if (opts.selected) {
    if (opts.side === 'in') {
      return `${base} shadow-[0_0_28px_rgba(40,255,120,0.14)] ring-1 ring-emerald-500/35`;
    }
    return `${base} shadow-[0_0_28px_rgba(255,40,40,0.16)] ring-1 ring-red-500/30`;
  }
  if (opts.recommended) {
    return `${base} shadow-[0_0_22px_rgba(40,255,120,0.1)] ring-1 ring-emerald-500/25`;
  }
  return `${base} hover:shadow-[0_0_36px_rgba(255,40,40,0.12)]`;
}

export function dsStickyCtaBarClass(): string {
  return 'fixed inset-x-0 z-[70] border-t border-transparent bg-[rgba(8,8,8,0.88)] px-4 py-2.5 shadow-[0_-10px_36px_rgba(0,0,0,0.42)] backdrop-blur-xl';
}

export function dsPrimaryCtaClass(): string {
  return [
    'rounded-[18px] border border-transparent',
    'bg-[linear-gradient(135deg,#FF4747_0%,#E31D2F_100%)]',
    'px-4 py-2.5 text-sm font-semibold text-white',
    'shadow-[0_0_28px_rgba(255,50,50,0.24)]',
    'transition-[box-shadow,transform] duration-150',
    'hover:shadow-[0_0_32px_rgba(255,50,50,0.28)]',
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
    'hover:bg-[rgba(22,14,16,0.92)]',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}

/** Mehr-Hub: subtiler Page-Hintergrund (weniger Vollflächen-Rot). */
export function dsMoreHubPageStyle(): { background: string; boxShadow: string } {
  return {
    background:
      'radial-gradient(circle at 50% 0%, rgba(120,0,0,0.14), transparent 50%), linear-gradient(180deg, #0b0b0d 0%, #080808 100%)',
    boxShadow: 'inset 0 0 80px rgba(120,20,20,0.06)',
  };
}
