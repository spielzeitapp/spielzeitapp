import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function check(manifest) {
  assert.equal(manifest.scope, '/', 'both market and SpielzeitApp routes must remain inside the installed app');
  assert.match(manifest.id, /^\/marktplatz\/[0-9a-f-]{36}$/);
  assert.equal(manifest.start_url, manifest.id.replace('/marktplatz/','/vereinsmarkt/'), 'new launch route retains existing installed identity');
  assert.equal(manifest.display, 'standalone');
  for (const path of [manifest.start_url, '/app/home', '/app/team', '/app/tauschboerse']) {
    assert.ok(new URL(path, 'https://spielzeitapp.at').href.startsWith(new URL(manifest.scope, 'https://spielzeitapp.at').href));
  }
}
for (const file of fs.readdirSync('public/vereinsmarkt').filter(name => name.endsWith('.webmanifest'))) {
  check(JSON.parse(fs.readFileSync(`public/vereinsmarkt/${file}`, 'utf8')));
}
const module = {exports: {}};
vm.runInNewContext(fs.readFileSync('api/exchange/public.js', 'utf8'), {
  module, require: () => ({createClient: () => {throw new Error('manifest must not query private data');}}),
  process: {env: {SUPABASE_URL: 'https://acbaecjzoabafbsjrzvr.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only'}}
});
const response = {setHeader() {}, status(code) {assert.equal(code, 200); return this;}, json: check};
await module.exports({method: 'GET', query: {manifest: '1', club: '9c7a8741-6e73-42d5-88d8-46ce5217e8cd'}}, response);
console.log('PASS: static and API market installs include SpielzeitApp routes and retain their market identity/start URL');
