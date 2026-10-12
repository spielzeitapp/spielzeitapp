const assert = require('node:assert/strict');
const { extractReport } = require('../api/_lib/oefbMatchReport');
const title = { spielUid: '4134586', heimMannschaft: 'Heim', gastMannschaft: 'Gast', ergebnis: '1:2', spielort: 'Arena' };
const details = { heimAufstellung: { weitere: [{ name: 'Test Heim', rueckennummer: '1' }] },
  gastAufstellung: { weitere: [{ name: 'Test Gast', rueckennummer: '7' }] },
  gameData: [{ type: 'goal', minute: 89, team: 'b', playerPrimary: 'Test Gast', spielstand: '1:2' },
    { type: 'goal', minute: 32, team: 'b', playerPrimary: 'Test Gast', eigentor: true, spielstand: '1:1' },
    { type: 'playerchange', minute: 26, team: 'a', playerPrimary: 'Test Heim', playerSecondary: 'Test Bank' }] };
const html = `SG.container.appPreloads['a']=${JSON.stringify([title])};\nSG.container.appPreloads['b']=${JSON.stringify([details])};`;
const report = extractReport(html, '4134586');
assert.equal(report.score, '1:2');
assert.deepEqual(report.events.map(e => e.minute), [26, 32, 89]);
assert.equal(report.events[1].ownGoal, true);
assert.equal(report.awayPlayers[0].number, '7');
assert.throws(() => extractReport(html, '999'));
assert.equal(extractReport(`SG.container.appPreloads['a']=${JSON.stringify([{ ...title, ergebnis: '-:-' }])};`, '4134586').score, null);
assert.equal(extractReport(`SG.container.appPreloads['a']=${JSON.stringify([title])};`, '4134586').events.length, 0);
async function testHandler() {
  const handler = require('../api/_lib/oefbMatchReport');
  const response = () => ({ code: 200, body: null, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code=c; return this; }, json(b) { this.body=b; return this; } });
  const bad = response(); await handler({ method: 'GET', query: { id: 'https://other.test' } }, bad); assert.equal(bad.code, 400);
  const wrongMethod = response(); await handler({ method: 'POST', query: { id: '4134586' } }, wrongMethod); assert.equal(wrongMethod.code, 405);
  const originalFetch = global.fetch;
  try {
    global.fetch = async (url, opts) => { assert.equal(url, 'https://www.oefb.at/bewerbe/Spiel/Spielbericht/4134586/'); assert.equal(opts.redirect, 'error'); return { ok: true, text: async () => html }; };
    const ok = response(); await handler({ method: 'GET', query: { id: '4134586' } }, ok); assert.equal(ok.body.score, '1:2'); assert.equal(ok.headers['Cache-Control'], 'no-store');
    global.fetch = async () => { throw new Error('offline'); };
    const offline = response(); await handler({ method: 'GET', query: { id: '4134586' } }, offline); assert.equal(offline.code, 502);
  } finally { global.fetch = originalFetch; }
  console.log('PASS ÖFB report parser, own goals, no missing-score defaults, fixed host, invalid IDs, methods, outage, no-store');
}
testHandler().catch(e => { console.error(e); process.exitCode = 1; });
