import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const raw = readFileSync(new URL('../src/components/match/MatchVideoTransferActions.tsx', import.meta.url), 'utf8');
const source = raw.slice(raw.indexOf('export function'), raw.indexOf('  return <div')) + '  return { prepare, transfer };\n}';
let hints = [], downloads = 0, shares = 0, clicked = null, fail = false;
const factory = new Function('useRef','useState','useEffect','supabase','shareWhatsAppStatusFile',
  stripTypeScriptTypes(source.replace('export function','function')) + '\nreturn MatchVideoTransferActions;');
const Component = factory(value => ({current:value}), () => [null, value => hints.push(value)], callback => callback(), {
  storage: { from(bucket) { assert.equal(bucket,'match-videos'); return { async download(path) {
    downloads++; assert.equal(path,'private/video.mp4');
    if(fail) return {data:null,error:{message:'denied'}};
    return {data:new Blob(['video'],{type:'video/mp4'}),error:null};
  }};}}
}, async file => { shares++; assert.ok(file instanceof File); assert.equal(file.name,'Tor zum 10  Daniel Baumann.mp4'); return 'shared'; });
globalThis.document = {createElement: () => ({click(){clicked={href:this.href,name:this.download};}})};
globalThis.window = {setTimeout: callback => callback()};
const actions = Component({objectPath:'private/video.mp4',title:'Tor zum 1:0 – Daniel Baumann'});
await actions.transfer('share');
assert.equal(shares,0); assert.equal(downloads,1); assert.ok(hints.some(h=>typeof h==='string' && h.includes('erneut')));
await actions.transfer('share'); assert.equal(shares,1); assert.equal(downloads,1);
await actions.transfer('download'); assert.ok(clicked.href.startsWith('blob:')); assert.equal(clicked.name,'Tor zum 10  Daniel Baumann.mp4');
fail=true;
const denied = Component({objectPath:'private/video.mp4',title:'Tor'});
await denied.transfer('share'); assert.equal(shares,1);
assert.ok(hints.some(h=>typeof h==='string' && h.includes('nicht geladen')));
console.log('PASS: authorized storage download, file-only share, cache, second tap, local download, denied transfer');

