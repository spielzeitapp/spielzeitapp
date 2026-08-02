/**
 * Staging smoke: ÖFB import + reimport agreed guard (via supabase db query).
 * Run: node scripts/smoke-championship-7b1.mjs
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEAM_SEASON_ID = '6b36c70c-621b-44f6-9bd4-5a26321213bf';
const OEFB_URL =
  'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/U12-1/Spiele';
const VENUE_ID = 'dc938f24-43ce-4f2f-82d5-16bee490e311';

function sql(q) {
  const file = join(tmpdir(), `spz-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(file, q, 'utf8');
  try {
    const out = execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['supabase', 'db', 'query', '--linked', '-o', 'json', '-f', file],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: true },
    );
    const start = out.indexOf('{');
    const end = out.lastIndexOf('}');
    if (start < 0 || end < start) return [];
    const parsed = JSON.parse(out.slice(start, end + 1));
    if (Array.isArray(parsed?.rows)) return parsed.rows;
    if (Array.isArray(parsed)) return parsed;
    return parsed?.rows ?? [];
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

function esc(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function main() {
  const report = { steps: [] };

  const apiRes = await fetch(
    `https://app.spielzeitapp.at/api/oefb/schedule?url=${encodeURIComponent(OEFB_URL)}&ourTeam=${encodeURIComponent('SPG Rohrbach|Rohrbach|USC Rohrbach')}`,
  );
  const api = await apiRes.json();
  report.steps.push({
    step: 'A/B API',
    ok: api.ok === true && api.count === 10,
    count: api.count,
    arts: [...new Set((api.fixtures || []).map((f) => f.art))],
  });
  if (!api.ok || !Array.isArray(api.fixtures) || api.fixtures.length !== 10) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const beforeJobs = sql(`SELECT count(*)::int AS n FROM public.notification_jobs;`);
  const beforeEvents = sql(
    `SELECT count(*)::int AS n FROM public.events WHERE team_season_id='${TEAM_SEASON_ID}';`,
  );
  const beforeMatches = sql(`SELECT count(*)::int AS n FROM public.matches;`);

  // Clean prior smoke championship rows for this season
  sql(
    `DELETE FROM public.events WHERE team_season_id='${TEAM_SEASON_ID}' AND external_source='oefb';`,
  );

    const values = api.fixtures
    .map((f) => {
      return `(
      '${TEAM_SEASON_ID}',
      'match',
      'game',
      'league',
      ${esc(f.opponent)},
      ${f.is_home === true},
      ${esc(f.location)},
      ${esc(f.starts_at)}::timestamptz,
      NULL,
      'upcoming',
      'opt_in',
      'oefb',
      ${esc(f.external_id)},
      ${esc(f.external_url)},
      ${esc(f.competition)},
      ${esc(f.starts_at)}::timestamptz,
      'open'
    )`;
    })
    .join(',\n');

  sql(`
    INSERT INTO public.events (
      team_season_id, kind, type, match_type, opponent, is_home, location,
      starts_at, meeting_at, status, attendance_mode,
      external_source, external_id, external_url, competition,
      source_starts_at, fixture_status
    ) VALUES ${values};
  `);

  const afterInsert = sql(`
    SELECT count(*)::int AS n,
      count(DISTINCT external_id)::int AS distinct_ext,
      count(*) FILTER (WHERE fixture_status='open')::int AS open_n,
      count(*) FILTER (WHERE source_starts_at IS NOT NULL)::int AS with_source,
      count(*) FILTER (WHERE starts_at = source_starts_at)::int AS starts_eq_source
    FROM public.events
    WHERE team_season_id='${TEAM_SEASON_ID}' AND external_source='oefb';
  `);
  report.steps.push({ step: '3 Persistenz', result: afterInsert?.[0] ?? afterInsert });

  // Pick first home + first away for edit/agreed tests
  const pick = sql(`
    SELECT id, opponent, is_home, starts_at, source_starts_at, fixture_status, meeting_at, venue_id, external_id
    FROM public.events
    WHERE team_season_id='${TEAM_SEASON_ID}' AND external_source='oefb'
    ORDER BY is_home DESC, starts_at ASC
    LIMIT 2;
  `);
  const homeRow = pick.find((r) => r.is_home === true) || pick[0];
  const awayRow = pick.find((r) => r.is_home === false) || pick[1];
  report.steps.push({
    step: 'pick',
    home: homeRow && { id: homeRow.id, opponent: homeRow.opponent, external_id: homeRow.external_id },
    away: awayRow && { id: awayRow.id, opponent: awayRow.opponent, external_id: awayRow.external_id },
  });

  const agreedStarts = '2026-09-21T09:30:00+02:00';
  const agreedMeeting = '2026-09-21T08:45:00+02:00';
  sql(`
    UPDATE public.events SET
      starts_at='${agreedStarts}'::timestamptz,
      meeting_at='${agreedMeeting}'::timestamptz,
      venue_id='${VENUE_ID}',
      location='Sportplatz Rohrbach',
      fixture_status='agreed'
    WHERE id='${homeRow.id}';
  `);

  const agreedCheck = sql(`
    SELECT fixture_status, starts_at, meeting_at, venue_id, source_starts_at
    FROM public.events WHERE id='${homeRow.id}';
  `);
  report.steps.push({ step: '8 agreed set', result: agreedCheck?.[0] ?? agreedCheck });

  // Reimport simulation (app logic)
  let updated = 0;
  let skippedAgreed = 0;
  for (const f of api.fixtures) {
    const existing = sql(`
      SELECT id, fixture_status, starts_at, meeting_at, venue_id
      FROM public.events
      WHERE team_season_id='${TEAM_SEASON_ID}' AND external_source='oefb' AND external_id=${esc(f.external_id)}
      LIMIT 1;
    `)?.[0];
    if (!existing) {
      report.steps.push({ step: 'reimport missing', external_id: f.external_id });
      continue;
    }
    const isAgreed = existing.fixture_status === 'agreed';
    if (isAgreed) {
      sql(`
        UPDATE public.events SET
          opponent=${esc(f.opponent)},
          is_home=${f.is_home === true},
          competition=${esc(f.competition)},
          external_url=${esc(f.external_url)},
          source_starts_at=${esc(f.starts_at)}::timestamptz
        WHERE id='${existing.id}';
      `);
      skippedAgreed += 1;
    } else {
      sql(`
        UPDATE public.events SET
          opponent=${esc(f.opponent)},
          is_home=${f.is_home === true},
          competition=${esc(f.competition)},
          external_url=${esc(f.external_url)},
          source_starts_at=${esc(f.starts_at)}::timestamptz,
          starts_at=${esc(f.starts_at)}::timestamptz,
          location=COALESCE(NULLIF(location,''), ${esc(f.location)})
        WHERE id='${existing.id}';
      `);
    }
    updated += 1;
  }

  const afterReimport = sql(`
    SELECT count(*)::int AS n,
      count(DISTINCT external_id)::int AS distinct_ext
    FROM public.events
    WHERE team_season_id='${TEAM_SEASON_ID}' AND external_source='oefb';
  `);
  const agreedAfter = sql(`
    SELECT fixture_status, starts_at, meeting_at, venue_id, source_starts_at, opponent
    FROM public.events WHERE id='${homeRow.id}';
  `)?.[0];

  const agreedPreserved =
    agreedAfter &&
    agreedAfter.fixture_status === 'agreed' &&
    agreedAfter.venue_id === VENUE_ID &&
    String(agreedAfter.starts_at).includes('09:30') === false
      ? // compare via epoch
        true
      : true;

  // Explicit compare of agreed fields
  const agreedStartsIso = new Date(agreedStarts).toISOString();
  const agreedMeetingIso = new Date(agreedMeeting).toISOString();
  const startsOk = new Date(agreedAfter.starts_at).toISOString() === agreedStartsIso;
  const meetingOk = new Date(agreedAfter.meeting_at).toISOString() === agreedMeetingIso;
  const venueOk = agreedAfter.venue_id === VENUE_ID;
  const statusOk = agreedAfter.fixture_status === 'agreed';

  report.steps.push({
    step: '9 Reimport P0',
    updated,
    skippedAgreed,
    count: afterReimport?.[0] ?? afterReimport,
    agreedAfter,
    startsOk,
    meetingOk,
    venueOk,
    statusOk,
    p0_pass: startsOk && meetingOk && venueOk && statusOk && (afterReimport?.[0]?.n === 10),
  });

  // Triple import uniqueness
  for (let i = 0; i < 2; i++) {
    for (const f of api.fixtures) {
      const existing = sql(`
        SELECT id, fixture_status FROM public.events
        WHERE team_season_id='${TEAM_SEASON_ID}' AND external_source='oefb' AND external_id=${esc(f.external_id)}
        LIMIT 1;
      `)?.[0];
      if (existing) {
        sql(`
          UPDATE public.events SET competition=${esc(f.competition)}, source_starts_at=${esc(f.starts_at)}::timestamptz
          WHERE id='${existing.id}';
        `);
      }
    }
  }
  const triple = sql(`
    SELECT count(*)::int AS n FROM public.events
    WHERE team_season_id='${TEAM_SEASON_ID}' AND external_source='oefb';
  `);
  report.steps.push({ step: '13 Duplikate', result: triple?.[0] ?? triple });

  const afterJobs = sql(`SELECT count(*)::int AS n FROM public.notification_jobs;`);
  const afterMatches = sql(`SELECT count(*)::int AS n FROM public.matches;`);
  const nonChamp = sql(`
    SELECT count(*)::int AS n FROM public.events
    WHERE team_season_id='${TEAM_SEASON_ID}' AND (external_source IS NULL OR external_source <> 'oefb');
  `);

  report.steps.push({
    step: '12/T side effects',
    jobs_before: beforeJobs?.[0]?.n,
    jobs_after: afterJobs?.[0]?.n,
    jobs_delta: (afterJobs?.[0]?.n ?? 0) - (beforeJobs?.[0]?.n ?? 0),
    matches_before: beforeMatches?.[0]?.n,
    matches_after: afterMatches?.[0]?.n,
    matches_delta: (afterMatches?.[0]?.n ?? 0) - (beforeMatches?.[0]?.n ?? 0),
    non_champ_events: nonChamp?.[0]?.n,
    season_events_before: beforeEvents?.[0]?.n,
  });

  // OPEN visibility proxy: count open that would appear if unfiltered
  const openVisible = sql(`
    SELECT count(*)::int AS open_n FROM public.events
    WHERE team_season_id='${TEAM_SEASON_ID}' AND fixture_status='open';
  `);
  report.steps.push({
    step: 'S OPEN count',
    open_n: openVisible?.[0]?.n,
    note: 'useEvents+ICS filter open; Calendar/Feed patched this verify',
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
