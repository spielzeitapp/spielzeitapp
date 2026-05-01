import React from 'react';
import { Button } from '../../app/components/ui/Button';

type Props = {
  isTraining: boolean;
  onOpenAttendance: () => void;
  disabled?: boolean;
  /** Hero: etwas größere Touch-Fläche */
  variant?: 'default' | 'hero';
};

/** Eltern/Spieler: öffnet dasselbe Zu-/Absage-Modal wie der Chip auf der Karte. */
export function AttendanceActionRow({
  isTraining,
  onOpenAttendance,
  disabled = false,
  variant = 'default',
}: Props) {
  const isHero = variant === 'hero';
  return (
    <div
      className={`flex flex-wrap gap-2 ${isHero ? 'mt-3' : 'mt-2'}`}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="Teilnahme"
    >
      <Button
        type="button"
        variant="primary"
        size={isHero ? 'sm' : 'xs'}
        className={`rounded-full ${isHero ? 'min-h-[40px] flex-1 sm:flex-none' : ''}`}
        disabled={disabled}
        onClick={onOpenAttendance}
      >
        {isTraining ? 'Absage / Status' : 'Zu- / Absage'}
      </Button>
    </div>
  );
}
