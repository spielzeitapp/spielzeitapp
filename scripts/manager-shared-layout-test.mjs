import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const React=require('react');
const {create,act}=require('react-test-renderer');
const {MemoryRouter,Routes,Route}=require('react-router-dom');
const mocks={name:'shared-layout-fixtures',setup(api){
 api.onResolve({filter:/^react$/},()=>({path:'react',external:true}));
 api.onResolve({filter:/\.css$/},()=>({path:'css',namespace:'fixture'}));
 api.onResolve({filter:/auth\/useSession$/},()=>({path:'session',namespace:'fixture'}));
 api.onResolve({filter:/lib\/seasonLifecycle$/},()=>({path:'season',namespace:'fixture'}));
 api.onResolve({filter:/\/(ManagerCentralWorkspace|ManagerComparisonHeader|ManagerReferenceSidebar|ManagerHeader|ManagerSidebar|ManagerAccessGate|CommunicationAccessContext|ManagerWorkModeContext|ManagerClubModulesContext|ManagerRouteGuard|ManagerMobileNav|ManagerTeamScope|ManagerSeasonLifecycleAssistant|ManagerAppearance)$/},({path})=>({path:path.split('/').pop(),namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>{
  if(path==='css')return {contents:'',loader:'js'};
  if(path==='session')return {contents:"export const useSession=()=>({selectedTeamSeason:{id:'same-season',status:'active'}});",loader:'js'};
  if(path==='season')return {contents:"export const isSeasonArchived=()=>false;export const getSeasonStatusLabel=()=>'';",loader:'js'};
  const names={CommunicationAccessContext:['CommunicationAccessProvider'],ManagerWorkModeContext:['ManagerWorkModeProvider'],ManagerClubModulesContext:['ManagerClubModulesProvider'],ManagerRouteGuard:['ManagerAccessDeniedBanner','ManagerRouteGuard']}[path]??[path];
  return {loader:'js',contents:"import React from 'react';"+names.map(name=>`export const ${name}=({children,...props})=>React.createElement('div',{'data-component':'${name}',...props},children);`).join('')};
 });
}};
const bundle=await build({entryPoints:['src/manager/ManagerWorkspaceLayout.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[mocks]});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
const {ManagerWorkspaceLayout}=module.exports;
for(const modern of [false,true]){
 let tree;
 await act(async()=>{tree=create(React.createElement(MemoryRouter,{initialEntries:['/manager/spiele'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Routes,null,React.createElement(Route,{path:'/manager',element:React.createElement(ManagerWorkspaceLayout,{modern})},React.createElement(Route,{path:'spiele',element:React.createElement('form',{'data-original-editor':true},'Real shared editor')})))));});
 for(const name of ['ManagerAccessGate','ManagerWorkModeProvider','CommunicationAccessProvider','ManagerClubModulesProvider','ManagerRouteGuard','ManagerTeamScope','ManagerSeasonLifecycleAssistant','ManagerMobileNav']) assert.equal(tree.root.findAllByProps({'data-component':name}).length,1,`${name} shared exactly once in ${modern?'modern':'legacy'} mode`);
 assert.equal(tree.root.findByProps({'data-component':'ManagerSeasonLifecycleAssistant'}).props.seasonId,'same-season');
 assert.equal(tree.root.findByProps({'data-original-editor':true}).children[0],'Real shared editor');
 assert.equal(tree.root.findByProps({'data-component':'ManagerAppearance'}).props.modern,modern);
 assert.equal(tree.root.findAllByProps({'data-component':'ManagerCentralWorkspace'}).length,modern?1:0);
 assert.equal(tree.root.findAllByProps({'data-central-portals':true}).length,modern?1:0);
 await act(async()=>tree.unmount());
}
console.log('PASS: both appearances mount the same editor, permissions, season context and lifecycle assistant through one shared runtime.');
