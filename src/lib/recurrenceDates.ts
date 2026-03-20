/** Wiederholungstyp für Termin-Erstellung (kein RRULE in DB – echte Zeilen pro Termin). */
export type RecurrenceKind = 'once' | 'weekly' | 'biweekly';

/**
 * Erzeugt Start-Zeitpunkte für alle Vorkommen zwischen erstem Start und Stichtag (inkl.).
 */
export function enumerateOccurrenceStarts(
  firstStart: Date,
  recurrence: RecurrenceKind,
  untilInclusive: Date,
  max = 120,
): Date[] {
  if (recurrence === 'once') return [new Date(firstStart.getTime())];
  const step = recurrence === 'weekly' ? 7 : 14;
  const out: Date[] = [];
  const end = new Date(untilInclusive);
  end.setHours(23, 59, 59, 999);
  let cur = new Date(firstStart.getTime());
  while (cur <= end && out.length < max) {
    out.push(new Date(cur.getTime()));
    cur.setDate(cur.getDate() + step);
  }
  return out;
}
