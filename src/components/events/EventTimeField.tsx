import React from 'react';
import { TimeInput24h } from '../ui/TimeInput24h';
import { cn } from '../../ui/lib/cn';
import { EVENT_FORM_INPUT_CLASS } from './eventFormStyles';

type Props = {
  id?: string;
  value: string;
  onChange: (hhmm: string) => void;
  className?: string;
  disabled?: boolean;
  /** z. B. „Beginn“ / „Treffpunkt“ */
  label?: string;
  placeholder?: string;
};

/**
 * 24h-Zeit wie „Neuer Termin“ / Meisterschaft: gemeinsamer TimeInput24h (HH:mm, kein AM/PM).
 */
export function EventTimeField({
  id,
  value,
  onChange,
  className,
  disabled,
  label = 'Uhrzeit',
  placeholder = '--:--',
}: Props) {
  return (
    <TimeInput24h
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      label={label}
      placeholder={placeholder}
      className={cn(EVENT_FORM_INPUT_CLASS, className)}
    />
  );
}
