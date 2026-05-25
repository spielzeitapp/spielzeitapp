/**
 * SpielzeitApp — Welcome-driven Cinematic Stadium UI.
 * Master-Referenz: Welcome / Intro (Flutlicht, Abendspiel, Rot-Glow).
 */

export const DS_APP_BG = '#0A0A0C';

/** Deep Dark Red Matchday — Surfaces & Accents */
export const DS_SURFACE_900 = '#0A0A0C';
export const DS_SURFACE_800 = '#121214';
export const DS_SURFACE_700 = '#1A1A1D';
export const DS_RED_ACCENT = '#5A1622';
export const DS_RED_GLOW = '#7A1D2A';
export const DS_RED_DEEP = '#3A1218';

const PAGE_ATMOSPHERE_LAYERS =
  'bg-[radial-gradient(ellipse_120%_70%_at_50%_-6%,rgba(122,29,42,0.07),transparent_52%),radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(58,18,24,0.12),transparent_58%),radial-gradient(ellipse_100%_75%_at_50%_110%,rgba(0,0,0,0.48),transparent_48%)]';

/** Vollseiten-Shell — tiefer Schwarzton, kein Vollflächen-Rot. */
export function dsPageShellClass(extra = ''): string {
  return [
    'relative min-h-[100dvh] text-white',
    'bg-[linear-gradient(180deg,#090909_0%,#050505_100%)]',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Stadium-Glow + Fog + Vignette (fixed). */
export function dsPageAtmosphereClass(): string {
  return `pointer-events-none fixed inset-0 z-0 ${PAGE_ATMOSPHERE_LAYERS}`;
}

/** Stadium-Glow innerhalb eines Containers (z. B. Wechsel-Sheet). */
export function dsPageAtmosphereAbsoluteClass(): string {
  return `pointer-events-none absolute inset-0 z-0 ${PAGE_ATMOSPHERE_LAYERS}`;
}

export function dsPageContentClass(extra = ''): string {
  return ['relative z-[1]', extra].filter(Boolean).join(' ');
}

export function dsPageHeaderClass(): string {
  return [
    'sticky top-0 z-20 border-b border-transparent',
    'bg-[rgba(6,6,8,0.72)] px-4 py-4 backdrop-blur-md',
    'shadow-[0_8px_28px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,30,30,0.04)]',
  ].join(' ');
}

/** Hero-Titelzone (Match-Vorbereitung etc.). */
export function dsPageHeroGlowClass(): string {
  return 'pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(255,30,30,0.08),transparent_70%)]';
}

/** Glow hinter Formations-/Pitch-Bereich. */
export function dsFormationZoneGlowClass(): string {
  return 'pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_90%_70%_at_50%_20%,rgba(255,30,30,0.05),transparent_62%)]';
}

export const DS_CARD_RADIUS = 'rounded-[22px]';
export const DS_CARD_PAD = 'px-3 py-2.5';
export const DS_CARD_INNER_GAP = 'gap-3';
export const DS_LIST_GAP = 'gap-2';
export const DS_SECTION_GAP = 'gap-4';
export const DS_STAT_GRID_GAP = 'gap-2.5';

/** Warm muted — bessere Lesbarkeit auf Deep Dark. */
export const DS_TEXT_MUTED = 'text-[#B8B0B4]';
export const DS_TEXT_SOFT = 'text-[#9A9398]';
export const DS_TEXT_BODY = 'text-[#E8E4E6]';

/** Kleine Brand-Zeile (SpielzeitApp) — weiterhin Caps. */
export function dsBrandKickerClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.14em] text-red-400/85';
}

/** Screen-Headlines (Termine, Feed, Livespiel). */
export function dsPageTitleClass(): string {
  return 'text-[2rem] font-bold tracking-[-0.03em] text-white';
}

/** Alias — gleiche Spec wie Screen-Headlines. */
export function dsScreenHeadlineClass(): string {
  return dsPageTitleClass();
}

