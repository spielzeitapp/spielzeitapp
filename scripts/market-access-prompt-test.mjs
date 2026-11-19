import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('package.json'));
const {build}=require('esbuild');
const React=require('react');const {act,create}=require('react-test-renderer');const {MemoryRouter}=require('react-router-dom');
const bundle=await build({entryPoints:['src/features/club/MarketAccessPrompt.tsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react-router-dom','lucide-react'],loader:{'.css':'empty'}});
const Module=require('node:module');const mod=new Module(resolve('prompt-test.cjs'));mod.paths=Module._nodeModulePaths(process.cwd());mod._compile(bundle.outputFiles[0].text,mod.id);
const {MarketAccessPrompt}=mod.exports;
const club='9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
for(const view of ['saved','member&mode=mine','member&mode=create','member&mode=requests','member&listing=item']){
 const next=`/vereinsmarkt/${club}?view=${view}&invite=keep&returnTo=%2Fapp%2Fhome`;
 const query=new URLSearchParams({context:'vereinsmarkt',marketClub:club,next});const loginUrl=`/vereinsmarkt/${club}/anmelden?${query}`;
 let app,closed=0,opened=0;
 await act(async()=>{app=create(React.createElement(MemoryRouter,null,React.createElement(MarketAccessPrompt,{loginUrl,onClose:()=>closed++})),{createNodeMock:()=>({open:false,showModal(){opened++;this.open=true},close(){this.open=false}})});});
 assert.equal(opened,1);
 const links=app.root.findAllByType('a');assert.equal(links.length,2);
 assert.equal(links[0].props.href,loginUrl);
 const registration=new URL(links[1].props.href,'https://example.test');assert.equal(registration.pathname,`/vereinsmarkt/${club}/registrieren`);assert.equal(registration.searchParams.get('next'),next);
 const browse=app.root.findAllByType('button').find(b=>b.children.includes('Weiter stöbern'));await act(async()=>browse.props.onClick());assert.equal(closed,1);
 await act(async()=>app.unmount());
}
console.log('PASS login and registration preserve requested area, invite and app return; browsing dismisses');
