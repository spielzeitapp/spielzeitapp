import { ATTENDANCE_STAT_BOX_LAZ } from '../../lib/attendanceColors';
import type { DsChipTone } from '../../lib/premiumDesignSystem';

type AttendanceStatTone = DsChipTone | 'participation';

const STAT_BOX_BASE =
  'flex min-h-[4.75rem] flex-col items-center justify-center rounded-[16px] border px-2 py-2.5 text-center';

const STAT_BOX_TONE: Record<DsChipTone, string> = {
  present:
    'border-[rgba(40,255,120,0.14)] bg-[radial-gradient(ellipse_92%_82%_at_50%_0%,rgba(40,255,120,0.13)_0%,rgba(9,12,10,0.97)_54%,rgba(8,10,9,0.98)_100%)] text-[#9DFFC5] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_26px_rgba(40,255,120,0.11),0_8px_24px_rgba(0,0,0,0.38)]',
  absent:
    'border-[rgba(255,45,85,0.12)] bg-[radial-gradient(ellipse_96%_78%_at_50%_100%,rgba(110,16,28,0.2)_0%,rgba(11,8,10,0.97)_52%,rgba(10,8,9,0.98)_100%)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_rgba(255,45,85,0.14),0_8px_24px_rgba(0,0,0,0.4)]',
  sick:
    'border-[rgba(80,160,255,0.14)] bg-[radial-gradient(ellipse_90%_72%_at_50%_0%,rgba(60,130,220,0.16)_0%,rgba(10,12,18,0.97)_48%,rgba(8,10,14,0.98)_100%)] text-[#8EC5FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_22px_rgba(80,160,255,0.1),0_8px_24px_rgba(0,0,0,0.38)]',
  injured:
    'border-[rgba(255,160,60,0.13)] bg-[radial-gradient(ellipse_90%_72%_at_50%_0%,rgba(255,138,0,0.15)_0%,rgba(14,11,9,0.96)_48%,rgba(12,10,9,0.97)_100%)] text-[#FFC078] shadow-[inset_0_1px_0_rgba(255,200,120,0.06),0_0_22px_rgba(255,138,0,0.12),0_8px_24px_rgba(0,0,0,0.38)]',
  external: ATTENDANCE_STAT_BOX_LAZ,
  open:
    'border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,12,0.97)] text-[#AEAEB2] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.38)]',
  neutral:
    'border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,12,0.97)] text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.38)]',
  selected:
    'border-[rgba(255,45,85,0.12)] bg-[radial-gradient(ellipse_96%_78%_at_50%_100%,rgba(110,16,28,0.18)_0%,rgba(11,8,10,0.97)_52%,rgba(10,8,9,0.98)_100%)] text-[#FF9AA6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_22px_rgba(255,45,85,0.12)]',
};

const PARTICIPATION_BOX =
  'border-[rgba(255,255,255,0.1)] bg-[radial-gradient(ellipse_90%_80%_at_50%_0%,rgba(220,38,38,0.08)_0%,rgba(11,10,12,0.98)_55%,rgba(7,7,9,0.99)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_18px_rgba(220,38,38,0.06),0_8px_24px_rgba(0,0,0,0.38)]';

const STAT_LABEL_CLASS =
  'text-[9px] font-medium uppercase tracking-[0.08em] text-[#8E8E93] leading-[1.45]';

const STAT_VALUE_CLASS = 'mt-1.5 text-[25px] font-bold tabular-nums leading-none tracking-tight text-inherit';

export function AttendanceStatCard({ label, value, tone, hint }: {
  label: string;
  value: number | string;
  tone: AttendanceStatTone;
  hint?: string;
}) {
  return (
    <div className={`${STAT_BOX_BASE} ${tone === 'participation' ? PARTICIPATION_BOX : STAT_BOX_TONE[tone]}`}>
      <span className={STAT_LABEL_CLASS}>{label}</span>
      <span className={STAT_VALUE_CLASS}>{value}</span>
      {hint && <span className="mt-1 text-[10px] leading-snug text-white/50">{hint}</span>}
    </div>
  );
}