/** Section Labels (NÄCHSTES SPIEL, Matchday-Feed). */
export function dsMatchdaySectionLabelClass(): string {
  return 'text-[0.78rem] font-semibold uppercase tracking-[0.35em] text-[#B85C68]';
}

/** Sublines unter Headlines. */
export function dsSublineClass(): string {
  return 'font-medium leading-relaxed text-white/82';
}

/** Primary-/Secondary-Button-Text. */
export function dsButtonTextClass(): string {
  return 'text-[1rem] font-semibold tracking-[0.01em]';
}

const PRIMARY_GRADIENT = 'bg-gradient-to-br from-[#7A1D2A] to-[#3A1218]';
const PRIMARY_ACTIVE_GLOW = 'shadow-[0_0_22px_rgba(122,29,42,0.35),inset_0_1px_0_rgba(255,255,255,0.1)]';
const PRIMARY_GLOW =
  'shadow-[0_0_24px_rgba(122,29,42,0.2),inset_0_1px_0_rgba(255,255,255,0.1),0_4px_18px_rgba(0,0,0,0.4)]';
const PRIMARY_GLOW_HOVER =
  'hover:shadow-[0_0_28px_rgba(122,29,42,0.32),inset_0_1px_0_rgba(255,255,255,0.12),0_6px_22px_rgba(0,0,0,0.44)]';

export function dsCardTitleClass(): string {
  return 'text-lg font-bold leading-snug tracking-tight text-white';
}

/** Untertitel unter Headlines — mehr Luft, soft gray. */
export function dsPageSubtitleClass(): string {
  return 'mt-2 text-sm font-normal leading-relaxed text-[#A8A8AE]';
}

export function dsMetaTextClass(): string {
  return 'text-xs font-normal leading-relaxed text-[#A8A8AE]';
}

export function dsBodyTextClass(): string {
  return `text-sm font-normal leading-relaxed ${DS_TEXT_BODY}`;
}

/** Termine: Datum-Box links (Fixture-Card). */
export function dsScheduleDateBoxClass(): string {
  return [
    'flex w-[58px] shrink-0 flex-col items-start justify-center gap-0.5 rounded-[14px]',
    'border border-white/[0.08] bg-[rgba(18,18,20,0.96)] px-2 py-2 leading-none',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_20px_rgba(122,29,42,0.06)]',
  ].join(' ');
}

export function dsScheduleDateBoxWeekdayClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B85C68]';
}

export function dsScheduleDateBoxDayClass(): string {
  return 'text-[1.65rem] font-bold tabular-nums leading-none text-white';
}

export function dsScheduleDateBoxMonthClass(): string {
  return 'text-[10px] font-medium leading-tight text-[#B8B0B4]';
}

/** Meta-Zeile unter Fixture-Cards (Beginn · Treffpunkt · Ende). */
export function dsScheduleFixtureMetaRowClass(): string {
  return 'mt-2.5 border-t border-white/[0.05] pt-2 text-[11px] font-medium leading-snug text-white/65';
}

/** Termine: Dark-Glass-Controls (Abo, Kalender, Toolbar). */
export function dsScheduleGlassButtonClass(): string {
  return [
    'inline-flex items-center justify-center rounded-[14px] border border-white/[0.1]',
    'bg-[rgba(18,18,20,0.92)] text-white/85 backdrop-blur-sm',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_16px_rgba(122,29,42,0.08)]',
    'transition-[background,box-shadow,border-color] duration-150',
    'hover:border-white/[0.14] hover:bg-[rgba(22,18,20,0.96)] hover:text-white',
  ].join(' ');
}

/** Termin anlegen (+). */
export function dsSchedulePlusButtonClass(): string {
  return [
    'flex items-center justify-center rounded-full border border-[rgba(122,29,42,0.35)]',
    'bg-gradient-to-br from-[#7A1D2A] to-[#3A1218] text-white',
    'shadow-[0_0_20px_rgba(122,29,42,0.28),inset_0_1px_0_rgba(255,255,255,0.1)]',
    'transition-[box-shadow,transform] duration-150',
    'hover:shadow-[0_0_24px_rgba(122,29,42,0.35)] active:scale-[0.97]',
    'disabled:opacity-45',
  ].join(' ');
}

