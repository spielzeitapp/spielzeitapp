import { addViennaCalendarDaysToUtcIso } from './viennaTime';

/** Wiederholungstyp für Termin-Erstellung (kein RRULE in DB – echte Zeilen pro Termin). */
export type RecurrenceKind = 'once' | 'weekly' | 'biweekly';

/**
 * Start-Zeitpunkte zwischen erstem Start und Stichtag (inkl.), wöchentlich/14-tägig in **Europe/Vienna**.
 * @param firstStartUtcIso Erster Beginn als UTC-ISO (aus `parseViennaDateTimeLocalToUtcIso`)
 * @param untilInclusiveUtcIso Obergrenze inkl. (z. B. `viennaDateOnlyEndOfDayUtcIso` des „bis“-Datums)
 */
export function enumerateOccurrenceStarts(
  firstStartUtcIso: string,
  recurrence: RecurrenceKind,
  untilInclusiveUtcIso: string,
  max = 120,
): Date[] {
  if (recurrence === 'once') return [new Date(firstStartUtcIso)];

  const step = recurrence === 'weekly' ? 7 : 14;
  const out: Date[] = [];
  const endMs = new Date(untilInclusiveUtcIso).getTime();
  let curIso = firstStartUtcIso;

  while (new Date(curIso).getTime() <= endMs && out.length < max) {
    out.push(new Date(curIso));
    curIso = addViennaCalendarDaysToUtcIso(curIso, step);
  }

  return out;
}
