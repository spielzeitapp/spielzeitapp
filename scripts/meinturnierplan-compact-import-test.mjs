import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractMeinTurnierplanEmbeddedJson } from '../server/lib/meinTurnierplanEmbedded.js';
import { analyzeTournamentPlanJson, parseMeinTurnierplanJson } from '../server/lib/tournamentPlanJsonAnalyze.js';

const url = 'https://www.meinturnierplan.de/c/9rlioyuf/';
const html = readFileSync(new URL('./fixtures/meinturnierplan-9rlioyuf.html', import.meta.url), 'utf8');
const payload = extractMeinTurnierplanEmbeddedJson(html, '9rlioyuf');
const analysis = parseMeinTurnierplanJson(payload);
assert.equal(analysis.tournamentName, 'U12 NEXTPRO Hallencup 2026');
assert.equal(analysis.teamCount, 6);
assert.equal(analysis.matchCount, 15);
assert.equal(analysis.groupCount, 1);
const own = analysis.rawMatches.filter((m) => [m.homeTeam, m.awayTeam].includes('NSG Rohrbach'));
assert.deepEqual(own.map((m) => m.kickoffTimeHHmm), ['17:14', '18:10', '18:52', '19:20', '19:48']);
assert.ok(own.every((m) => m.plannedMinutes === 12 && !m.hasResult && m.homeGoals === null));
assert.equal(new Set(analysis.rawMatches.map((m) => m.externalMatchId)).size, 15);
assert.equal(parseMeinTurnierplanJson({ ...payload, groupMatches: [] }), null);
assert.equal(parseMeinTurnierplanJson({ ...payload, groupMatches: [{ ...payload.groupMatches[0], groupId: 4 }] }), null);
const calls = [];
const result = await analyzeTournamentPlanJson(url, async (endpoint) => {
  calls.push(endpoint);
  assert.equal(endpoint, url);
  return new Response(html);
});
assert.equal(result.ok, true);
assert.equal(result.analysis.matchCount, 15);
assert.equal(calls.length, 1);
assert.equal(result.diagnostics.source, 'html_fallback');
assert.equal(result.diagnostics.htmlFallbackSuccessful, true);
assert.equal(result.diagnostics.apiReachable, false);

// Legacy links still fall back to embedded data when all JSON endpoints fail.
const old = await analyzeTournamentPlanJson('https://www.meinturnierplan.de/showit.php?id=9rlioyuf', async (endpoint) =>
  new Response(endpoint.includes('/json/') ? 'unavailable' : html, { status: endpoint.includes('/json/') ? 503 : 200 }));
assert.equal(old.ok, true);
assert.equal(old.analysis.matchCount, 15);
assert.equal(old.diagnostics.endpointAttempts.length, 5);
assert.equal(old.diagnostics.apiReachable, false);

const failed = await analyzeTournamentPlanJson(url, async (endpoint) =>
  new Response(endpoint.includes('/json/') ? '{}' : '<title>Not a schedule</title>'));
assert.equal(failed.ok, false);
assert.equal(failed.code, 'import_data_unavailable');
assert.equal(failed.diagnostics.htmlFallbackAttempted, true);
assert.equal(failed.diagnostics.htmlFallbackSuccessful, false);
assert.equal(failed.diagnostics.apiReachable, true);

// JSON responses with a group-less league schedule are valid too.
const direct = await analyzeTournamentPlanJson('https://www.meinturnierplan.de/showit.php?id=9rlioyuf', async () => Response.json(payload));
assert.equal(direct.ok, true);
assert.equal(direct.analysis.matchCount, 15);
assert.equal(direct.diagnostics.source, 'server_api');

// Existing preloadedState pages remain supported; do not select another tournament.
const state = { tournaments: { a: { slug: '9rlioyuf', data: payload } } };
assert.deepEqual(extractMeinTurnierplanEmbeddedJson(`<script>window.preloadedState=${JSON.stringify(state)};</script>`, '9rlioyuf'), payload);
assert.equal(extractMeinTurnierplanEmbeddedJson(`<script>window.preloadedState=${JSON.stringify(state)};</script>`, 'other123'), null);
assert.equal(extractMeinTurnierplanEmbeddedJson('<script>window._cpStadiumData = {broken};</script>', '9rlioyuf'), null);
console.log('PASS: compact schedule (6 teams, 15 matches, 5 Rohrbach matches), API fallback, legacy JSON, and failure diagnostics');
