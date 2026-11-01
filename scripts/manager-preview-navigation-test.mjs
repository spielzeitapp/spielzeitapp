import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer'),{MemoryRouter}=require('react-router-dom');
const names=['LivePage','CompetitionPage','Header','BottomNav','WelcomeScreen','SplashScreen','AppHomePage','TeamPage','SchedulePage','ProfilePage','MorePage'];
const r=await build({entryPoints:['src/manager/preview/PreviewPages.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixtures',setup(api){
 api.onResolve({filter:/^react$|^react-router-dom$/},args=>({path:args.path,external:true}));
 api.onResolve({filter:/.*/},args=>{const name=args.path.split('/').at(-1);if(names.includes(name))return {path:name,namespace:'fixture'};});
 api.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:`import React from 'react';import {useNavigate} from 'react-router-dom';export function ${args.path}(props){const nav=useNavigate();return React.createElement('button',{'data-page':'${args.path}','data-preview-only':props.previewOnly,onClick:()=>nav('/app/team')},'open team');}`}));
}}]});
const mod={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(require,mod,mod.exports);
const oldDocument=globalThis.document;globalThis.document={querySelector:()=>({scrollTo:()=>{}})};let root;
try {
 await act(async()=>{root=create(React.createElement(MemoryRouter,{initialEntries:['/app/intro/welcome']},React.createElement(mod.exports.PreviewPages)));});
 assert.equal(root.root.find(x=>x.props['data-page']==='WelcomeScreen').props['data-preview-only'],true);
 const viewport=root.root.find(x=>x.props.className==='preview-app-viewport text-white');
 let blocked=false;viewport.props.onClickCapture({target:{closest:()=>null},preventDefault:()=>blocked=true,stopPropagation:()=>{}});assert.equal(blocked,false,'buttons are no longer blanket-blocked');
 await act(async()=>root.root.find(x=>x.props['data-page']==='WelcomeScreen').props.onClick());assert.ok(root.root.find(x=>x.props['data-page']==='TeamPage'));
 const buttons=root.root.findByType('nav').findAllByType('button');await act(async()=>buttons.find(x=>x.children.includes('Termine')).props.onClick());assert.ok(root.root.find(x=>x.props['data-page']==='SchedulePage'));
 console.log('PASS: actual preview router supports Welcome→Team and page navigation, preview-only intro and no blanket click blocker.');
} finally {await act(async()=>root.unmount());globalThis.document=oldDocument;}
