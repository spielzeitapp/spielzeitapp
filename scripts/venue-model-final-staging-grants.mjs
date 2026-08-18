import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'acbaecjzoabafbsjrzvr';
const NSG_CLUB_NAME = 'NSG Gölsental';
const USC_CLUB_NAME = 'USC Rohrbach';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const linkedRef = fs.readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim();
const shouldApply = process.argv.includes('--apply');

if (linkedRef !== STAGING_REF) {
  console.log(JSON.stringify({ ok: false, error: 'linked_project_not_staging', linkedRef }, null, 2));
  process.exit(1);
}

function getStagingKeys() {
  const r = spawnSync(
    'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', STAGING_REF, '-o', 'json'],
    { cwd: root, encoding: 'utf8', shell: true },
  );
  if (r.status !== 0) {
    return { error: 'api_keys_cli_failed', detail: String(r.stderr || r.stdout).slice(0, 200) };
  }
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    return { error: 'api_keys_parse_failed' };
  }
  const rows = Array.isArray(parsed) ? parsed : parsed.api_keys || [];
  const service = rows.find((k) => /service_role/i.test(String(k.name || k.description || '')));
  const serviceKey = service?.api_key || service?.key || '';
  if (!serviceKey) return { error: 'service_key_missing' };
  return { url: `https://${STAGING_REF}.supabase.co`, serviceKey };
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRohrbachVenue(name) {
  return normalize(name).includes('rohrbach');
}

function isStVeitVenue(name) {
  const n = normalize(name);
  return n.includes('st veit') || n.includes('sankt veit');
}

async function listRows(admin, table, select, matchers = []) {
  let query = admin.from(table).select(select);
  for (const [key, value] of matchers) query = query.eq(key, value);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function upsertGrant(admin, row) {
  const payload = {
    team_season_id: row.team_season_id,
    venue_id: row.venue_id,
    purpose: row.purpose,
    is_active: true,
    sort_order: row.sort_order,
  };
  const { error } = await admin
    .from('team_season_training_venues')
    .upsert(payload, { onConflict: 'team_season_id,venue_id,purpose' });
  if (error) throw error;
}

async function main() {
  const keys = getStagingKeys();
  if (keys.error) {
    console.log(JSON.stringify({ ok: false, step: 'keys', ...keys }, null, 2));
    process.exit(1);
  }

  const admin = createClient(keys.url, keys.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const clubs = await listRows(admin, 'clubs', 'id, name');
  const nsgMatches = clubs.filter((c) => normalize(c.name) === normalize(NSG_CLUB_NAME));
  const uscMatches = clubs.filter((c) => normalize(c.name) === normalize(USC_CLUB_NAME));

  const hardStops = [];
  if (nsgMatches.length !== 1) hardStops.push(`NSG club exact match count=${nsgMatches.length}`);
  if (uscMatches.length > 1) hardStops.push(`USC club exact match count=${uscMatches.length}`);

  const nsgClubId = nsgMatches[0]?.id ?? null;
  const uscClubId = uscMatches[0]?.id ?? null;

  const venues = nsgClubId
    ? await listRows(admin, 'venues', 'id, name, club_id', [['club_id', nsgClubId]])
    : [];
  const rohrbachVenues = venues.filter((v) => isRohrbachVenue(v.name));
  const stVeitVenues = venues.filter((v) => isStVeitVenue(v.name));
  if (rohrbachVenues.length !== 1) hardStops.push(`Rohrbach venue match count=${rohrbachVenues.length}`);
  if (stVeitVenues.length !== 1) hardStops.push(`St. Veit venue match count=${stVeitVenues.length}`);

  const teams = await listRows(admin, 'teams', 'id, name, club_id');
  const nsgTeams = teams.filter((t) => t.club_id === nsgClubId);
  const uscTeams = teams.filter((t) => t.club_id === uscClubId);
  const teamSeasons = await listRows(
    admin,
    'team_seasons',
    'id, team_id, age_group, status, display_name, season_id',
  );

  const nsgU12Seasons = teamSeasons.filter((ts) => {
    const team = nsgTeams.find((t) => t.id === ts.team_id);
    return Boolean(team) && String(ts.age_group ?? '').trim() === 'U12' && ['active', 'draft'].includes(String(ts.status ?? ''));
  });
  if (nsgU12Seasons.length !== 1) hardStops.push(`NSG U12 active/draft season count=${nsgU12Seasons.length}`);

  const uscTeamSeasons = teamSeasons.filter((ts) => {
    const team = uscTeams.find((t) => t.id === ts.team_id);
    return Boolean(team) && ['active', 'draft'].includes(String(ts.status ?? ''));
  });

  const existingGrants = await listRows(
    admin,
    'team_season_training_venues',
    'id, team_season_id, venue_id, purpose, is_active, sort_order',
  );

  const summary = {
    ok: hardStops.length === 0,
    mode: shouldApply ? 'apply' : 'preflight',
    linkedRef,
    hardStops,
    nsg: {
      club: nsgMatches,
      rohrbachVenues,
      stVeitVenues,
      u12TeamSeasons: nsgU12Seasons,
    },
    usc: {
      club: uscMatches,
      activeTeamSeasons: uscTeamSeasons.map((ts) => ({
        ...ts,
        team_name: uscTeams.find((t) => t.id === ts.team_id)?.name ?? null,
      })),
    },
    existingRelevantGrants: existingGrants.filter((row) =>
      [nsgU12Seasons[0]?.id, ...uscTeamSeasons.map((ts) => ts.id)].filter(Boolean).includes(row.team_season_id),
    ),
  };

  if (hardStops.length > 0 || !shouldApply) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(hardStops.length > 0 ? 1 : 0);
  }

  const nsgSeasonId = nsgU12Seasons[0].id;
  const rohrbachVenueId = rohrbachVenues[0].id;
  const stVeitVenueId = stVeitVenues[0].id;

  const writes = [
    { team_season_id: nsgSeasonId, venue_id: rohrbachVenueId, purpose: 'training', sort_order: 0 },
    { team_season_id: nsgSeasonId, venue_id: rohrbachVenueId, purpose: 'home_match', sort_order: 1 },
    { team_season_id: nsgSeasonId, venue_id: stVeitVenueId, purpose: 'training', sort_order: 10 },
    { team_season_id: nsgSeasonId, venue_id: stVeitVenueId, purpose: 'home_match', sort_order: 11 },
  ];

  for (const ts of uscTeamSeasons) {
    writes.push(
      { team_season_id: ts.id, venue_id: rohrbachVenueId, purpose: 'training', sort_order: 0 },
      { team_season_id: ts.id, venue_id: rohrbachVenueId, purpose: 'home_match', sort_order: 1 },
    );
  }

  for (const row of writes) {
    await upsertGrant(admin, row);
  }

  const applied = {
    ...summary,
    appliedWrites: writes,
    ok: true,
  };
  console.log(JSON.stringify(applied, null, 2));
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message ?? error ?? 'unknown_error'),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
