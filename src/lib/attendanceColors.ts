/**
 * Teilnahme-Farbschema (Dark Stadium UI) – nur Styling.
 *
 * | Status   | Text (Hex) | Hintergrund (typ.)        | Rand / Glow (typ.)              |
 * |----------|------------|---------------------------|---------------------------------|
 * | Dabei    | #FFFFFF    | emerald-600/85            | emerald-400/45, Glow emerald    |
 * | LAZ      | #5DBF94    | rgba(10,38,30,0.78)       | rgba(32,96,74,0.30), dezenter Glow |
 * | Verletzt | #FFB15A    | rgba(110,52,8,0.34)       | orange / amber                  |
 * | Abwesend | #FFFFFF    | red-600/85                | red-400/45                      |
 * | Offen    | white/90   | zinc-700/75               | white/20                        |
 *
 * Chips / Premium (dsStatusChipClass): siehe premiumDesignSystem CHIP_TONE.
 * LAZ-Chip: text #5DBF94, bg rgba(12,44,34,0.30) – schwächer als Dabei-Chip (#9DFFC5).
 */

const PILL_BASE =
  'inline-flex shrink-0 items-center justify-center rounded-full border transition-all duration-200';

/** Dabei / Zusage – kräftiges Grün (Tailwind emerald). */
export const ATTENDANCE_PRESENT_PILL =
  'border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]';

/** LAZ – dezentes Stadium-Grün (kein kräftiges emerald wie Dabei). */
export const ATTENDANCE_LAZ_PILL_COLORS =
  'border-[rgba(32,96,74,0.30)] bg-[rgba(10,38,30,0.78)] text-[#5DBF94] shadow-[0_0_10px_rgba(28,88,68,0.12)]';

export const ATTENDANCE_LAZ_PILL = ATTENDANCE_LAZ_PILL_COLORS;

/** Abwesend / Absage – Rot. */
export const ATTENDANCE_ABSENT_PILL =
  'border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)]';

/** Offen (Spiele) – Neutral. */
export const ATTENDANCE_OPEN_PILL = 'border-white/20 bg-zinc-700/75 text-white/90';

export function attendancePresentPillClass(sizeClass: string, extra = ''): string {
  return [PILL_BASE, sizeClass, ATTENDANCE_PRESENT_PILL, extra].filter(Boolean).join(' ');
}

export function attendanceLazPillClass(sizeClass: string, extra = ''): string {
  return [PILL_BASE, sizeClass, ATTENDANCE_LAZ_PILL, extra].filter(Boolean).join(' ');
}

export function attendanceAbsentPillClass(sizeClass: string, extra = ''): string {
  return [PILL_BASE, sizeClass, ATTENDANCE_ABSENT_PILL, extra].filter(Boolean).join(' ');
}

export function attendanceOpenPillClass(sizeClass: string, extra = ''): string {
  return [PILL_BASE, sizeClass, ATTENDANCE_OPEN_PILL, extra].filter(Boolean).join(' ');
}

const RSVP_BTN_BASE =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] border font-semibold text-sm transition-[background,box-shadow,transform] duration-150 active:scale-[0.98]';

/** LAZ-Auswahl (Eltern Training-Detail) – aktiv vs. inaktiv. */
export function attendanceLazRsvpChoiceClass(active: boolean): string {
  return [
    RSVP_BTN_BASE,
    active
      ? 'border-[rgba(32,96,74,0.28)] bg-[rgba(12,44,34,0.55)] text-[#5DBF94] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_14px_rgba(28,88,68,0.12)]'
      : 'border-white/[0.07] bg-[rgba(14,14,18,0.92)] text-[#5DBF94]/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:text-[#5DBF94]/88',
  ].join(' ');
}

/** LAZ-Button im Schedule-Modal (aktiv hervorgehoben). */
export function attendanceLazModalButtonClass(active: boolean): string {
  return active
    ? 'border-[rgba(32,96,74,0.28)] text-[#5DBF94] bg-[rgba(12,44,34,0.4)]'
    : '';
}

/** Premium-Chip / Stat-Box LAZ (external). */
export const ATTENDANCE_CHIP_LAZ =
  'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(12,44,34,0.30)] text-[#5DBF94] shadow-[0_0_12px_rgba(28,88,68,0.08)]';

/** Premium-Chip Dabei (present). */
export const ATTENDANCE_CHIP_PRESENT =
  'h-[24px] px-2.5 text-[9px] font-bold uppercase tracking-[0.1em] leading-none bg-[rgba(20,110,70,0.34)] text-[#9DFFC5] shadow-[0_0_22px_rgba(40,255,120,0.14)]';

/** Training-Stat-Box LAZ (Trainer-Panel). */
export const ATTENDANCE_STAT_BOX_LAZ =
  'border-[rgba(32,96,74,0.14)] bg-[radial-gradient(ellipse_88%_72%_at_50%_50%,rgba(14,52,40,0.18)_0%,rgba(8,11,10,0.97)_54%,rgba(9,10,10,0.98)_100%)] text-[#5DBF94] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_16px_rgba(28,88,68,0.10),0_8px_24px_rgba(0,0,0,0.38)]';

/** Training-Aktionsbutton LAZ – aktiv. */
export const ATTENDANCE_ACTION_LAZ_ON =
  'border border-[rgba(32,96,74,0.26)] bg-[rgba(12,44,34,0.52)] text-[#5DBF94] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_16px_rgba(28,88,68,0.12)] backdrop-blur-sm';

/** Training-Aktionsbutton LAZ – inaktiv (Glass). */
export const ATTENDANCE_ACTION_GLASS_IDLE =
  'border border-white/[0.07] bg-[rgba(14,14,18,0.92)] text-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_14px_rgba(255,45,85,0.05)] hover:border-white/10 hover:bg-[rgba(18,14,16,0.94)] hover:text-white/76';