export function dsTertiaryButtonClass(): string {
  return [
    'inline-flex items-center justify-center rounded-[16px] border border-white/[0.08]',
    'bg-[rgba(10,10,12,0.96)] text-[#E8E4E6]',
    'px-3 py-2 text-sm font-semibold',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    'transition-[background,box-shadow] duration-150',
    'hover:bg-[rgba(16,14,16,0.98)]',
    'active:scale-[0.98]',
  ].join(' ');
}

/** Cinematic Stadium Surface — dunkler, dünner Rot-Ambient-Rand. */
export const DS_CARD_BG = 'bg-[rgba(12,12,16,0.96)]';
/** Mehr Schwarz, Rot nur oben/seitlich (Startaufstellung). */
export const DS_CARD_BG_MATCHDAY = 'bg-[rgba(10,10,14,0.97)]';
export const DS_CARD_BORDER = 'border border-[rgba(255,40,40,0.07)]';

const CARD_SHADOW =
  'shadow-[0_0_28px_rgba(255,40,40,0.06),0_8px_24px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.025)]';
const CARD_SHADOW_ACTIVE =
  'shadow-[0_0_32px_rgba(255,40,40,0.09),0_10px_28px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.03)]';

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
    return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_12%_0%,rgba(255,40,40,0.08),transparent_52%),radial-gradient(ellipse_40%_50%_at_100%_30%,rgba(120,0,0,0.05),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_26%)]';
  }
  return 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_10%_0%,rgba(255,40,40,0.06),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_24%)]';
}

