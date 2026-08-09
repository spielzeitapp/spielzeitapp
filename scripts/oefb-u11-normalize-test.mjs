/**
 * ÖFB.1-FIX – U11-Namensnormalisierung (ohne Jest).
 */
import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  normalizeOefbImportedTeamName,
  describeOefbOpponentCorrection,
} = require('../api/_lib/normalizeOefbTeamName.js');

const cases = [
  ['U11 SPG Rohrbach', 'SPG Rohrbach'],
  ['U 11 SPG Rohrbach', 'SPG Rohrbach'],
  ['U-11 SPG Rohrbach', 'SPG Rohrbach'],
  ['(U11) SPG Rohrbach', 'SPG Rohrbach'],
  ['SPG Rohrbach U11', 'SPG Rohrbach'],
  ['ASK Loosdorf', 'ASK Loosdorf'],
  ['SV U11dorf', 'SV U11dorf'],
  ['U11 SPG Rohrbach – U11 ASK Loosdorf', 'SPG Rohrbach – ASK Loosdorf'],
  ['u11 ask loosdorf', 'ask loosdorf'],
];

for (const [input, expected] of cases) {
  assert.strictEqual(
    normalizeOefbImportedTeamName(input),
    expected,
    `normalize(${JSON.stringify(input)})`,
  );
}

assert.strictEqual(
  describeOefbOpponentCorrection('U11 ASK Loosdorf', 'ASK Loosdorf'),
  'U11 ASK Loosdorf → ASK Loosdorf',
);
assert.strictEqual(describeOefbOpponentCorrection('ASK Loosdorf', 'ASK Loosdorf'), null);

// Reimport-Klassifikation (rein lokal, ohne DB)
function classifyReimport(existing, incomingNormalized) {
  const protectedStatus = ['agreed', 'published'].includes(
    String(existing.fixture_status ?? '').toLowerCase(),
  );
  const nameCorr = describeOefbOpponentCorrection(existing.opponent, incomingNormalized.opponent);
  const sameTime =
    Date.parse(existing.starts_at) === Date.parse(incomingNormalized.starts_at);
  const sameOpp = String(existing.opponent ?? '').trim() === incomingNormalized.opponent.trim();

  if (protectedStatus) {
    return {
      status: 'protected',
      startsAtUnchanged: true,
      nameCorrection: nameCorr,
      willUpdateOpponent: Boolean(nameCorr),
    };
  }
  if (sameTime && sameOpp) {
    return { status: 'existing', startsAtUnchanged: true, nameCorrection: null, willUpdateOpponent: false };
  }
  return {
    status: 'update',
    startsAtUnchanged: sameTime,
    nameCorrection: nameCorr,
    willUpdateOpponent: Boolean(nameCorr) || !sameOpp,
  };
}

const existingDirty = {
  opponent: 'U11 ASK Loosdorf',
  starts_at: '2026-09-12T14:00:00.000Z',
  fixture_status: 'open',
  external_id: '12345',
};
const incoming = {
  opponent: normalizeOefbImportedTeamName('U11 ASK Loosdorf'),
  starts_at: '2026-09-12T14:00:00.000Z',
  external_id: '12345',
};
assert.strictEqual(incoming.opponent, 'ASK Loosdorf');
const openUpdate = classifyReimport(existingDirty, incoming);
assert.strictEqual(openUpdate.status, 'update');
assert.strictEqual(openUpdate.willUpdateOpponent, true);
assert.strictEqual(openUpdate.startsAtUnchanged, true);

const protectedRow = { ...existingDirty, fixture_status: 'agreed' };
const prot = classifyReimport(protectedRow, incoming);
assert.strictEqual(prot.status, 'protected');
assert.strictEqual(prot.startsAtUnchanged, true);
assert.strictEqual(prot.willUpdateOpponent, true);
assert.ok(String(prot.nameCorrection).includes('→'));

const cleanExisting = { ...existingDirty, opponent: 'ASK Loosdorf' };
const idempotent = classifyReimport(cleanExisting, incoming);
assert.strictEqual(idempotent.status, 'existing');
assert.strictEqual(idempotent.nameCorrection, null);

const manualOther = {
  opponent: 'FC Manuell',
  starts_at: '2026-09-12T14:00:00.000Z',
  fixture_status: 'open',
  external_id: null, // kein ÖFB
};
assert.notStrictEqual(manualOther.external_id, incoming.external_id);

console.log('oefb U11 normalize + reimport classify OK');
