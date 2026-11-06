import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
const b=await build({entryPoints:['src/manager/ManagerClubPhotoTemplate.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'mocks',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'mock'}));b.onResolve({filter:/rosterService$/},()=>({path:'roster',namespace:'mock'}));b.onResolve({filter:/ManagerProfilePhotoPreview$/},()=>({path:'preview',namespace:'mock'}));b.onResolve({filter:/^react$/},()=>({path:'react',external:true}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='db'?`export const supabase={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{player_photo_template:'square'},error:null})})})}),rpc:async(name,args)=>{globalThis.calls.push({name,args});return {error:globalThis.fail?{message:'Konflikt'}:null}}};`:a.path==='roster'?`export const listRoster=async()=>({data:[{id:'player',display_name:'Player',avatar_url:'/uploaded.jpg',first_name:'Test',last_name:'Player',photo_layout:{source:'original',zoom:120},jersey_number:7}],error:null});`:`import React from 'react';export const ManagerProfilePhotoPreview=props=>React.createElement('output',props,props.clubTemplate);`,loader:'js'}));}}]});
const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);
globalThis.calls=[];globalThis.window={dispatchEvent(){}};globalThis.fail=false;let tree;
try{await act(async()=>tree=create(React.createElement(m.exports.ManagerClubPhotoTemplate,{clubId:'club',seasonId:'season'})));
assert.equal(tree.root.findByType('output').props.clubTemplate,'square');
const radio=value=>tree.root.findAllByType('input').find(i=>i.props.value===value);
await act(async()=>radio('wide').props.onChange());assert.equal(calls.length,0);assert.equal(tree.root.findByType('output').props.clubTemplate,'wide');assert.equal(tree.root.findByType('output').props.layout.zoom,120,'Individual coordinates preserved');
const save=()=>tree.root.findAllByType('button').find(b=>b.children.join('')==='Vereinsvorlage speichern');
globalThis.fail=true;await act(async()=>save().props.onClick());assert.ok(tree.root.findByProps({role:'alert'}));
globalThis.fail=false;await act(async()=>save().props.onClick());assert.equal(calls.at(-1).args.p_club_id,'club');assert.equal(calls.at(-1).args.p_expected,'square');assert.equal(calls.at(-1).args.p_template,'wide');assert.equal(save().props.disabled,true);
await act(async()=>tree.root.findByProps({'aria-label':'Spielername x'}).props.onChange({target:{value:'12'}}));
assert.equal(tree.root.findByType('output').props.clubDesign.name.x,12,'Element control updates preview');
await act(async()=>tree.root.findByProps({'aria-label':'Spielername Farbe'}).props.onChange({target:{value:'#FFCC00'}}));
await act(async()=>save().props.onClick());
assert.equal(calls.at(-1).name,'admin_save_club_profile_design');
assert.equal(calls.at(-1).args.p_design.name.color,'#FFCC00');
assert.equal(calls.at(-1).args.p_expected_design,null);
console.log('PASS club template: saved load, live preview, coordinates preserved, explicit scoped save, conflict and no automatic write.');
}finally{await act(async()=>tree?.unmount());}
const h=await build({entryPoints:['src/components/team/profile/ProfileHeroCard.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',define:{'import.meta.env.BASE_URL':'"/"'},write:false});const mm={exports:{}};new Function('require','module','exports',h.outputFiles[0].text)(require,mm,mm.exports);
for(const source of ['/profile/uploaded.jpg','https://vereine.oefb.at/netzwerk/imagedownload/test.jpeg'])for(const template of ['wide','square']){await act(async()=>tree=create(React.createElement(mm.exports.ProfileHeroCard,{clubTemplate:template,variant:'player',photoUrl:source,photoLayout:{source:'original',background:'blue-left',zoom:100,x:50,y:50,nameX:28,nameY:85,numberX:88,numberY:8},watermark:'4',firstNameLine:'First',lastNameLine:'Last',teamSeasonLabel:'Team U16 · 2026/27',initials:'FL'})));assert.equal(tree.root.findAllByProps({'data-profile-artwork':'player-canvas'}).length,template==='square'?1:0);assert.equal(tree.root.findAllByProps({'data-profile-artwork':'premium'}).length,template==='wide'?1:0);await act(async()=>tree.unmount());}
console.log('PASS: club format overrides file origin and individual settings consistently for local and imported images.');

const o=await build({entryPoints:['src/lib/clubProfileDesign.ts'],bundle:true,platform:'node',format:'cjs',write:false});const om={exports:{}};new Function('module','exports',o.outputFiles[0].text)(om,om.exports);const design=om.exports.defaultClubProfileDesign('wide');design.name.color='#FFCC00';design.number.visible=false;design.logo.opacity=45;
await act(async()=>tree=create(React.createElement(mm.exports.ProfileHeroCard,{clubTemplate:'wide',clubDesign:design,variant:'player',photoUrl:'/portrait.jpg',watermark:'19',firstNameLine:'First',lastNameLine:'Last',teamName:'Team',teamSeasonLabel:'U12 · 2026/27',teamLogoUrl:'/club.png',initials:'FL'})));
assert.equal(tree.root.findByProps({'data-profile-element':'name'}).props.style.color,'#FFCC00');
assert.equal(tree.root.findAllByProps({'data-profile-element':'number'}).length,0);
assert.equal(tree.root.findByProps({'data-profile-element':'logo'}).props.style.opacity,0.45);
assert.ok(tree.root.findAllByType('p').some(p=>p.props.hidden===true),'Built-in watermark hidden when custom overlay is used');
await act(async()=>tree.unmount());
console.log('PASS: shared renderer applies color, visibility, transparency and suppresses duplicate decoration.');
