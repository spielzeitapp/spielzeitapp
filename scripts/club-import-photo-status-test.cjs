const assert=require('node:assert/strict'),esbuild=require('esbuild'),Module=require('node:module'),React=require('react');
const {act,create}=require('react-test-renderer');
(async()=>{
 const mocks=[[/supabaseClient$/,'export const supabase={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>globalThis.photoResult})})})};'],[/oefbTableSettings$/,'export const getOefbTableSettings=async()=>({data:{id:"table"},error:null});'],[/ManagerRosterPhotos$/,'export const ManagerRosterPhotos=()=>null;'],[/ManagerClubPeopleImport$/,'export const ManagerClubPeopleImport=()=>null;']];
 const bundle=await esbuild.build({entryPoints:['src/manager/ManagerClubImportData.tsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react-router-dom'],plugins:[{name:'fixture',setup(b){for(const[p]of mocks)b.onResolve({filter:p},()=>({path:String(p),namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks.find(([p])=>String(p)===a.path)[1]}));}}]});
 const mod=new Module(process.cwd()+'/photo-status-test.cjs');mod.paths=module.paths;mod._compile(bundle.outputFiles[0].text,process.cwd()+'/photo-status-test.cjs');
 const {ManagerClubImportData}=mod.exports,{MemoryRouter}=require('react-router-dom');
 let tree;global.window={dispatchEvent(){}};
 const props={seasonId:'km',rosterUrl:'https://vereine.oefb.at/Club/Mannschaften/Saison-2026-27/KM/Kader/',tableUrl:'https://vereine.oefb.at/Club/Mannschaften/Saison-2026-27/KM/Tabellen/',onSaved(){}};
 const button=t=>tree.root.findAllByType('button').find(b=>b.children.join('')===t);
 const photo=()=>tree.root.find(n=>typeof n.type==='function'&&n.type.name==='ManagerRosterPhotos');
 for(const exists of [true,false]){
  global.photoResult={data:exists?{photo_url:'https://photos.test/team.jpg'}:null,error:null};
  await act(async()=>tree=create(React.createElement(MemoryRouter,null,React.createElement(ManagerClubImportData,props))));
  assert.equal(JSON.stringify(tree.toJSON()).includes('✓ Mannschaftsfoto bereits vorhanden'),exists);
  assert(JSON.stringify(tree.toJSON()).includes('✓ Tabelle bereits vorhanden'));
  await act(async()=>button(exists?'Mannschaftsfoto ansehen / ändern':'Mannschaftsfoto importieren').props.onClick());
  assert.equal(photo().props.sourceUrl,exists?undefined:props.rosterUrl,'Saved photo opens without a replacement import draft');
  await act(async()=>photo().props.onSaved());
  assert(JSON.stringify(tree.toJSON()).includes('✓ Mannschaftsfoto bereits vorhanden'),'Successful save updates status immediately');
  await act(async()=>tree.unmount());
 }
 global.photoResult={data:null,error:{message:'unavailable'}};
 await act(async()=>tree=create(React.createElement(MemoryRouter,null,React.createElement(ManagerClubImportData,props))));
 assert(button('Mannschaftsfoto prüfen'));assert(!button('Mannschaftsfoto importieren'),'Read error must not claim the photo is missing');await act(async()=>tree.unmount());
 console.log('PASS club photo status: saved/missing/error states, existing-table consistency, safe editor source and immediate saved feedback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
