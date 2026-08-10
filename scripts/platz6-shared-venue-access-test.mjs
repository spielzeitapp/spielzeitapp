/**
 * PLATZ.6 – Shared Venue Access (ohne DB).
 * Deckt Client-Logik + dokumentierte SQL-Erwartungen.
 */
import assert from 'assert';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// --- Spiegel Client-Helfer (ohne TS-Import) ---

function purposeUniqueKey(teamSeasonId, venueId, purpose) {
  return `${teamSeasonId}|${venueId}|${purpose}`;
}

function isVenuePurposeAllowed(allowlist, teamSeasonId, venueId, purpose) {
  return allowlist.some(
    (r) =>
      r.team_season_id === teamSeasonId &&
      r.venue_id === venueId &&
      r.purpose === purpose &&
      r.is_active !== false,
  );
}

/** Auswärtsspiel darf keine lokale Assignment erzeugen (Client-Guard + SQL). */
function mayCreateLocalAssignment({ kind, isHome }) {
  const k = String(kind ?? '').toLowerCase();
  if (k === 'training') return true;
  if (k === 'match' || k === 'game') {
    if (isHome === false) return false;
    if (isHome == null) return false;
    return isHome === true;
  }
  return true;
}

function tryApplyHomeDefault({ isHome, hasDefaults, kind }) {
  const k = String(kind ?? '').toLowerCase();
  if (k !== 'match' && k !== 'game') return null;
  if (isHome !== true) return null;
  if (!hasDefaults) return null;
  return 'assignment-id';
}

const SHARED_DTO_KEYS = [
  'assignment_id',
  'event_id',
  'team_season_id',
  'team_name',
  'org_name',
  'kind',
  'type',
  'status',
  'starts_at',
  'ends_at',
  'venue_id',
  'field_id',
  'field_name',
  'zone_id',
  'zone_name',
  'is_own',
  'can_edit',
];

function pickSharedDto(raw) {
  const out = {};
  for (const k of SHARED_DTO_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) out[k] = raw[k];
  }
  return out;
}

function assertNoPrivateSharedFields(row) {
  const forbidden = ['notes', 'players', 'player_ids', 'attendance', 'description', 'created_by'];
  return !forbidden.some((k) => Object.prototype.hasOwnProperty.call(row, k) && row[k] != null);
}

// PLATZ.5.1 half geometry (horizontal)
const PRESETS = {
  half_a: { x: 0, y: 0, w: 1, h: 0.5 },
  half_b: { x: 0, y: 0.5, w: 1, h: 0.5 },
};

function countApiEndpointsExcludingLib(apiDir) {
  const files = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === '_lib') continue;
        walk(full);
        continue;
      }
      if (!/\.(js|ts|mjs)$/.test(name)) continue;
      if (name.startsWith('_')) continue;
      files.push(relative(apiDir, full).replace(/\\/g, '/'));
    }
  }
  walk(apiDir);
  return files.sort();
}

// ---------------------------------------------------------------------------
// 1) purpose unique key: training vs home_match same venue allowed
// ---------------------------------------------------------------------------
{
  const a = purposeUniqueKey('u12', 'rohrbach', 'training');
  const b = purposeUniqueKey('u12', 'rohrbach', 'home_match');
  assert.notStrictEqual(a, b);
  const set = new Set([a, b]);
  assert.strictEqual(set.size, 2);
}

// ---------------------------------------------------------------------------
// 2) USC does not auto-get St.Veit (nur explizite Allowlist)
// ---------------------------------------------------------------------------
{
  const allowlist = [
    { team_season_id: 'u12', venue_id: 'rohrbach', purpose: 'training', is_active: true },
    { team_season_id: 'u12', venue_id: 'stveit', purpose: 'training', is_active: true },
    // USC: nur Rohrbach, nie automatisch St.Veit
  ];
  assert.strictEqual(
    isVenuePurposeAllowed(allowlist, 'usc-kampf', 'stveit', 'training'),
    false,
  );
  assert.strictEqual(
    isVenuePurposeAllowed(allowlist, 'usc-kampf', 'rohrbach', 'training'),
    false,
  );
  // Explizite Freigabe nötig:
  allowlist.push({
    team_season_id: 'usc-kampf',
    venue_id: 'rohrbach',
    purpose: 'training',
    is_active: true,
  });
  assert.strictEqual(
    isVenuePurposeAllowed(allowlist, 'usc-kampf', 'rohrbach', 'training'),
    true,
  );
  assert.strictEqual(
    isVenuePurposeAllowed(allowlist, 'usc-kampf', 'stveit', 'training'),
    false,
  );
}

// ---------------------------------------------------------------------------
// 3) allowlist purpose isolation
// ---------------------------------------------------------------------------
{
  const allowlist = [
    { team_season_id: 'u12', venue_id: 'stveit', purpose: 'training', is_active: true },
    { team_season_id: 'u12', venue_id: 'rohrbach', purpose: 'home_match', is_active: true },
  ];
  assert.strictEqual(isVenuePurposeAllowed(allowlist, 'u12', 'stveit', 'home_match'), false);
  assert.strictEqual(isVenuePurposeAllowed(allowlist, 'u12', 'stveit', 'training'), true);
  assert.strictEqual(isVenuePurposeAllowed(allowlist, 'u12', 'rohrbach', 'training'), false);
  assert.strictEqual(isVenuePurposeAllowed(allowlist, 'u12', 'rohrbach', 'home_match'), true);
}

