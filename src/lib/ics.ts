type IcsEventType = 'game' | 'training' | 'event' | 'other';

export type IcsEventLike = {
  id: string;
  team_season_id?: string | null;
  kind?: string | null;
  event_type?: string | null;
  match_type?: string | null;
  opponent?: string | null;
  is_home?: boolean | null;
  title?: string | null;
  notes?: string | null;
  location?: string | null;
  meetup_at?: string | null;
  starts_at?: string | null;
  // For "stable UID"; others optional
  status?: string | null;
};

function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsDateUtc(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  const iso = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return iso
    .replace(/[-:]/g, '')
    .replace('Z', 'Z'); // keep trailing Z
}

function parseEndTimeFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  // e.g. "Ende: 19:30 Uhr"
  const m = notes.match(/ende:\s*(\d{1,2}):(\d{2})\s*uhr/i);
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2])).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getEffectiveEventType(e: IcsEventLike): IcsEventType {
  const raw = ((e.event_type ?? '') as string).trim().toLowerCase();
  if (raw === 'game' || raw === 'training' || raw === 'event' || raw === 'other') return raw;
  if (e.kind === 'training') return 'training';
  if (e.kind === 'event') return 'event';
  return 'game';
}

function parseNotesParts(notes: string | null | undefined) {
  const parts = (notes ?? '').split(' · ').map((p) => p.trim()).filter(Boolean);
  const title = parts[0] ?? null;
  const endRaw = parts.find((p) => p.toLowerCase().startsWith('ende:')) ?? null;
  const descriptionParts = parts.filter((p) => !p.toLowerCase().startsWith('ende:') && p !== title);
  const descriptionText = descriptionParts.length ? descriptionParts.join(' · ') : null;
  return { title, endRaw, descriptionText, parts };
}

function computeEventEndDate(e: IcsEventLike, startDate: Date): Date {
  const rawEnd = parseEndTimeFromNotes(e.notes);
  if (rawEnd) {
    const [hh, mm] = rawEnd.split(':');
    const end = new Date(startDate);
    end.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    return end;
  }

  const t = getEffectiveEventType(e);
  const fallbackMin = t === 'event' ? 60 : 90; // game + training => 90; event => 60
  return new Date(startDate.getTime() + fallbackMin * 60 * 1000);
}

function safeUrl(url: string): string {
  try {
    // Avoid invalid URLs breaking iCal consumers
    // eslint-disable-next-line no-new
    new URL(url);
    return url;
  } catch {
    return '';
  }
}

export function generateEventIcs(
  e: IcsEventLike,
  opts: { appBaseUrl: string; uidDomain?: string }
): string {
  const startDate = e.starts_at ? new Date(e.starts_at) : null;
  if (!startDate || isNaN(startDate.getTime())) {
    // Minimal valid VEVENT to avoid crashing exports
    return [
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(`${e.id}@${opts.uidDomain ?? 'spielzeitapp.at'}`)}`,
      'DTSTAMP:' + formatIcsDateUtc(new Date()),
      'SUMMARY:' + escapeIcsText('Unbekannter Termin'),
      'END:VEVENT',
    ].join('\r\n');
  }

  const endDate = computeEventEndDate(e, startDate);
  const type = getEffectiveEventType(e);

  const { title: notesTitle, descriptionText } = parseNotesParts(e.notes);

  const summary =
    type === 'game'
      ? `Spiel: ${e.opponent ?? 'Termin'}`
      : type === 'training'
        ? `Training: ${notesTitle ?? e.title ?? 'Training'}`
        : type === 'event'
          ? `${notesTitle ?? e.title ?? 'Event'}`
          : `${notesTitle ?? e.title ?? 'Termin'}`;

  const meetupTimeOnly = e.meetup_at ? new Date(e.meetup_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : null;
  const location = e.location ?? null;

  const eventUrl = safeUrl(`${opts.appBaseUrl}/app/events/${e.id}`);

  const descriptionLines: string[] = [];
  if (location && location.trim()) descriptionLines.push(`Ort: ${location.trim()}`);
  if (meetupTimeOnly) descriptionLines.push(`Treffpunkt: ${meetupTimeOnly}`);
  if (descriptionText && descriptionText.trim()) descriptionLines.push(`Beschreibung: ${descriptionText.trim()}`);
  if (descriptionText && descriptionText.trim()) descriptionLines.push(`Hinweise: ${descriptionText.trim()}`);
  if (eventUrl) descriptionLines.push(`Link zur App: ${eventUrl}`);

  // If no description lines, still provide something minimal
  const description = descriptionLines.length ? descriptionLines.join('\n') : `Link zur App: ${eventUrl}`;

  const uid = `${e.id}@${opts.uidDomain ?? 'spielzeitapp.at'}`;

  return [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatIcsDateUtc(new Date())}`,
    `DTSTART:${formatIcsDateUtc(startDate)}`,
    `DTEND:${formatIcsDateUtc(endDate)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    location && location.trim() ? `LOCATION:${escapeIcsText(location.trim())}` : undefined,
    eventUrl ? `URL:${escapeIcsText(eventUrl)}` : undefined,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'END:VEVENT',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function generateCalendarIcs(
  events: IcsEventLike[],
  opts: { appBaseUrl: string; calendarName?: string; uidDomain?: string }
): string {
  const dtstamp = formatIcsDateUtc(new Date());
  const name = opts.calendarName ?? 'SpielzeitApp Termine';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SpielzeitApp//iCal//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    `X-WR-TIMEZONE:UTC`,
    `X-APPLE-CALENDAR-COLOR:#b91c1c`,
    `DTSTAMP:${dtstamp}`,
    ...events.map((e) => generateEventIcs(e, opts)),
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadEventIcs(
  e: IcsEventLike,
  opts: { appBaseUrl: string; uidDomain?: string }
) {
  const ics = generateEventIcs(e, opts);
  downloadTextFile(`spielzeitapp-${e.id}.ics`, ics);
}

export function downloadCalendarIcs(
  events: IcsEventLike[],
  opts: { appBaseUrl: string; calendarName?: string; uidDomain?: string }
) {
  const ics = generateCalendarIcs(events, opts);
  const safeName = (opts.calendarName ?? 'spielzeitapp').replace(/[^\w\-]+/g, '-').toLowerCase();
  downloadTextFile(`spielzeitapp-kalender-${safeName}.ics`, ics);
}

