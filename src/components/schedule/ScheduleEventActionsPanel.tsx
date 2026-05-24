import React from 'react';
import { ChevronRight } from 'lucide-react';
import { dsPrimaryCtaClass, dsScheduleActionRowClass, dsScheduleDetailCalendarRowClass } from '../../lib/premiumDesignSystem';

export type ScheduleEventActionRow = {
  key?: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Einzelner Primary-CTA (z. B. Zum Livespiel). */
  emphasis?: 'primary';
};

type Props = {
  rows: ScheduleEventActionRow[];
  className?: string;
  'aria-label'?: string;
};

/** Dark-Glass Action-Liste unter Hero / auf Termin-Detail (nur UI). */
export function ScheduleEventActionsPanel({ rows, className = '', 'aria-label': ariaLabel }: Props) {
  if (rows.length === 0) return null;

  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      role="toolbar"
      aria-label={ariaLabel ?? 'Termin-Aktionen'}
      onClick={(e) => e.stopPropagation()}
    >
      {rows.map((row, i) => {
        const isPrimary = row.emphasis === 'primary';
        const isCalendar = row.key === 'calendar';
        return (
          <button
            key={row.key ?? `${row.label}-${i}`}
            type="button"
            disabled={row.disabled}
            onClick={row.onClick}
            className={
              isPrimary
                ? `inline-flex w-full min-h-[52px] items-center justify-center gap-2 ${dsPrimaryCtaClass()}`
                : isCalendar
                  ? dsScheduleDetailCalendarRowClass()
                  : dsScheduleActionRowClass({ danger: row.danger })
            }
          >
            {row.icon && !isPrimary ? (
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${isCalendar ? 'text-[#B85C68]' : 'text-white/65'}`}>{row.icon}</span>
            ) : null}
            <span className={`min-w-0 flex-1 text-left text-[15px] font-medium ${isPrimary ? 'text-center' : ''}`}>
              {row.label}
            </span>
            {!isPrimary ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-white/28" strokeWidth={2} aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-white/75" strokeWidth={2} aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