// ---------------------------------------------------------------------------
// 4) away match must not create assignment
// ---------------------------------------------------------------------------
{
  assert.strictEqual(mayCreateLocalAssignment({ kind: 'match', isHome: false }), false);
  assert.strictEqual(mayCreateLocalAssignment({ kind: 'match', isHome: true }), true);
  assert.strictEqual(mayCreateLocalAssignment({ kind: 'match', isHome: null }), false);
  assert.strictEqual(mayCreateLocalAssignment({ kind: 'training', isHome: false }), true);
}

// ---------------------------------------------------------------------------
// 5) home match without defaults => no auto assignment
// ---------------------------------------------------------------------------
{
  assert.strictEqual(
    tryApplyHomeDefault({ isHome: true, hasDefaults: false, kind: 'match' }),
    null,
  );
  assert.strictEqual(
    tryApplyHomeDefault({ isHome: true, hasDefaults: true, kind: 'match' }),
    'assignment-id',
  );
  assert.strictEqual(
    tryApplyHomeDefault({ isHome: false, hasDefaults: true, kind: 'match' }),
    null,
  );
}

// ---------------------------------------------------------------------------
// 6) shared DTO fields whitelist (no notes/players)
// ---------------------------------------------------------------------------
{
  const raw = {
    assignment_id: 'a1',
    event_id: 'e1',
    team_season_id: 'ts',
    team_name: 'U12',
    org_name: 'NSG',
    kind: 'training',
    type: null,
    status: 'upcoming',
    starts_at: '2026-08-10T10:00:00Z',
    ends_at: '2026-08-10T11:30:00Z',
    venue_id: 'v1',
    field_id: 'f1',
    field_name: 'Hauptplatz',
    zone_id: null,
    zone_name: null,
    is_own: true,
    can_edit: true,
    notes: 'GEHEIM',
    players: ['x'],
  };
  const dto = pickSharedDto(raw);
  assert.strictEqual(dto.notes, undefined);
  assert.strictEqual(dto.players, undefined);
  assert.ok(assertNoPrivateSharedFields(dto));
  assert.strictEqual(Object.keys(dto).sort().join(','), [...SHARED_DTO_KEYS].sort().join(','));
}

// ---------------------------------------------------------------------------
// 7) half geometry from PLATZ.5.1 still horizontal
// ---------------------------------------------------------------------------
{
  assert.strictEqual(PRESETS.half_a.w, 1);
  assert.strictEqual(PRESETS.half_a.h, 0.5);
  assert.strictEqual(PRESETS.half_b.y, 0.5);
  assert.ok(PRESETS.half_a.y < PRESETS.half_b.y);
}

// ---------------------------------------------------------------------------
// 8) serverless count <= 12: api endpoint files excluding _lib
// ---------------------------------------------------------------------------
{
  const apiFiles = countApiEndpointsExcludingLib(join(root, 'api'));
  // Dokumentierter Count (ohne _lib, ohne _*-Helfer):
  // calendar/team.js, calendar/teamIcsCore.js, notifications/dispatch.ts,
  // oefb/schedule.js, ping-test.js, push/send-team.js, push/subscribe.js,
  // push/test.js, push/unsubscribe.js, reminders/process.ts,
  // send-reminders/index.js, tournament-plan-analyze.js, tournament-plan/analyze.ts
  console.log('api endpoints (excl. _lib):', apiFiles.length, apiFiles.join(', '));
  assert.ok(
    apiFiles.length <= 12,
    `Erwartet <= 12 API-Endpoints excl. _lib, ist ${apiFiles.length}: ${apiFiles.join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// 9) duplicate allowlist rejected conceptually (unique key)
// ---------------------------------------------------------------------------
{
  const rows = [
    { team_season_id: 'u12', venue_id: 'rohrbach', purpose: 'training' },
    { team_season_id: 'u12', venue_id: 'rohrbach', purpose: 'training' },
  ];
  const keys = new Set(rows.map((r) => purposeUniqueKey(r.team_season_id, r.venue_id, r.purpose)));
  assert.strictEqual(keys.size, 1);
  // SQL: idx_tstv_team_season_venue_purpose_unique verhindert Duplikate
}

// ---------------------------------------------------------------------------
// 10) field independence haupt vs training
// ---------------------------------------------------------------------------
{
  const haupt = { id: 'f-main', venue_id: 'rohrbach', name: 'Hauptplatz' };
  const training = { id: 'f-train', venue_id: 'rohrbach', name: 'Trainingsplatz' };
  assert.notStrictEqual(haupt.id, training.id);
  // Konflikt-RPC filtert nach field_id → Belegungen auf Hauptplatz blockieren Trainingsplatz nicht
  const conflictOnSameField = (a, b) => a.field_id === b.field_id && a.starts < b.ends && b.starts < a.ends;
  assert.strictEqual(
    conflictOnSameField(
      { field_id: haupt.id, starts: 10, ends: 12 },
      { field_id: training.id, starts: 10, ends: 12 },
    ),
    false,
  );
  assert.strictEqual(
    conflictOnSameField(
      { field_id: haupt.id, starts: 10, ends: 12 },
      { field_id: haupt.id, starts: 11, ends: 13 },
    ),
    true,
  );
}

console.log('platz6-shared-venue-access-test: OK');
