/**
 * ICS feed implementation — CommonJS for Vercel Node serverless (no ESM load errors).
 */
const { createClient } = require('@supabase/supabase-js');

function getEnv(name) {
  const g = globalThis;
  return g?.process?.env?.[name];
}

function escapeIcsText(input) {
  return String(input)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Gleiche Regeln wie `src/lib/calendarFeed.ts` */
const AGE_GROUP_NAME_PREFIX = /^\s*U\d{1,2}[a-z]?\s+/i;
const AGE_GROUP_SLUG_PREFIX = /^u\d{1,2}[a-z]?-/i;

function teamCalendarSlugFromTeamName(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'team';
}

function teamCalendarClubNameFromTeamName(name) {
  const stripped = String(name ?? '').replace(AGE_GROUP_NAME_PREFIX, '').trim();
  return stripped || String(name ?? '').trim() || 'Team';
}

function teamCalendarStableSlugFromTeamName(name) {
  return teamCalendarSlugFromTeamName(teamCalendarClubNameFromTeamName(name));
}

function teamCalendarSlugWithoutAgePrefix(slug) {
  return String(slug ?? '')
    .trim()
    .toLowerCase()
    .replace(AGE_GROUP_SLUG_PREFIX, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Slug → Team: exakter Legacy-Slug, stabiler Team-Slug, oder Legacy uNN-… → stabil.
 * So bleibt /u11-spg-rohrbach.ics nach U12-Wechsel gültig.
 */
function resolveTeamIdFromSlug(allTeams, slugWanted) {
  const slug = String(slugWanted ?? '').trim().toLowerCase();
  if (!slug) return null;
  const stableWanted = teamCalendarSlugWithoutAgePrefix(slug) || slug;

  const scored = [];
  for (const t of allTeams ?? []) {
    const full = teamCalendarSlugFromTeamName(t.name);
    const stable = teamCalendarStableSlugFromTeamName(t.name);
    let score = 0;
    if (full === slug) score = 3;
    else if (stable === slug) score = 2;
    else if (stable === stableWanted) score = 1;
    if (score > 0) scored.push({ id: t.id, score, name: t.name });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    console.warn('[ics-feed] ambiguous calendar slug; using first match', {
      slug,
      ids: scored.filter((s) => s.score === scored[0].score).map((m) => m.id),
    });
  }
  return scored[0].id;
}

function isUuidLike(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s).trim());
}

/** Live darf nie Staging-Links in DESCRIPTION/URL schreiben. */
function resolveAppBaseUrl(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (host === 'spielzeitapp.at' || host === 'www.spielzeitapp.at') {
    return 'https://spielzeitapp.at';
  }
  if (host === 'app.spielzeitapp.at') {
    return 'https://app.spielzeitapp.at';
  }
  const fromEnv = getEnv('APP_BASE_URL');
  if (fromEnv) return String(fromEnv).replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  return host ? `${proto}://${host}` : 'https://spielzeitapp.at';
}

function foldIcsLine(line) {
  const maxLen = 74;
  if (line.length <= maxLen) return line;
  const chunks = [];
  let rest = line;
  while (rest.length > maxLen) {
    chunks.push(rest.slice(0, maxLen));
    rest = rest.slice(maxLen);
  }
  if (rest.length) chunks.push(rest);
  return chunks.map((c, i) => (i === 0 ? c : ` ${c}`)).join('\r\n');
}

function buildIcsContent(lines) {
  return lines.map((line) => foldIcsLine(line)).join('\r\n');
}

function ensureCalendarPrefix(icsBody) {
  const requiredPrefix = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SpielzeitApp//iCal//DE'].join('\r\n');

  if (icsBody.startsWith(requiredPrefix)) return icsBody;

  const withoutLeadingCalendar = icsBody.replace(/^BEGIN:VCALENDAR[\s\S]*?METHOD:PUBLISH\r?\n?/m, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SpielzeitApp//iCal//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    withoutLeadingCalendar.trim(),
  ]
    .filter(Boolean)
    .join('\r\n');
}

function toIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function pickStableStamp(ev) {
  const raw = ev.updated_at ?? ev.created_at ?? ev.starts_at ?? null;
  if (!raw) return toIcsUtc(new Date());
  const d = new Date(raw);
  if (isNaN(d.getTime())) return toIcsUtc(new Date());
  return toIcsUtc(d);
}

function parseEndTimeFromNotes(notes) {
  if (!notes) return null;
  const m = notes.match(/ende:\s*(\d{1,2}):(\d{2})\s*uhr/i);
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2])).padStart(2, '0');
  return `${hh}:${mm}`;
}

