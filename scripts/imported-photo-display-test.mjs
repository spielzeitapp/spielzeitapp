import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
async function load(entry){const r=await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});const mod={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(require,mod,mod.exports);return mod.exports;}
const {playerPhotoDisplayUrl}=await load('src/lib/playerPhotoDisplay.ts');
const url='https://vereine.oefb.at/netzwerk/imagedownload/synthetic-80-80.jpeg';const expected='/api/oefb/table?view=photo&quality=portrait&url='+encodeURIComponent(url);
assert.equal(playerPhotoDisplayUrl(url),expected);
for(const src of ['/avatars/player-placeholder.png','blob:https://app.test/fixture','https://storage.test/avatar.jpg','https://vereine.oefb.at.evil.test/netzwerk/imagedownload/fake.jpg',expected])assert.equal(playerPhotoDisplayUrl(src),src);
assert.equal(playerPhotoDisplayUrl(null),'');
const {resolveProfilePhotoSrc}=await load('src/lib/profileHeroImage.ts');assert.equal(resolveProfilePhotoSrc(url),expected);
const {ParentAccessPlayerRow}=await load('src/components/team/ParentAccessPlayerRow.tsx');let root;
const props={row:{player_id:'synthetic',player_name:'Synthetic Player',jersey_number:2,parent_count:0,parents:[]},openInviteCount:0,onOpen:()=>{}};
try {
 await act(async()=>{root=create(React.createElement(ParentAccessPlayerRow,{...props,photoUrl:url}));});
 assert.equal(root.root.findByType('img').props.src,expected);
 assert.ok(!root.root.findByType('img').props.className.includes('scale-[1.75]'),'ÖFB headshots are not zoomed as full-body cutouts');
 await act(async()=>root.root.findByType('img').props.onError());assert.ok(root.root.findByType('img').props.src.includes('placeholder'));
 const next=url.replace('synthetic','other');await act(async()=>root.update(React.createElement(ParentAccessPlayerRow,{...props,photoUrl:next})));
 assert.equal(root.root.findByType('img').props.src,playerPhotoDisplayUrl(next),'new URL retries after an earlier failure');
 console.log('PASS: ÖFB proxy, unchanged storage/blob/demo URLs, profile portrait and actual parent row, crop and error retry.');
} finally {await act(async()=>root.unmount());}