/** Home-Feed / Training — mehr Schwarz, kein roter Flächenlook. */
export function dsFeedCardShellClass(className = ''): string {
  return [
    'relative w-full overflow-hidden text-left',
    DS_CARD_RADIUS,
    'border border-[rgba(255,255,255,0.06)]',
    'bg-[rgba(11,11,13,0.98)]',
    'shadow-[0_10px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]',
    'px-3 py-3',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function dsFeedCardGlowClass(): string {
  return 'pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_18%)]';
}

/** Training-Teilnahme: Premium Matchday Panel mit Stadium-Tiefe (kein Vollrot). */
export function dsTrainingAttendanceCardShellClass(className = ''): string {
  return [
    'relative w-full overflow-hidden text-left',
    DS_CARD_RADIUS,
    'border border-[rgba(255,45,85,0.1)]',
    'bg-[linear-gradient(180deg,rgba(13,12,15,0.98)_0%,rgba(11,10,13,0.98)_42%,rgba(16,10,12,0.99)_100%)]',
    'shadow-[0_12px_36px_rgba(0,0,0,0.52),0_0_32px_rgba(255,45,85,0.09),inset_0_1px_0_rgba(255,255,255,0.045),inset_0_-28px_52px_rgba(255,30,30,0.05)]',
    'px-3 py-3',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function dsTrainingAttendanceCardGlowClass(): string {
  return [
    'pointer-events-none absolute inset-0',
    'bg-[radial-gradient(ellipse_92%_58%_at_50%_0%,rgba(255,45,85,0.08)_0%,transparent_58%),radial-gradient(ellipse_85%_45%_at_50%_100%,rgba(70,8,18,0.1)_0%,transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.028)_0%,transparent_22%)]',
  ].join(' ');
}

/** Training-Detail: warmer Header-Nebel (nur Wrapper, Logos unberührt). */
export function dsTrainingDetailHeaderAtmosphereClass(): string {
  return 'pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] bg-[radial-gradient(ellipse_115%_80%_at_50%_-10%,rgba(122,29,42,0.16)_0%,transparent_56%),radial-gradient(ellipse_70%_45%_at_100%_0%,rgba(255,240,220,0.06)_0%,transparent_50%),linear-gradient(180deg,rgba(58,18,24,0.08)_0%,transparent_42%)]';
}

/** Termin-Detail: Kalender-Zeile — Deep Red Premium. */
export function dsScheduleDetailCalendarRowClass(): string {
  return [
    'flex w-full items-center gap-3 rounded-[14px] border border-[rgba(122,29,42,0.28)] px-3.5 py-3',
    'bg-[linear-gradient(135deg,rgba(58,18,24,0.42)_0%,rgba(12,12,14,0.96)_100%)]',
    'text-white/92 shadow-[0_0_20px_rgba(122,29,42,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]',
    'transition-[background,border-color,transform] duration-150',
    'hover:border-[rgba(122,29,42,0.38)] hover:bg-[linear-gradient(135deg,rgba(58,18,24,0.5)_0%,rgba(16,14,16,0.98)_100%)]',
    'active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}

export function dsFeedAvatarRingClass(): string {
  return 'rounded-full border border-[rgba(255,255,255,0.08)] object-cover bg-[rgba(10,10,12,0.96)] shadow-[0_4px_16px_rgba(0,0,0,0.42)]';
}

export function dsFeedAvatarBloomClass(): string {
  return 'pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle,rgba(255,40,40,0.1)_0%,transparent_70%)] blur-[6px]';
}

export const DS_FEED_CARD_FOOTER_DIVIDER = 'border-t border-[rgba(255,255,255,0.06)]';

export const DS_AVATAR_SIZE = 'h-[3.75rem] w-[3.75rem]';

export function dsAvatarRingClass(): string {
  return 'rounded-full border border-[rgba(90,28,32,0.45)] object-cover bg-[rgba(12,10,12,0.95)] shadow-[0_0_24px_rgba(255,40,40,0.16),0_4px_14px_rgba(0,0,0,0.35)]';
}

export function dsAvatarBloomClass(): string {
  return 'pointer-events-none absolute -inset-1.5 rounded-full bg-[radial-gradient(circle,rgba(255,40,40,0.24)_0%,rgba(120,0,0,0.1)_45%,transparent_72%)] blur-[9px]';
}

/** Voller Name in Listen/Cards — 2 Zeilen, kein Nachname-only. */
export function dsPlayerNameClass(): string {
  return 'line-clamp-2 min-w-0 whitespace-normal break-words text-[13px] font-semibold leading-[1.28] text-white sm:text-[14px]';
}

export function dsPlayerSublineClass(): string {
  return 'mt-0.5 line-clamp-1 text-[11px] font-normal text-[#A8A8AE] sm:text-[12px]';
}

/** Kleine Section Labels — einzige erlaubte Caps-Stelle neben LIVE/ENDSTAND. */
export function dsSectionLabelClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]';
}

export function dsJerseyNumberClass(): string {
  return 'text-[10px] font-medium tabular-nums text-white/32';
}

export function dsJerseyWrapClass(): string {
  return 'pointer-events-none shrink-0 opacity-90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35),0_0_20px_rgba(255,40,40,0.12)]';
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
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(20,110,70,0.34)] text-[#9DFFC5] shadow-[0_0_22px_rgba(40,255,120,0.14)]',
  external:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(14,58,40,0.32)] text-[#63D98D]',
  absent:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(100,14,24,0.38)] text-[#FF8D98] shadow-[0_0_14px_rgba(255,40,40,0.07)]',
  injured:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(110,52,8,0.34)] text-[#FFB15A] shadow-[0_0_12px_rgba(255,138,0,0.07)]',
  open:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(16,16,20,0.92)] text-[#8E8E93] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
  neutral:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(16,16,20,0.85)] text-white/42',
  selected:
    'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(100,14,24,0.36)] text-[#FF8D98] shadow-[0_0_14px_rgba(255,40,40,0.09)]',
};

export function dsStatusChipClass(tone: DsChipTone = 'neutral'): string {
  return [CHIP_BASE, CHIP_TONE[tone]].join(' ');
}

export function dsStatChipBoxClass(tone: DsChipTone): string {
  return [
    DS_CARD_RADIUS,
    'border border-transparent px-2.5 py-2.5 text-center',
    'bg-[rgba(16,16,20,0.92)]',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_24px_rgba(255,40,40,0.06)]',
    CHIP_TONE[tone],
  ].join(' ');
}

const ACTION_BASE =
  'h-10 min-w-0 rounded-[16px] border border-transparent px-3 text-[11px] font-semibold transition-[background,box-shadow] duration-150 disabled:cursor-default disabled:opacity-50 sm:text-[12px]';

export function dsActionButtonClass(
  tone: 'absent' | 'injured' | 'external' | 'present',
  active?: boolean,
): string {
  const tones: Record<typeof tone, { idle: string; on: string }> = {
    present: {
      idle: 'bg-[rgba(20,110,70,0.26)] text-[#8DFFB7] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_16px_rgba(40,255,120,0.08)] hover:bg-[rgba(20,110,70,0.34)]',
      on: 'bg-[rgba(22,120,76,0.38)] text-[#9DFFC5] shadow-[0_0_22px_rgba(40,255,120,0.16),inset_0_1px_0_rgba(255,255,255,0.05)]',
    },
    external: {
      idle: 'bg-[rgba(14,58,40,0.22)] text-[#63D98D] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-[rgba(14,58,40,0.28)]',
      on: 'bg-[rgba(14,58,40,0.28)] text-[#63D98D] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    },
    absent: {
      idle: 'bg-[rgba(100,14,24,0.26)] text-[#FF8D98] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_12px_rgba(255,40,40,0.05)] hover:bg-[rgba(100,14,24,0.34)]',
      on: 'bg-[rgba(100,14,24,0.36)] text-[#FF8D98] shadow-[0_0_18px_rgba(255,40,40,0.1),inset_0_1px_0_rgba(255,255,255,0.04)]',
    },
    injured: {
      idle: 'bg-[rgba(110,52,8,0.26)] text-[#FFB15A] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-[rgba(110,52,8,0.32)]',
      on: 'bg-[rgba(110,52,8,0.34)] text-[#FFB15A] shadow-[0_0_14px_rgba(255,138,0,0.09),inset_0_1px_0_rgba(255,255,255,0.04)]',
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
        : 'bg-[rgba(16,16,20,0.92)] text-[#F2F2F2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_20px_rgba(255,40,40,0.06)] hover:bg-[rgba(22,14,16,0.92)]',
    ].join(' ');
  }
  return [
    base,
    active
      ? 'bg-[rgba(100,14,24,0.34)] text-[#FF8D98] shadow-[0_0_20px_rgba(255,40,40,0.14)]'
      : 'bg-[rgba(16,16,20,0.92)] text-[#F2F2F2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_20px_rgba(255,40,40,0.06)] hover:bg-[rgba(22,14,16,0.92)]',
  ].join(' ');
}

/** Mehr-Menü / Welcome-Panel-Zeilen. */
export function dsPanelRowClass(): string {
  return [
    'flex items-center justify-between gap-3 rounded-xl',
    DS_CARD_BORDER,
    'bg-[rgba(12,12,16,0.96)] px-4 py-3.5 text-left text-[16px] font-semibold text-white',
    'shadow-[0_0_28px_rgba(255,40,40,0.06),inset_0_1px_0_rgba(255,255,255,0.025)]',
    'transition-[box-shadow,background] duration-150',
    'hover:shadow-[0_0_40px_rgba(255,40,40,0.12)]',
  ].join(' ');
}

export function dsGlassToggleTrack(on: boolean): string {
  return [
    'relative h-7 w-12 shrink-0 rounded-full border border-transparent transition-colors duration-200',
    on
      ? 'bg-[rgba(20,110,70,0.35)] shadow-[0_0_16px_rgba(40,255,120,0.1)]'
      : 'bg-[rgba(16,16,20,0.92)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_14px_rgba(255,40,40,0.05)]',
  ].join(' ');
}

/** App-Header: Glas-Icon-Buttons. */
export function dsGlassIconButtonClass(): string {
  return [
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent sm:h-10 sm:w-10',
    'bg-[rgba(16,16,20,0.72)] text-white',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(255,30,30,0.06),0_4px_16px_rgba(0,0,0,0.32)]',
    'backdrop-blur-md transition-[background,box-shadow] duration-150',
    'hover:bg-[rgba(22,18,20,0.82)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_rgba(255,30,30,0.09)]',
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-red-500/35',
  ].join(' ');
}

/** Trainer-/Rollen-Pill im Header. */
export function dsTrainerPillClass(): string {
  return [
    'max-w-[6.5rem] truncate rounded-full border border-transparent px-3 py-1 text-center',
    'bg-[rgba(16,16,20,0.78)] text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-300',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_16px_rgba(255,30,30,0.06)]',
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
  return 'inline-flex h-[20px] items-center rounded-md border border-transparent bg-[rgba(16,16,20,0.88)] px-1.5 text-[9px] font-bold uppercase tracking-wide text-[#9A9AA0]';
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
  'border border-white/[0.06] bg-[rgba(10,10,12,0.94)] text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-[rgba(14,12,14,0.96)] hover:text-white/58';

const SEGMENT_TRACK =
  'flex overflow-hidden rounded-[12px] border border-transparent bg-[rgba(16,16,20,0.92)] p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_16px_rgba(255,40,40,0.05)]';

export function dsSegmentTrackClass(): string {
  return SEGMENT_TRACK;
}

export function dsFormationTabClass(active: boolean): string {
  return [
    'h-7 shrink-0 rounded-[12px] px-2 text-[10px] font-semibold leading-none transition-[background,box-shadow] duration-150 sm:px-2.5 sm:text-[11px]',
    active
      ? `border border-transparent ${PRIMARY_GRADIENT} text-white ${PRIMARY_ACTIVE_GLOW}`
      : TAB_INACTIVE,
  ].join(' ');
}

export function dsSegmentTabClass(active: boolean): string {
  return [
    'flex-1 rounded-[10px] px-2 text-center text-sm font-semibold transition-[background,box-shadow,color] duration-150',
    active
      ? `border border-transparent ${PRIMARY_GRADIENT} text-white ${PRIMARY_ACTIVE_GLOW}`
      : 'bg-transparent text-white/40 hover:text-white/58',
  ].join(' ');
}

/** Termine-Filter (Alle / Spiele / Training / Kommende). */
export function dsScheduleFilterTabClass(active: boolean): string {
  return [
    'min-h-[36px] flex-1 rounded-[14px] px-2.5 text-[12px] font-semibold tracking-[0.01em] transition-all duration-150',
    active
      ? `border border-[rgba(122,29,42,0.32)] ${PRIMARY_GRADIENT} text-white ${PRIMARY_ACTIVE_GLOW}`
      : 'border border-transparent text-white/45 hover:bg-[rgba(14,14,18,0.75)] hover:text-white/62',
  ].join(' ');
}

/** Live Hub: Übersicht / Aufstellung / Liveticker / Statistik. */
export function dsLiveHubNavBtnClass(): string {
  return [
    'flex min-h-[46px] w-full touch-manipulation items-center justify-center rounded-[22px]',
    'border border-white/[0.08] bg-[rgba(12,12,16,0.9)] px-3 py-2.5',
    dsButtonTextClass(),
    'text-white/88 backdrop-blur-xl',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_22px_rgba(0,0,0,0.42)]',
    'transition-[border-color,background,box-shadow,color] duration-150',
    'hover:border-[rgba(255,75,92,0.22)] hover:bg-[rgba(16,12,14,0.94)] hover:text-white',
    'hover:shadow-[0_0_24px_rgba(255,45,85,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]',
    'active:scale-[0.98] sm:min-h-[48px]',
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
  return `${base} ${PRIMARY_GRADIENT} text-white ${PRIMARY_ACTIVE_GLOW}`;
}

/** Wechsel: Spalten-Ambient (subtil). */
export function dsWechselColumnAmbientClass(side: 'out' | 'in'): string {
  if (side === 'out') {
    return 'rounded-[16px] bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(255,30,30,0.05),transparent_72%)] p-0.5';
  }
  return 'rounded-[16px] bg-[radial-gradient(ellipse_90%_80%_at_100%_0%,rgba(40,255,120,0.04),transparent_72%)] p-0.5';
}

/** Wechsel-Screen: Spieler-Pick-Zeile (Matchday-Panel). */
export function dsWechselPickRowClass(opts: {
  selected?: boolean;
  recommended?: boolean;
  side?: 'out' | 'in';
}): string {
  const ambient =
    opts.side === 'in'
      ? 'bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(40,255,120,0.04),transparent_65%)]'
      : opts.side === 'out'
        ? 'bg-[radial-gradient(ellipse_80%_70%_at_0%_0%,rgba(255,30,30,0.05),transparent_65%)]'
        : '';
  const base = [
    'flex h-[61px] min-h-[58px] max-h-[66px] shrink-0 items-center gap-1.5 rounded-[18px] border border-transparent px-2 py-1.5 text-left transition-all active:scale-[0.99]',
    DS_CARD_BG_MATCHDAY,
    ambient,
    CARD_SHADOW,
  ].join(' ');
  if (opts.selected) {
    if (opts.side === 'in') {
      return `${base} shadow-[0_0_28px_rgba(40,255,120,0.14)] ring-1 ring-emerald-500/30`;
    }
    return `${base} shadow-[0_0_28px_rgba(255,40,40,0.16)] ring-1 ring-red-500/28`;
  }
  if (opts.recommended) {
    return `${base} shadow-[0_0_20px_rgba(40,255,120,0.08)] ring-1 ring-emerald-500/22`;
  }
  return `${base} hover:shadow-[0_0_36px_rgba(255,40,40,0.12)]`;
}

export function dsStickyCtaBarClass(): string {
  return 'fixed inset-x-0 z-[70] border-t border-transparent bg-[rgba(6,6,8,0.88)] px-4 py-2.5 shadow-[0_-10px_36px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,30,30,0.04)] backdrop-blur-xl';
}

export function dsPrimaryCtaClass(): string {
  return [
    'rounded-[22px] border border-[rgba(122,29,42,0.25)]',
    PRIMARY_GRADIENT,
    'px-4 py-2.5 text-white tracking-[0.02em]',
    dsButtonTextClass(),
    PRIMARY_GLOW,
    'transition-[box-shadow,transform] duration-150',
    PRIMARY_GLOW_HOVER,
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}

export function dsSecondaryCtaClass(): string {
  return [
    'inline-flex min-h-[44px] items-center justify-center rounded-[22px] border border-white/10',
    'bg-[rgba(14,14,18,0.92)] text-[#F2F2F2]',
    'px-4 py-2.5 tracking-[0.01em]',
    dsButtonTextClass(),
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_18px_rgba(122,29,42,0.08),0_4px_16px_rgba(0,0,0,0.3)]',
    'transition-[background,box-shadow] duration-150',
    'hover:bg-[rgba(18,14,16,0.94)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_22px_rgba(122,29,42,0.1)]',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
  ].join(' ');
}

/** Termine-Seite: schwarze Basis, Rot nur als Ambient. */
export function dsSchedulePageStyle(): { background: string; boxShadow: string } {
  return {
    background:
      'radial-gradient(ellipse 100% 55% at 50% 0%, rgba(122,29,42,0.06), transparent 52%), radial-gradient(circle at 50% 0%, rgba(58,18,24,0.08), transparent 48%), linear-gradient(180deg, #121214 0%, #0A0A0C 100%)',
    boxShadow: 'inset 0 0 100px rgba(0,0,0,0.45)',
  };
}

/** Hero „Nächstes Training/Spiel“ — Premium Matchday, Flutlicht, Fog. */
export function dsScheduleHeroPanelClass(): string {
  return [
    'relative overflow-hidden rounded-[22px]',
    'border border-[rgba(122,29,42,0.42)]',
    'bg-[linear-gradient(152deg,rgba(36,32,34,0.99)_0%,rgba(24,22,24,0.99)_36%,rgba(12,12,14,0.99)_68%,rgba(20,10,14,0.99)_100%)]',
    'shadow-[0_24px_60px_rgba(0,0,0,0.72),0_0_64px_rgba(122,29,42,0.28),inset_0_1px_0_rgba(255,255,255,0.07)]',
  ].join(' ');
}

export function dsScheduleHeroPanelGlowClass(): string {
  return [
    'pointer-events-none absolute inset-0',
    'bg-[radial-gradient(ellipse_110%_78%_at_100%_-16%,rgba(255,242,225,0.16)_0%,rgba(122,29,42,0.3)_24%,transparent_66%),radial-gradient(ellipse_90%_60%_at_0%_0%,rgba(122,29,42,0.16)_0%,transparent_52%),radial-gradient(ellipse_98%_50%_at_50%_100%,rgba(58,18,24,0.14)_0%,transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.09)_0%,transparent_42%)]',
  ].join(' ');
}

/** Datum-Box im Hero — schmal wie Liste, etwas höher. */
export function dsScheduleHeroDateBoxClass(): string {
  return [
    'flex w-[70px] shrink-0 flex-col items-start justify-center gap-0.5 rounded-[12px]',
    'border border-white/[0.10] bg-transparent px-1.5 py-1.5 leading-none',
  ].join(' ');
}

export function dsScheduleHeroDateBoxWeekdayClass(): string {
  return 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B85C68]';
}

export function dsScheduleHeroDateBoxDayClass(): string {
  return 'text-[1.65rem] font-bold tabular-nums leading-none text-white';
}

export function dsScheduleHeroDateBoxMonthClass(): string {
  return 'text-[10px] font-medium leading-tight text-[#B8B0B4]';
}

/** Weitere Termine — sekundär, flach und dunkel. */
export function dsScheduleListPanelClass(): string {
  return [
    'relative overflow-hidden rounded-[12px]',
    'border border-white/[0.015]',
    'bg-[linear-gradient(180deg,rgba(4,4,6,0.99)_0%,rgba(2,2,4,0.99)_100%)]',
    'shadow-[0_1px_4px_rgba(0,0,0,0.22)]',
  ].join(' ');
}

export function dsScheduleListPanelGlowClass(): string {
  return 'pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.002)_0%,transparent_5%)]';
}

/** Termin-Detail / Hero-Footer: ruhige Action-Zeilen (Dark Glass). */
export function dsScheduleActionRowClass(opts?: { danger?: boolean }): string {
  const base = [
    'flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3',
    'bg-[rgba(12,12,14,0.94)] backdrop-blur-sm',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    'transition-[background,border-color,transform] duration-150',
    'hover:bg-[rgba(18,16,18,0.97)] active:scale-[0.99]',
    'disabled:cursor-not-allowed disabled:opacity-45',
  ];
  if (opts?.danger) {
    return [
      ...base,
      'border-[rgba(122,29,42,0.22)] text-[#D4A0A8]',
      'hover:border-[rgba(122,29,42,0.34)]',
    ].join(' ');
  }
  return [
    ...base,
    'border-white/[0.08] text-white/88',
    'hover:border-white/[0.12]',
  ].join(' ');
}

/** @deprecated Alias — Listenkarten */
export function dsScheduleEventPanelClass(): string {
  return dsScheduleListPanelClass();
}

export function dsScheduleEventPanelGlowClass(): string {
  return dsScheduleListPanelGlowClass();
}

/** Mehr-Hub: subtiler Page-Hintergrund (weniger Vollflächen-Rot). */
export function dsMoreHubPageStyle(): { background: string; boxShadow: string } {
  return {
    background:
      'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(255,30,30,0.05), transparent 52%), radial-gradient(circle at 50% 0%, rgba(120,0,0,0.12), transparent 50%), linear-gradient(180deg, #090909 0%, #050505 100%)',
    boxShadow: 'inset 0 0 80px rgba(0,0,0,0.35)',
  };
}
