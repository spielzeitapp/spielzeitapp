import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const temp = mkdtempSync(join(tmpdir(), 'position-rotation-'));
try {
  const load = path => {
    const out = join(temp, path.split('/').pop() + '.cjs');
    buildSync({ entryPoints: [path], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent', define: { 'import.meta.env': '{"DEV":false}' } });
    return require(out);
  };
  const rotation = load('src/lib/tournamentRotation.ts');
  const { planBlockChange } = load('src/lib/tournamentBlocks.ts');
  const engine = load('src/lib/matchEngine.ts');
  const { emptyTournamentTemplate } = load('src/lib/tournamentLineupTemplate.ts');
  const ids = ['keeper', 'gambock', 'semmellechner', 'baumann', 'hasler', 'pundy', 'hinterwallner', 'bradaric', 'fasching', 'elkabbani'];
  const blocks = emptyTournamentTemplate(ids, '1-2-1-2', 'single');
  const start = blocks.variants[1];
  Object.assign(start.slots, { GK: 'keeper', LB: 'gambock', RB: 'semmellechner', CM: 'baumann', LW: 'hasler', RW: 'pundy' });
  blocks.variants[2] = structuredClone(start);
  const positions = {
    gambock: ['defence'], semmellechner: ['defence', 'middle'], hasler: ['defence', 'attack'], hinterwallner: ['defence', 'attack'],
    baumann: ['middle', 'attack'], pundy: ['middle', 'attack'], bradaric: ['middle', 'attack'], fasching: ['attack'], elkabbani: ['attack'],
  };
  for (const anchorId of ['gambock', 'semmellechner']) {
    const frames = rotation.generateTournamentRotation(start, positions, anchorId);
    const game = { mode: 'scheduled', anchorId, frames };
    rotation.validateRotationGame(game, start, positions);
    assert.deepEqual(frames.map(f => f.minute), [0, 3, 6, 9]);
    const events = [];
    for (let index = 1; index < frames.length; index++) {
      const plan = planBlockChange(frames[index - 1].slots, frames[index].slots, ids, true);
      assert.equal(plan.changes.length, 2);
      assert.deepEqual(plan.slots, frames[index].slots);
      plan.changes.forEach((change, i) => events.push({ id: `event-${index}-${i}`, type: 'substitution', timestamp: frames[index].minute * 60, playerId: change.outId, swapWithPlayerId: change.inId }));
    }
    const ordered = ['GK', 'LB', 'RB', 'CM', 'LW', 'RW', 'ST', 'FP'].map(slot => start.slots[slot] ?? '');
    const actual = engine.computePlayerPlaytimeFromEvents({ kickoffStartingPlayerIds: ordered, squadPlayerIds: ids, events, finalMatchSecond: 720 });
    for (const id of ids) assert.equal(actual[id], (id === 'keeper' || id === anchorId ? 12 : 6) * 60);
    assert.equal(Object.values(rotation.rotationMinutes(frames)).reduce((a, b) => a + b, 0), 72);
    const modified = structuredClone(game); modified.frames[3].slots.CM = 'fasching';
    assert.throws(() => rotation.validateRotationGame(modified, start, positions));
    blocks.rotation = { version: 1, positions, games: { match: game } };
    const resolved = rotation.resolveRotationForMatch(blocks, 'match', 'group');
    assert.equal(resolved.lineupMode, 'single');
    assert.equal(resolved.rotationMatch.mode, 'scheduled');
    assert.equal(rotation.resolveRotationForMatch(blocks, 'placement', 'placement').rotationMatch.mode, 'free');
    assert.throws(() => rotation.resolveRotationForMatch(blocks, 'unplanned-group', 'group'));
    assert.throws(() => rotation.resolveRotationForMatch(blocks, 'unknown', 'unknown'));
  }
  // These anchors cannot retain both defenders in the all-reserve middle section.
  for (const anchor of ['baumann', 'pundy', 'hasler']) assert.throws(() => rotation.generateTournamentRotation(start, positions, anchor));
  assert.throws(() => rotation.generateTournamentRotation(start, positions, 'keeper'));
  assert.throws(() => rotation.generateTournamentRotation(start, positions, 'gambock', 10));
  assert.throws(() => rotation.generateTournamentRotation({ ...start, squadIds: ids.slice(1) }, positions, 'gambock'));
  const changedStart = structuredClone(start); changedStart.slots.CM = 'bradaric';
  assert.throws(() => rotation.validateRotationGame(blocks.rotation.games.match, changedStart, positions));
  const rolesChanged = structuredClone(positions); rolesChanged.bradaric = ['attack'];
  assert.throws(() => rotation.validateRotationGame(blocks.rotation.games.match, start, rolesChanged));
  assert.equal(rotation.rotationModeForPhase('final'), 'free');
  assert.equal(rotation.rotationModeForPhase('group'), 'scheduled');
  assert.equal(rotation.rotationModeForPhase(null), null);
  // Legacy match editor reconstruction must preserve the match policy.
  const storage = new Map();
  global.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  const variants = load('src/lib/matchLineupVariants.ts');
  const resolved = rotation.resolveRotationForMatch(blocks, 'match', 'group');
  variants.writeMatchLineupVariants('match', resolved);
  variants.writeMatchLineupVariants('match', { version: 1, startVariant: 1, variants: blocks.variants });
  assert.equal(variants.readMatchLineupVariants('match').rotationMatch.mode, 'scheduled');
  // Render the live control with the same React instance as the test renderer.
  const uiFile = join(temp, 'control.cjs');
  await require('esbuild').build({ entryPoints: ['src/components/tournament/TournamentRotationControl.tsx'], bundle: true, platform: 'node', format: 'cjs', outfile: uiFile, logLevel: 'silent', plugins: [{ name: 'shared-react', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: require.resolve('react'), external: true }));
  } }] });
  const React = require('react');
  const renderer = require('react-test-renderer');
  const { TournamentRotationControl } = require(uiFile);
  let calls = 0;
  const props = { stored: resolved, seconds: 180, running: true, current: start.slots, squad: ids, name: id => id, busy: false, onApply: async changes => { calls++; assert.equal(changes.length, 2); return true; } };
  let tree;
  renderer.act(() => { tree = renderer.create(React.createElement(TournamentRotationControl, props)); });
  let button = tree.root.findAllByType('button').find(b => b.children.includes('Zwei Wechsel prüfen'));
  assert.equal(button.props.disabled, false);
  renderer.act(() => button.props.onClick());
  assert.equal(calls, 0, 'review must never save substitutions');
  button = tree.root.findAllByType('button').find(b => b.children.includes('Zwei Wechsel bestätigen'));
  await renderer.act(async () => button.props.onClick());
  assert.equal(calls, 1);
  renderer.act(() => tree.update(React.createElement(TournamentRotationControl, { ...props, seconds: 179 })));
  assert.equal(tree.root.findAllByType('button').find(b => b.children.includes('Zwei Wechsel prüfen')).props.disabled, true);
  renderer.act(() => tree.update(React.createElement(TournamentRotationControl, { ...props, current: { ...start.slots, CM: 'bradaric' } })));
  assert.equal(tree.root.findAllByType('button').length, 0, 'individual changes must stop scheduled execution');
  renderer.act(() => tree.update(React.createElement(TournamentRotationControl, { ...props, stored: rotation.resolveRotationForMatch(blocks, 'placement', 'placement') })));
  assert.equal(tree.root.findAllByType('button').length, 0, 'placement mode must not offer scheduled block changes');
  renderer.act(() => tree.unmount());
  console.log('PASS positions, fixed keeper, 3/6/9 two-player changes, all four frames, engine playtime, phase policies, invalid/stale plans and legacy editor preservation');
} finally { rmSync(temp, { recursive: true, force: true }); }
