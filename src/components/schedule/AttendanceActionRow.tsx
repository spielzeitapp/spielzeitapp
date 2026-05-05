import React from 'react';
import { Button } from '../../app/components/ui/Button';

type Props = {
  isTraining: boolean;
  onOpenAttendance: () => void;
  disabled?: boolean;
  /** Hero: etwas größere Touch-Fläche; compact: dezente Liste ohne großen Primary-Block */
  variant?: 'default' | 'hero' | 'compact';
  /** compact: Zu-/Absage als starker Primary-CTA unter der Hero-Karte */
  compactPrimary?: boolean;
};

/** Eltern/Spieler: öffnet dasselbe Zu-/Absage-Modal wie der Chip auf der Karte. */
export function AttendanceActionRow({
  isTraining,
  onOpenAttendance,
  disabled = false,
  variant = 'default',
  compactPrimary = false,
}: Props) {
  const isHero = variant === 'hero';
  const isCompact = variant === 'compact';
  if (isCompact) {
    return (
      <div className="mt-0 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()} role="group" aria-label="Teilnahme">
        <Button
          type="button"
          variant={compactPrimary ? 'primary' : 'pending'}
          size="xs"
          className={
            compactPrimary
              ? 'h-10 min-h-[2.5rem] px-3 text-[11px] font-semibold'
              : 'h-10 min-h-[2.5rem] px-3 text-[11px] font-semibold'
          }
          disabled={disabled}
          onClick={onOpenAttendance}
        >
          {isTraining ? 'Absage / Status' : 'Zu- / Absage'}
        </Button>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-wrap gap-2 ${isHero ? 'mt-3' : 'mt-2'}`}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="Teilnahme"
    >
      <Button
        type="button"
        variant={isTraining ? 'negative' : 'pending'}
        size={isHero ? 'sm' : 'xs'}
        className={`${isHero ? 'min-h-[40px] flex-1 sm:flex-none' : ''}`}
        disabled={disabled}
        onClick={onOpenAttendance}
      >
        {isTraining ? 'Absage / Status' : 'Zu- / Absage'}
      </Button>
    </div>
  );
}
