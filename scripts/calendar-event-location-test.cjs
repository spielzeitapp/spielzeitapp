const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const core = ['api/_lib/teamIcsCore.js', 'api/calendar/teamIcsCore.js']
  .map(file => path.join(root, file)).find(file => fs.existsSync(file));
const context = { require: createRequire(core), module: { exports: {} }, console, URL, process };
vm.runInNewContext(fs.readFileSync(core, 'utf8') + '\nmodule.exports = { buildLocation, buildMapsNavigationUrl, pickStableStamp };', context);
const { buildLocation, buildMapsNavigationUrl, pickStableStamp } = context.module.exports;
const pitch = 'Sportplatz Rohrbach, Durlaßstraße 81, 3163 Rohrbach';
const hall = { name: 'Sporthalle Wilhelmsburg', address: 'Stadtpark 1', postal_code: '3150', city: 'Wilhelmsburg', latitude: 48.1, longitude: 15.6, updated_at: '2026-10-13T15:52:38Z' };
const match = { location: pitch, updated_at: '2026-09-25T21:10:03Z' };
// The reported stale relationship must not change either LOCATION or directions.
assert.equal(buildLocation(match, hall), pitch);
assert.equal(new URL(buildMapsNavigationUrl(match, hall)).searchParams.get('destination'), pitch);
assert.equal(buildLocation({ location: pitch.replaceAll(', ', '\n') }, hall), pitch);
// A real hall tournament and events with only a venue name still use its details.
assert.equal(buildLocation({ location: 'Sporthalle Wilhelmsburg' }, hall), 'Sporthalle Wilhelmsburg, Stadtpark 1, 3150 Wilhelmsburg');
assert.equal(new URL(buildMapsNavigationUrl({ location: 'Sporthalle Wilhelmsburg' }, hall)).searchParams.get('destination'), '48.1,15.6');
assert.equal(buildLocation({ location: 'Sporthalle  Wilhelmsburg\nStadtpark 1, 3150 Wilhelmsburg' }, hall), 'Sporthalle Wilhelmsburg, Stadtpark 1, 3150 Wilhelmsburg');
assert.equal(buildLocation({ location: '' }, hall), 'Sporthalle Wilhelmsburg, Stadtpark 1, 3150 Wilhelmsburg');
assert.equal(buildLocation(match, null), pitch);
// A changed address under the same venue name must not supply stale coordinates.
const movedHall = { location: 'Sporthalle Wilhelmsburg, Andere Straße 2, 3150 Wilhelmsburg' };
assert.equal(buildLocation(movedHall, hall), movedHall.location);
assert.equal(new URL(buildMapsNavigationUrl(movedHall, hall)).searchParams.get('destination'), movedHall.location);
assert.equal(pickStableStamp(match, hall), '20261013T155238Z');
assert.equal(pickStableStamp({ updated_at: '2026-10-15T12:00:00Z' }, hall), '20261015T120000Z');
assert.equal(pickStableStamp(match, null), '20260925T211003Z');
console.log('Calendar location and update regression checks passed.');
