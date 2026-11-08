import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(path,'utf8');
const [html,manifestText,routesText,vite,sync]=await Promise.all(['usc.html','public/clubs/usc-rohrbach/manifest.json','vercel.json','vite.config.ts','src/app/ManifestSync.tsx'].map(read));
const manifest=JSON.parse(manifestText),routes=JSON.parse(routesText).rewrites;
const head=html.split(/<script\b/i)[0];
assert.match(head,/<title>USC Rohrbach<\/title>/);
assert.match(head,/name="application-name" content="USC Rohrbach"/);
assert.match(head,/name="apple-mobile-web-app-title" content="USC Rohrbach"/);
const links=[...head.matchAll(/<link\b[^>]*rel="manifest"[^>]*>/g)];assert.equal(links.length,1);
assert.match(links[0][0],/href="\/clubs\/usc-rohrbach\/manifest.json"/);
assert.doesNotMatch(head,/manifest-trainer|content="SpielzeitApp"|apple-touch-icon.png/);
assert.equal(manifest.name,'USC Rohrbach');assert.equal(manifest.short_name,'USC Rohrbach');assert.equal(manifest.start_url,'/app/usc-rohrbach');assert.equal(manifest.id,'/app/usc-rohrbach');assert.equal(manifest.display,'standalone');
for(const path of ['/app/usc-rohrbach','/app/usc-rohrbach/anmelden','/app/usc-rohrbach/registrieren','/app/usc-rohrbach/passwort-vergessen']){
 const first=routes.find(r=>new RegExp('^'+r.source+'$').test(path));assert.equal(first?.destination,'/usc.html',path);
}
assert.equal(routes.find(r=>new RegExp('^'+r.source+'$').test('/app/home'))?.destination,'/index.html');
assert.equal(routes.find(r=>new RegExp('^'+r.source+'$').test('/manager'))?.destination,'/manager.html');
assert.match(vite,/usc: resolve\(__dirname, "usc.html"\)/);
assert.doesNotMatch(sync,/existing\.remove\(\)/,'initial link is retained');
console.log('PASS initial USC HTML: name/icon/manifest before JS, stable app identity/start URL, club/auth routes served dedicated HTML, general app and Manager unchanged.');