function effectiveType(ev) {
  const raw = (ev.type ?? '').trim().toLowerCase();
  const kind = (ev.kind ?? '').trim().toLowerCase();
  if (raw === 'tournament' || kind === 'tournament') return 'tournament';
  if (raw === 'game' || raw === 'match' || raw === 'training' || raw === 'event' || raw === 'other') return raw;
  if (kind === 'training') return 'training';
  if (kind === 'event') return 'event';
  if (kind === 'game' || kind === 'match') return 'game';
  return 'game';
}

function notesTitleAndDescription(notes) {
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

function getDateTimePartsInTimeZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => {
    const v = parts.find((p) => p.type === type)?.value;
    return v ? Number(v) : null;
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function zonedTimeToUtcMillis({ year, month, day, hour, minute }, timeZone) {
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Start with "interpret as UTC"; then iteratively correct using the actual zone offset.
  let utcMillis = desiredUtc;
  for (let i = 0; i < 3; i++) {
    const parts = getDateTimePartsInTimeZone(new Date(utcMillis), timeZone);
    if (parts.year == null || parts.month == null || parts.day == null || parts.hour == null || parts.minute == null) {
      break;
    }
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    const diff = asUtc - desiredUtc;
    if (diff === 0) break;
    utcMillis -= diff;
  }
  return utcMillis;
}

function resolveEndDate(ev, startDate) {
  const parsed = parseEndTimeFromNotes(ev.notes);
  if (parsed) {
    const [hh, mm] = parsed.split(':');
    // Notes' "ende: HH:MM uhr" is in Europe/Vienna local time.
    // Node's Date.setHours() uses server local timezone (often UTC on Vercel), which shifts DTEND.
    const viennaParts = getDateTimePartsInTimeZone(startDate, 'Europe/Vienna');
    if (viennaParts.year == null || viennaParts.month == null || viennaParts.day == null) {
      // Fallback: keep previous behavior if timezone parts can't be resolved.
      const d = new Date(startDate);
      d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
      return d;
    }
    const endUtcMillis = zonedTimeToUtcMillis(
      {
        year: viennaParts.year,
        month: viennaParts.month,
        day: viennaParts.day,
        hour: Number(hh) || 0,
        minute: Number(mm) || 0,
      },
      'Europe/Vienna'
    );
    return new Date(endUtcMillis);
  }
  const t = effectiveType(ev);
  const addMin = t === 'event' ? 60 : 90;
  return new Date(startDate.getTime() + addMin * 60 * 1000);
}

function buildSummary(ev, teamName) {
  const t = effectiveType(ev);
  const notes = notesTitleAndDescription(ev.notes);
  if (t === 'tournament') return notes.title ?? `${teamName} Turnier`;
  if (t === 'game' || t === 'match') return `${teamName} Spiel: ${teamName} vs ${ev.opponent ?? 'Gegner'}`;
  if (t === 'training') return `${teamName} Training`;
  return notes.title ?? 'Event';
}

function buildLocation(ev) {
  const place = (ev.location ?? '').trim();
  if (place) return place;
  const notes = notesTitleAndDescription(ev.notes);
  return notes.description ?? null;
}

function formatViennaTime(isoString) {
  const d = new Date(isoString);
  if (!d || isNaN(d.getTime())) return null;
  // Important: Vercel server defaults to UTC; force Europe/Vienna so FamilieWall matches app.
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function buildDescription(ev, appBaseUrl) {
  const notes = notesTitleAndDescription(ev.notes);
  const meetup = ev.meeting_at ? formatViennaTime(ev.meeting_at) : null;
  const startsAtTime = ev.starts_at ? formatViennaTime(ev.starts_at) : null;
  const eventUrl = `${appBaseUrl}/app/events/${ev.id}`;
  const lines = [];
  if (meetup) lines.push(`Treffpunkt: ${meetup}`);
  if (meetup && startsAtTime) lines.push(`Beginn: ${startsAtTime}`);
  if (effectiveType(ev) === 'game' && ev.opponent) lines.push(`Gegner: ${ev.opponent}`);
  if (notes.description) lines.push(`Hinweise: ${notes.description}`);
  lines.push(`Link zur SpielzeitApp: ${eventUrl}`);
  return lines.join('\n');
}

/**
 * @param {any} req
 * @param {any} res
 */
async function teamIcsHandler(req, res) {
  try {
    console.log('[ics-feed] handler start', { method: req?.method });

    const proc = globalThis.process;
    console.log('ENV CHECK', {
      hasSupabaseUrl: !!proc?.env?.SUPABASE_URL,
      hasViteUrl: !!proc?.env?.VITE_SUPABASE_URL,
      hasServiceKey: !!proc?.env?.SUPABASE_SERVICE_ROLE_KEY,
    });

    if (req.method !== 'GET') {
      res.status(405).send('Method not allowed');
      return;
    }

    const rawTeamId = req.query?.teamId;
    if (!rawTeamId || typeof rawTeamId !== 'string') {
      res.status(400).send('Missing teamId');
      return;
    }
    let pathKey = rawTeamId.replace(/\.ics$/i, '').trim();
    try {
      pathKey = decodeURIComponent(pathKey);
    } catch {
      // keep pathKey as-is
    }
    if (!pathKey) {
      res.status(400).send('Invalid teamId');
      return;
    }
    console.log('[ics-feed] parsed path key', { pathKey, rawTeamId });

    const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      res.status(500).send('Server not configured');
      return;
    }

    console.log('Creating Supabase client');
    const admin = createClient(supabaseUrl, serviceKey);
    console.log('[ics-feed] supabase client created');

    let resolvedTeamId = null;
    if (isUuidLike(pathKey)) {
      resolvedTeamId = pathKey;
    } else {
      const slugWanted = pathKey.toLowerCase();
      const { data: allTeams, error: teamsListError } = await admin.from('teams').select('id, name');
      if (teamsListError) {
        console.error('[ics-feed] DB teams list error', teamsListError);
        res.status(500).send(teamsListError.message ?? 'teams query failed');
        return;
      }
      resolvedTeamId = resolveTeamIdFromSlug(allTeams, slugWanted);
      if (!resolvedTeamId) {
        res.status(404).send('Team not found');
        return;
      }
    }

    console.log('[ics-feed] team lookup start', { resolvedTeamId });
    const { data: teamData, error: teamError } = await admin
      .from('teams')
      .select('name')
      .eq('id', resolvedTeamId)
      .maybeSingle();
    if (teamError) {
      console.error('[ics-feed] DB teams error', teamError);
      res.status(500).send(teamError.message ?? 'teams query failed');
      return;
    }
    if (!teamData) {
      res.status(404).send('Team not found');
      return;
    }
    console.log('[ics-feed] team lookup end', { hasRow: !!teamData });
    // Dauerhafter Kalendername ohne Altersklasse (U11/U12 …).
    const teamName = teamCalendarClubNameFromTeamName(teamData?.name ?? 'Team');

    console.log('[ics-feed] team seasons lookup start', { resolvedTeamId });
    const { data: teamSeasons, error: tsError } = await admin
      .from('team_seasons')
      .select('id, team_id, status')
      .eq('team_id', resolvedTeamId);
    if (tsError) {
      console.error('[ics-feed] DB team_seasons error', tsError);
      res.status(500).send(tsError.message);
      return;
    }
    console.log('[ics-feed] team seasons lookup end', { count: (teamSeasons ?? []).length });

    // Team-stabil: aktive Saison bevorzugen (nach U11→U12 liefert der Feed U12).
    // Fallback: alle Saisons, falls keine active (Übergänge / Legacy-Daten).
    const seasons = teamSeasons ?? [];
    const activeSeasons = seasons.filter((t) => String(t.status ?? '').toLowerCase() === 'active');
    const seasonsForFeed = activeSeasons.length > 0 ? activeSeasons : seasons;
    const teamSeasonIds = seasonsForFeed.map((t) => t.id);

    const nowIso = new Date().toISOString();
    console.log('[ics-feed] events lookup start', {
      teamSeasonCount: teamSeasonIds.length,
      activeOnly: activeSeasons.length > 0,
      nowIso,
    });
    const { data: eventsRaw, error: evError } = await admin
      .from('events')
      .select(
        'id, team_season_id, kind, type, opponent, location, starts_at, meeting_at, notes, status, created_at, updated_at',
      )
      .in('team_season_id', teamSeasonIds.length ? teamSeasonIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true });
    if (evError) {
      console.error('[ics-feed] DB events error', evError);
      res.status(500).send(evError.message);
      return;
    }
    const events = (eventsRaw ?? []).filter((e) => String(e.status ?? '').toLowerCase() !== 'canceled');
    console.log('[ics-feed] events lookup end', { count: events.length });

    const appBaseUrl = resolveAppBaseUrl(req);
    console.log('[ics-feed] ICS build start');
    const uniqueEvents = Array.from(new Map((events ?? []).map((e) => [e.id, e])).values());
    const vevents = uniqueEvents.flatMap((ev) => {
      const kickoffStart = new Date(ev.starts_at);
      if (!kickoffStart || isNaN(kickoffStart.getTime())) return [];
      const meetingStart = ev.meeting_at ? new Date(ev.meeting_at) : null;
      const dtStartDate =
        meetingStart && !isNaN(meetingStart.getTime()) ? meetingStart : kickoffStart;
      const end = resolveEndDate(ev, kickoffStart);
      const summary = buildSummary(ev, teamName);
      const description = buildDescription(ev, appBaseUrl);
      const location = buildLocation(ev);
      const stableStamp = pickStableStamp(ev);
      const eventUrl = `${appBaseUrl}/app/events/${ev.id}`;

      return [
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(`event-${ev.id}@spielzeitapp.at`)}`,
        `DTSTAMP:${stableStamp}`,
        `LAST-MODIFIED:${stableStamp}`,
        `DTSTART:${toIcsUtc(dtStartDate)}`,
        `DTEND:${toIcsUtc(end)}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        location ? `LOCATION:${escapeIcsText(location)}` : undefined,
        `URL:${escapeIcsText(eventUrl)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'END:VEVENT',
      ].filter(Boolean);
    });

    let ics = buildIcsContent([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SpielzeitApp//iCal//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeIcsText(`${teamName} Termine`)}`,
      'X-WR-TIMEZONE:UTC',
      ...vevents,
      'END:VCALENDAR',
    ]);

    if (!ics || !ics.startsWith('BEGIN:VCALENDAR')) {
      ics = buildIcsContent([
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SpielzeitApp//iCal//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeIcsText(`${teamName} Termine`)}`,
        'END:VCALENDAR',
      ]);
    }
    ics = ensureCalendarPrefix(ics);
    if (!ics.endsWith('\r\n')) ics = `${ics}\r\n`;

    console.log('[ics-feed] ICS build end', {
      eventRowCount: (events ?? []).length,
      uniqueEventCount: uniqueEvents.length,
      veventLineCount: vevents.length,
      bodyLength: ics.length,
    });

    const previewLines = ics.split('\r\n').slice(0, 15);
    console.info('[ics-feed] response preview', {
      teamId: resolvedTeamId,
      pathKey,
      length: ics.length,
      firstLines: previewLines,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename=calendar.ics');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-SpielzeitApp-ICS', 'true');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).end(ics, 'utf8');
  } catch (error) {
    console.error('ICS ERROR', error);
    if (error !== null && typeof error === 'object') {
      console.error('ICS ERROR details', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    res.status(500).send('ICS feed error');
  }
}

module.exports = { teamIcsHandler };
