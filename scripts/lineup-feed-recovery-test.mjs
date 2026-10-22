import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const recovery = await build({ entryPoints: ['src/lib/lineupFeedRecovery.ts'], bundle: true, write: false, format: 'cjs' });
let interval, online, visible, cleared = false;
const ctx = { module: { exports: {} }, console: { warn() {} }, window: {
  setInterval(fn) { interval = fn; return 1; }, clearInterval() { cleared = true; },
  addEventListener(_, fn) { online = fn; }, removeEventListener() { online = null; },
}, document: { visibilityState: 'visible', addEventListener(_, fn) { visible = fn; }, removeEventListener() { visible = null; } } };
vm.runInNewContext(recovery.outputFiles[0].text, ctx);
const flush = () => new Promise(resolve => setImmediate(resolve));
let calls = 0;
const stop = ctx.module.exports.startLineupFeedRecovery(async () => ++calls === 1
  ? { ok: false, error: 'offline' } : { ok: true, created: true });
await flush(); assert.equal(calls, 1);
online(); await flush(); assert.equal(calls, 2);
interval(); visible(); await flush(); assert.equal(calls, 2, 'stop retrying after publication');
stop(); assert(cleared); assert.equal(online, null); assert.equal(visible, null);
calls = 0;
const stopBounded = ctx.module.exports.startLineupFeedRecovery(async () => { calls++; throw Error('network'); });
await flush();
for (let i = 0; i < 10; i++) { interval(); await flush(); }
assert.equal(calls, 5); stopBounded(); interval(); await flush(); assert.equal(calls, 5);

const source = fs.readFileSync('src/lib/ensureLineupFeedPost.ts', 'utf8')
  .replace('async function fetchSavedLineupForFeedPost(', 'export async function fetchSavedLineupForFeedPost(');
const output = await build({ stdin: { contents: source, resolveDir: process.cwd() + '/src/lib', loader: 'ts' }, bundle: true, write: false, format: 'cjs', define: {'import.meta.env':'{"BASE_URL":"/","DEV":false}'}, logLevel: 'silent', plugins: [{ name: 'mock-db', setup(b) {
  b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'db', namespace: 'mock' }));
  b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase=globalThis.db;' }));
  b.onResolve({ filter: /liveMatchService$/ }, () => ({ path: 'live', namespace: 'live-mock' }));
  b.onLoad({ filter: /.*/, namespace: 'live-mock' }, () => ({ contents: `export const LIVE_FIELD_SLOT_ORDER=['GK','LB','RB','CM','LW','RW','ST']; export const fetchLineupForLiveMatch=async()=>({data:{startingPlayerIds:['sub','p2','p3','p4','p5','p6','p7'],savedBenchPlayerIds:['p1']}}); export const fetchMatchById=async()=>({data:{u11_formation_id:'1-2-3-1'}});` }));
} }] });
let snapshotError = null;
const slots = ['GK','LB','RB','CM','LW','RW','ST'];
const db = { from(table) {
  let data = table === 'match_lineup_snapshots' ? slots.map((slot, i) => ({ slot, player_id: 'p' + (i + 1) }))
    : table === 'match_squad_publications' ? { selected_player_ids: [...slots.map((_,i) => 'p'+(i+1)), 'sub', 'absent'] }
    : table === 'match_no_shows' ? [{player_id:'absent'}]
    : table === 'matches' ? {u11_formation_id:'1-2-3-1'}
    : table === 'players' ? [...slots.map((_,i) => 'p'+(i+1)), 'sub'].map(id => ({id,first_name:id,last_name:'Name',jersey_number:1})) : [];
  const q = { select(){return q;},eq(){return q;},is(){return q;},in(){return q;},maybeSingle(){return q;},then(resolve) { return Promise.resolve({data,error:table==='match_lineup_snapshots'?snapshotError:null}).then(resolve); } }; return q;
} };
const dataCtx = { module: { exports: {} }, db, console: {warn(){},log(){}}, Set, Map, Date, URL };
vm.runInNewContext(output.outputFiles[0].text, dataCtx);
const saved = await dataCtx.module.exports.fetchSavedLineupForFeedPost('match', 'season');
assert.equal(saved.source, 'kickoff_snapshot');
assert.equal(saved.players[0].player_id, 'p1', 'use kickoff keeper, not substituted keeper');
assert.equal(saved.benchPlayerIds.join(','), 'sub', 'original bench, without no-shows or starters');
snapshotError = {message:'network'};
assert.equal(await dataCtx.module.exports.fetchSavedLineupForFeedPost('match'), null, 'fail closed instead of publishing current lineup');
const screen = fs.readFileSync('src/pages/live/LiveMatchScreen.tsx','utf8');
assert.match(screen, /isDemo \|\| !effectiveMatchId \|\| !canControlLiveMatch \|\| matchRow\?\.status !== 'live'/);
assert.match(screen, /startLineupFeedRecovery\(\(\) => ensureLineupFeedPostForMatch\(effectiveMatchId\)\)/);
console.log('PASS: kickoff publication, network/foreground recovery, retry bounds, cleanup, immutable starters, original bench, absent exclusion and fail-closed snapshot reads.');
