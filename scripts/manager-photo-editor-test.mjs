import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
let calls=[],fail=false;globalThis.__photoRpc=async(name,args)=>{calls.push({name,args});return {error:fail?{message:'Konflikt'}:null};};
const b=await build({entryPoints:['src/manager/ManagerPlayerPhotoEditor.tsx'],bundle:true,platform:'node',define:{'import.meta.env.BASE_URL':'"/"'},format:'cjs',packages:'external',write:false,plugins:[{name:'fixture',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase={rpc:(...a)=>globalThis.__photoRpc(...a)}',loader:'js'}));}}]});
const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);const Editor=m.exports.ManagerPlayerPhotoEditor;
const player={id:'fixture',display_name:'Synthetic Player',first_name:'Synthetic',last_name:'Player',avatar_url:'https://vereine.oefb.at/netzwerk/imagedownload/fixture-80-80.jpeg',jersey_number:9};let root,saved=0,closed=0;
await act(async()=>{root=create(React.createElement(Editor,{player,seasonId:'season-fixture',onSaved:()=>saved++,onClose:()=>closed++}));});
const button=text=>root.root.findAllByType('button').find(n=>n.children.join('')===text);
await act(async()=>root.root.findAllByType('select')[0].props.onChange({target:{value:'black'}}));
await act(async()=>root.root.findByProps({'aria-label':'Bildgröße'}).props.onChange({target:{value:'120'}}));
assert.equal(calls.length,0,'preview does not save');assert.equal(root.root.findByType('img').props.style.transform.includes('scale(1.2)'),true);
fail=true;await act(async()=>button('Gestaltung speichern').props.onClick());assert.equal(saved,0);assert.equal(root.root.findByProps({role:'alert'}).children.join(''),'Konflikt');
fail=false;await act(async()=>button('Gestaltung speichern').props.onClick());assert.equal(saved,1);assert.equal(calls[1].args.p_layout.background,'black');assert.equal(calls[1].args.p_layout.zoom,120);assert.equal(calls[1].args.p_team_season_id,'season-fixture');assert.equal(calls[1].args.p_expected,null);
await act(async()=>button('Standard wiederherstellen').props.onClick());assert.equal(calls[2].args.p_layout,null);
await act(async()=>button('Abbrechen').props.onClick());assert.equal(closed,1);assert.equal(calls.length,3);await act(async()=>root.unmount());
console.log('PASS: real editor preview, explicit save, failure retains draft, scoped payload, optimistic version, reset and cancellation.');

await act(async()=>{root=create(React.createElement(Editor,{player,seasonId:'season-fixture',global:true,onSaved:()=>saved++,onClose:()=>closed++}));});
await act(async()=>root.root.findByProps({'aria-label':'Nummerngröße'}).props.onChange({target:{value:'70'}}));
assert.equal(root.root.findAllByType('span').find(n=>n.props.style?.fontSize).props.style.fontSize,'70px');
await act(async()=>button('Gestaltung speichern').props.onClick());assert.equal(calls.at(-1).name,'admin_save_global_photo_layout');assert.equal(calls.at(-1).args.p_replace_individual,false);assert.equal(calls.at(-1).args.p_layout.numberSize,70);
await act(async()=>root.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}}));
await act(async()=>button('Gestaltung speichern').props.onClick());assert.equal(calls.at(-1).args.p_replace_individual,true);
await act(async()=>root.unmount());console.log('PASS: global save preserves individual layouts by default, replacement requires checkbox, number size previews and persists.');

const beforePreset=calls.length;
await act(async()=>{root=create(React.createElement(Editor,{player:{...player,photo_layout_default:{background:'blue-left',source:'original',zoom:130,x:30,y:40,nameX:16,nameY:85,numberX:87,numberY:4,numberSize:80}},seasonId:'season-fixture',global:true,onSaved:()=>saved++,onClose:()=>closed++}));});
await act(async()=>button('Originalfoto vollständig anzeigen').props.onClick());
assert.equal(calls.length,beforePreset,'Preset is preview only until explicitly saved');
await act(async()=>button('Gestaltung speichern').props.onClick());
assert.equal(calls.at(-1).args.p_layout.zoom,100);
assert.equal(calls.at(-1).args.p_layout.nameX,28);
assert.equal(calls.at(-1).args.p_layout.numberSize,44);
assert.equal(calls.at(-1).args.p_replace_individual,false);
await act(async()=>root.unmount());
console.log('PASS: complete-original preset previews first and preserves individual overrides on global save.');

await act(async()=>{root=create(React.createElement(Editor,{player,seasonId:'season-fixture',clubTemplate:'square',imageOnly:true,onSaved:()=>saved++,onClose:()=>closed++}));});
await act(async()=>root.root.findByProps({'aria-label':'Individuelle Profilelemente'}).props.onChange({target:{checked:true}}));
await act(async()=>root.root.findByProps({'aria-label':'Individuell Spielername x'}).props.onChange({target:{value:'14'}}));
await act(async()=>button('Gestaltung speichern').props.onClick());
assert.equal(calls.at(-1).name,'admin_save_player_photo_layout');
assert.equal(calls.at(-1).args.p_layout.profileDesign.name.x,14);
await act(async()=>root.root.findByProps({'aria-label':'Individuelle Profilelemente'}).props.onChange({target:{checked:false}}));
await act(async()=>button('Gestaltung speichern').props.onClick());
assert.equal(calls.at(-1).args.p_layout.profileDesign,undefined,'Return to club inheritance removes individual design');
await act(async()=>root.unmount());
console.log('PASS individual elements: scoped save and return to inherited club design.');

for (const global of [false,true]) {
 const before=calls.length;
 await act(async()=>{root=create(React.createElement(Editor,{player:{...player,cutout_url:'https://example.test/cutout.png'},seasonId:'season-fixture',global,onSaved:()=>{},onClose:()=>{}}));});
 const background=root.root.findAllByType('select')[0];
 assert.ok(background.findAllByType('option').some(n=>n.props.value==='rohrbach-silver'));
 await act(async()=>background.props.onChange({target:{value:'rohrbach-silver'}}));
 assert.equal(calls.length,before,'Rohrbach selection is preview only');
 assert.ok(root.root.findAllByType('div').some(n=>n.props.style?.background?.includes('/backgrounds/rohrbach-silver.webp')),'real portrait renders shared asset');
 await act(async()=>button('Gestaltung speichern').props.onClick());
 assert.equal(calls.at(-1).args.p_layout.background,'rohrbach-silver');
 assert.equal(calls.at(-1).name,global?'admin_save_global_photo_layout':'admin_save_player_photo_layout');
 if(global)assert.equal(calls.at(-1).args.p_replace_individual,false);
 await act(async()=>root.unmount());
}
console.log('PASS: Rohrbach background previews in real portrait and saves in both scopes without replacing individual exceptions.');
