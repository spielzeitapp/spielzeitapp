import type { EventRow } from '../hooks/useEvents';
import {
  formatEventDateLongVienna,
  formatEventTimeVienna,
} from './notifications/format';

/** Treffpunkt: Uhrzeit (meeting_at) + Ort (location/address), Europe/Vienna. */
export function formatPushTreffpunkt(ev: EventRow): string {
  const loc = [ev.location, ev.address].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
  const meet =
    ev.meeting_at && !Number.isNaN(new Date(ev.meeting_at).getTime())
      ? formatEventTimeVienna(ev.meeting_at)
      : '';
  if (meet && loc) return `${meet} · ${loc}`;
  if (meet) return meet;
  if (loc) return loc;
  return '';
}

/**
 * Ersetzt Platzhalter in Titel/Text für Team-Push.
 * Ohne `event` werden alle bekannten Platzhalter durch leere Strings ersetzt.
 */
export function applyPushTemplatePlaceholders(
  text: string,
  event: EventRow | null,
  teamName: string,
): string {
  const gegner = (event?.opponent ?? '').trim();
  const treffpunkt = event ? formatPushTreffpunkt(event) : '';
  const starts = event?.starts_at;
  const anpfiff = starts && !Number.isNaN(new Date(starts).getTime()) ? formatEventTimeVienna(starts) : '';
  const datum =
    starts && !Number.isNaN(new Date(starts).getTime()) ? formatEventDateLongVienna(starts) : '';
  const uhrzeit = anpfiff;
  const team = (teamName ?? '').trim();

  return text
    .replaceAll('{gegner}', gegner)
    .replaceAll('{treffpunkt}', treffpunkt)
    .replaceAll('{anpfiff}', anpfiff)
    .replaceAll('{datum}', datum)
    .replaceAll('{uhrzeit}', uhrzeit)
    .replaceAll('{team}', team);
}
