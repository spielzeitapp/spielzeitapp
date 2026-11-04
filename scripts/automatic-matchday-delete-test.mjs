import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/autoMatchdayFeedEnabled.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source.replace(/^import .*;\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace(/export /g, '');

function harness({ writeError = null, readError = null, row = { auto_matchday_feed_enabled: false } } = {}) {
  const writes = [];
  const reads = [];
  const updateMatchRow = async (id, patch) => { writes.push({ id, patch }); return { error: writeError }; };
  const supabase = { from(table) {
    assert.equal(table, 'matches');
    return { select(columns) {
      assert.equal(columns, 'id, auto_matchday_feed_enabled');
      return { eq(key, id) {
        assert.equal(key, 'id'); reads.push(id);
        return { maybeSingle: async () => ({ data: row, error: readError }) };
      } };
    } };
  } };
  const remove = new Function('supabase', 'updateMatchRow', `${js}; return removeAutomaticMatchdayPost;`)(supabase, updateMatchRow);
  return { remove, writes, reads };
}

const success = harness();
await success.remove(' match-1 ');
assert.deepEqual(success.writes, [{ id: 'match-1', patch: { auto_matchday_feed_enabled: false } }]);
assert.deepEqual(success.reads, ['match-1']);
const missing = harness();
await assert.rejects(missing.remove(' '), /keinem Spiel/);
assert.equal(missing.writes.length, 0);
const forbidden = harness({ writeError: 'Keine Berechtigung' });
await assert.rejects(forbidden.remove('match-1'), /Keine Berechtigung/);
assert.equal(forbidden.reads.length, 0);
for (const row of [null, { auto_matchday_feed_enabled: true }]) {
  await assert.rejects(harness({ row }).remove('match-1'), /Berechtigung prüfen/);
}
await assert.rejects(harness({ readError: { message: 'Netzwerkfehler' } }).remove('match-1'), /Netzwerkfehler/);
console.log('Automatic matchday deletion: six checks passed. Only the automation flag is changed.');
