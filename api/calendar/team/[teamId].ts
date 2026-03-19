import { createClient } from '@supabase/supabase-js';

type ApiEventRow = {
  id: string;
  team_season_id: string;
  kind: string | null;
  event_type?: string | null;
  opponent: string | null;
  location: string | null;
  starts_at: string;
  meetup_at: string | null;
  notes: string | null;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
};

function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function parseEndTimeFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/ende:\s*(\d{1,2}):(\d{2})\s*uhr/i);
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2])).padStart(2, '0');
  return `${hh}:${mm}`;
}

function effectiveType(ev: ApiEventRow): 'game' | 'training' | 'event' | 'other' {
  const raw = (ev.event_type ?? '').trim().toLowerCase();
  if (raw === 'game' || raw === 'training' || raw === 'event' || raw === 'other') return raw;
  if ((ev.kind ?? '').trim().toLowerCase() === 'training') return 'training';
  if ((ev.kind ?? '').trim().toLowerCase() === 'event') return 'event';
  return 'game';
}

function notesTitleAndDescription(notes: string | null | undefined): { title: string | null; description: string | null } {
  const parts = (notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const title = parts[0] ?? null;
  const description = parts
    .slice(1)
    .filter((p) => !p.toLowerCase().startsWith('ende:'))
    .join(' · ')
    .trim();
  return { title, description: description || null };
}

function resolveEndDate(ev: ApiEventRow, startDate: Date): Date {
  const parsed = parseEndTimeFromNotes(ev.notes);
  if (parsed) {
    const [hh, mm] = parsed.split(':');
    const d = new Date(startDate);
    d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    return d;
  }
  const t = effectiveType(ev);
  const addMin = t === 'event' ? 60 : 90;
  return new Date(startDate.getTime() + addMin * 60 * 1000);
}

function buildSummary(ev: ApiEventRow, teamName: string): string {
  const t = effectiveType(ev);
  const notes = notesTitleAndDescription(ev.notes);
  if (t === 'game') {
    return `${teamName} Spiel: ${teamName} vs ${ev.opponent ?? 'Gegner'}`;
  }
  if (t === 'training') {
    return `${teamName} Training`;
  }
  return notes.title ?? 'Event';
}

function buildDescription(ev: ApiEventRow, appBaseUrl: string): string {
  const notes = notesTitleAndDescription(ev.notes);
  const meetup = ev.meetup_at
    ? new Date(ev.meetup_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
    : null;
  const eventUrl = `${appBaseUrl}/app/events/${ev.id}`;
  const lines: string[] = [];
  if (meetup) lines.push(`Treffpunkt: ${meetup}`);
  if (notes.description) lines.push(`Hinweise: ${notes.description}`);
  if (notes.description) lines.push(`Trainerinfo: ${notes.description}`);
  lines.push(`Link zur SpielzeitApp: ${eventUrl}`);
  return lines.join('\n');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const teamId = req.query?.teamId;
  if (!teamId || typeof teamId !== 'string') {
    res.status(400).send('Missing teamId');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).send('Server not configured');
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: teamData } = await admin
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .maybeSingle();
  const teamName = (teamData as any)?.name ?? 'Team';

  const { data: teamSeasons, error: tsError } = await admin
    .from('team_seasons')
    .select('id, team_id')
    .eq('team_id', teamId);

  if (tsError) {
    res.status(500).send(tsError.message);
    return;
  }

  const teamSeasonIds = ((teamSeasons ?? []) as TeamSeasonRow[]).map((t) => t.id);
  if (teamSeasonIds.length === 0) {
    const emptyCal = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SpielzeitApp//TeamFeed//DE',
      'CALSCALE:GREGORIAN',
      `X-WR-CALNAME:${escapeIcsText(`${teamName} Termine`)}`,
      'END:VCALENDAR',
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(emptyCal);
    return;
  }

  const nowIso = new Date().toISOString();
  const { data: events, error: evError } = await admin
    .from('events')
    .select('id, team_season_id, kind, event_type, opponent, location, starts_at, meetup_at, notes')
    .in('team_season_id', teamSeasonIds)
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true });

  if (evError) {
    res.status(500).send(evError.message);
    return;
  }

  const appBaseUrl = process.env.APP_BASE_URL || `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}`;
  const dtstamp = toIcsUtc(new Date());
  const vevents = ((events ?? []) as ApiEventRow[]).map((ev) => {
    const start = new Date(ev.starts_at);
    const end = resolveEndDate(ev, start);
    const summary = buildSummary(ev, teamName);
    const description = buildDescription(ev, appBaseUrl);

    return [
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(`${ev.id}@spielzeitapp.at`)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      ev.location ? `LOCATION:${escapeIcsText(ev.location)}` : undefined,
      `DESCRIPTION:${escapeIcsText(description)}`,
      'END:VEVENT',
    ]
      .filter(Boolean)
      .join('\r\n');
  });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SpielzeitApp//TeamFeed//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`${teamName} Termine`)}`,
    'X-WR-TIMEZONE:UTC',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(ics);
}

