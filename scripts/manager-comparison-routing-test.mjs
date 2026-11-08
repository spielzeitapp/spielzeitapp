import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const compiled = await build({ entryPoints:['src/lib/managerComparison.ts'], bundle:true, platform:'node', format:'cjs', write:false });
const mod = {exports:{}};
new Function('module','exports',compiled.outputFiles[0].text)(mod,mod.exports);
const {isManagerComparisonPath,managerComparisonHref}=mod.exports;
for(const path of ['/vereinszentrale','/vereinszentrale/','/vereinszentrale/manager/teams']) assert.equal(isManagerComparisonPath(path),true);
for(const path of ['/manager','/manager/teams','/app/home','/vereinszentrale-falsch']) assert.equal(isManagerComparisonPath(path),false);
assert.equal(managerComparisonHref('/manager/vereine?setupSeason=u12#manager-setup-checklist','/vereinszentrale/manager/login'),'/vereinszentrale/manager/vereine?setupSeason=u12#manager-setup-checklist');
assert.equal(managerComparisonHref('/manager','/manager/login'),'/manager');
assert.equal(managerComparisonHref('//example.com','/vereinszentrale'),'//example.com');
assert.equal(managerComparisonHref('https://example.com','/vereinszentrale'),'https://example.com');
assert.equal(managerComparisonHref('/vereinszentrale/manager','/vereinszentrale'),'/vereinszentrale/manager');
const React=require('react'),{create,act}=require('react-test-renderer'),{MemoryRouter,Routes,Route,Link,Navigate,useLocation}=require('react-router-dom');
function Page(){const location=useLocation();return React.createElement('section',null,React.createElement('output',null,location.pathname),React.createElement(Link,{to:'/manager/teams'},'Teams'),React.createElement(Link,{to:'/manager/login?next=%2Fmanager%2Fteams'},'Login'));}
let tree;await act(async()=>{tree=create(React.createElement(MemoryRouter,{basename:'/vereinszentrale',initialEntries:['/vereinszentrale/manager'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Routes,null,React.createElement(Route,{path:'/manager',element:React.createElement(Navigate,{to:'/manager/plattform',replace:true})}),React.createElement(Route,{path:'*',element:React.createElement(Page)}))));});
assert.equal(tree.root.findByType('output').children[0],'/manager/plattform');
assert.deepEqual(tree.root.findAllByType('a').map(a=>a.props.href),['/vereinszentrale/manager/teams','/vereinszentrale/manager/login?next=%2Fmanager%2Fteams']);
await act(async()=>tree.unmount());
await act(async()=>{tree=create(React.createElement(MemoryRouter,{initialEntries:['/manager'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Page)));});
assert.equal(tree.root.findAllByType('a')[0].props.href,'/manager/teams');await act(async()=>tree.unmount());
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
function rewrite(path){const row=config.rewrites.find(r=>new RegExp('^'+r.source+'$').test(path));return row?.destination;}
assert.equal(rewrite('/vereinszentrale'),'/vereinszentrale.html');assert.equal(rewrite('/vereinszentrale/manager/login'),'/vereinszentrale.html');assert.equal(rewrite('/manager'),'/manager.html');assert.equal(rewrite('/manager/teams'),'/manager.html');
console.log('PASS: separate workspace namespace, login/deep links, no double prefix, existing Manager navigation and Vercel routes retained.');
