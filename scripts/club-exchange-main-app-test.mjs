import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const React=require('react'),renderer=require('react-test-renderer');
const {MemoryRouter}=require('react-router-dom');
const state=global.__exchangeMain={access:true,teamReads:0,seasons:[
 {id:'u12',age_group:'U12',status:'active',team:{id:'spg-u12',club_id:'nsg',name:'SPG Rohrbach',clubs:{name:'NSG Gölsental'}}},
 {id:'melk',age_group:'U16',status:'active',team:{id:'melk-team',club_id:'melk',name:'SC Melk',clubs:{name:'SC Melk'}}},
],memberships:[{team_season_id:'u12',role:'parent'},{team_season_id:'melk',role:'fan'}]};
const result=await build({entryPoints:['src/pages/ClubExchangePage.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',loader:{'.css':'empty'},plugins:[{name:'main-fixtures',setup(b){
 const modules={
  auth:`exports.useAuth=()=>({user:{id:'parent'}});`,
  session:`exports.useSession=()=>({selectedTeamSeason:global.__exchangeMain.seasons[0],teamSeasons:global.__exchangeMain.seasons,memberships:global.__exchangeMain.memberships,effectiveRole:'parent'});`,
  env:`exports.isStagingApp=()=>true;`,
  ui:`const React=require('react');exports.PageShell=p=>React.createElement('main',null,p.children);`,
  exchange:`const React=require('react');exports.ClubExchange=p=>React.createElement('section',{'data-club':p.clubId,'data-user':p.userId,'data-teams':p.seasons.length,'data-default':p.defaultTeamLabel});`,
  db:`exports.supabase={rpc:async()=>({data:global.__exchangeMain.access,error:null}),from:table=>{const q={select(){return q},eq(){return q},in(){return q},then(resolve,reject){if(table==='team_seasons')global.__exchangeMain.teamReads++;return Promise.resolve({data:table==='exchange_partner_teams'?[{club_id:'usc',team_id:'spg-u12',club:{name:'USC Rohrbach'}}]:[],error:null}).then(resolve,reject)}};return q;}};`,
 };
 const rules=[[/AuthProvider$/,'auth'],[/useSession$/,'session'],[/appEnvironment$/,'env'],[/supabaseClient$/,'db'],[/^\.\.\/ui$/,'ui'],[/features\/club\/ClubExchange$/,'exchange']];
 for(const[filter,path]of rules)b.onResolve({filter},()=>({path,namespace:'fixture'}));
 b.onResolve({filter:/^react$/},()=>({path:'react',external:true}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'js'}));
}}]});
const Module=require('module');const m=new Module('exchange-main-fixture.cjs');m.paths=require.resolve.paths('react');m._compile(result.outputFiles[0].text,'exchange-main-fixture.cjs');
const {ClubExchangePage}=m.exports;
const flush=async()=>{for(let i=0;i<7;i++)await new Promise(r=>setImmediate(r));};
let app;
const mount=async path=>renderer.act(async()=>{app=renderer.create(React.createElement(MemoryRouter,{initialEntries:[path],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(ClubExchangePage)));await flush();});
try{
 await mount('/app/tauschboerse');
 assert.equal(app.root.findByType('section').props['data-club'],'usc','SPG opens shared USC exchange');
 assert.equal(app.root.findAllByType('details').length,0,'one real parent club: no picker despite another favourite');
 assert.equal(app.root.findByType('section').props['data-default'],'U12','own team prefilled');
 await renderer.act(async()=>app.unmount());
 state.memberships[1].role='parent';
 await mount('/app/tauschboerse');
 assert.equal(app.root.findAllByType('details').length,1,'two parent clubs: picker available');
 const choice=app.root.findAllByType('button').find(b=>b.children.includes('SC Melk'));
 await renderer.act(async()=>{choice.props.onClick({currentTarget:{closest:()=>({removeAttribute(){}})}});await flush();});
 assert.equal(app.root.findByType('section').props['data-club'],'melk','club selection changes scope');
 await renderer.act(async()=>app.unmount());
 await mount('/app/tauschboerse?club=melk&thread=private-chat');
 assert.equal(app.root.findByType('section').props['data-club'],'melk','notification club wins over selected team');
 await renderer.act(async()=>app.unmount());
 state.access=false;state.teamReads=0;
 await mount('/app/tauschboerse?club=unrelated');
 assert.equal(state.teamReads,0,'no team data queried before authorization');
 console.log('PASS: one parent club hides picker, favourites excluded, two parent clubs enable switching, team prefill, SPG/USC scope, notification scope, unauthorized team reads blocked');
}finally{if(app)await renderer.act(async()=>app.unmount());delete global.__exchangeMain;}
