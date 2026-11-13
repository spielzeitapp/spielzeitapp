import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const React=require('react');
const renderer=require('react-test-renderer');
const { act }=renderer;
const { MemoryRouter }=require('react-router-dom');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'exchange-ui-'));
globalThis.window={setInterval,clearInterval,dispatchEvent(){},confirm:()=>true};
globalThis.document={hidden:false,createElement:()=>({getContext:()=>({fillStyle:'',fillRect(){},drawImage(){}}),toBlob(callback){callback(new Blob(['jpeg-fixture'],{type:'image/jpeg'}));}})};
globalThis.CustomEvent=class {};
globalThis.Image=class {naturalWidth=2000;naturalHeight=2000;async decode(){}};
const fixtures = `
const shirt='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#d7dadd"/><path d="M210 100 120 180 175 250 210 220 210 500 390 500 390 220 425 250 480 180 390 100 350 120 250 120Z" fill="#20242a"/><path d="m225 115-60 75m72-70-60 75m186-80 60 75m-72-70 60 75" stroke="white" stroke-width="9"/><text x="300" y="260" fill="white" font-family="sans-serif" font-size="30" text-anchor="middle">USC</text></svg>');
const state=window.exchangeFixture={user:'requester',uploads:[],pushCalls:0,tables:{
exchange_listings:[{id:'listing',club_id:'club',owner_id:'owner',owner_label:'Johannes',title:'USC Trainingspulli',category:'Pulli',size:'140',condition:'Sehr gut',offer:'Gratis',price:null,description:'Zu klein geworden. Übergabe beim Training möglich.',team_label:'U11',status:'Verfügbar',photo_paths:['club/owner/listing/photo.jpg'],created_at:'2026-11-13T08:00:00Z',revision:0}],
exchange_threads:[],exchange_messages:[],notifications:[],exchange_blocks:[]}};
const copy=v=>JSON.parse(JSON.stringify(v));
class Query{
 constructor(table){this.table=table;this.filters=[];this.op='select';this.values=null;this.isSingle=false;}
 select(){return this;} eq(k,v){this.filters.push(r=>r[k]===v);return this;} order(){return this;} limit(){return this;}
 insert(values){this.op='insert';this.values=values;return this;} update(values){this.op='update';this.values=values;return this;} delete(){this.op='delete';return this;}
 single(){this.isSingle=true;return this;} maybeSingle(){this.isSingle=true;return this;}
 then(resolve,reject){try{
 const table=state.tables[this.table]||[];let rows=table.filter(r=>this.filters.every(f=>f(r)));
 if(this.op==='insert'){
  const row={id:crypto.randomUUID(),sender_id:state.user,created_at:new Date().toISOString(),revision:0,...this.values};
  if(this.table==='exchange_threads')row.requester_label='Maria';
  if(this.table==='exchange_listings')row.owner_label='Johannes';
  table.push(row);rows=[row];
 }else if(this.op==='update'){rows.forEach(row=>{Object.assign(row,this.values);if(this.table==='exchange_listings')row.revision++;});}
 else if(this.op==='delete'){state.tables[this.table]=table.filter(r=>!rows.includes(r));}
 return Promise.resolve({data:copy(this.isSingle?rows[0]||null:rows),error:null}).then(resolve,reject);
 }catch(e){return Promise.reject(e).then(resolve,reject);}}
}
export const supabase={rpc:async()=>({data:true,error:null}),from:table=>new Query(table),auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})},storage:{from:()=>({
 createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:shirt})),error:null}),
 upload:async(path,blob)=>{state.uploads.push({path,size:blob.size,type:blob.type});return {error:null};},remove:async()=>({error:null})})}};
window.fetch=async()=>{state.pushCalls++;return {ok:true,json:async()=>({sent:1})};};
`;

const entry=path.resolve('src/features/club/ClubExchange.tsx');
const output=await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',define:{'import.meta.env':'{}'},loader:{'.css':'empty'},plugins:[{name:'supabase-fixture',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'mock',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixtures,loader:'js'}));}}]});
const modulePath=path.join(scratch,'exchange.cjs');
await fs.writeFile(modulePath,output.outputFiles[0].text);
// Resolve external React packages from this repository, including in scratch.
const Module=require('module');
const m=new Module(modulePath);m.filename=modulePath;m.paths=require.resolve.paths('react');m._compile(output.outputFiles[0].text,modulePath);
const { ClubExchange }=m.exports;
globalThis.fetch=window.fetch;
const flush=async()=>{for(let n=0;n<5;n++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.children?text(node.children):'';
let app;
const button=(name)=>app.root.findAllByType('button').find(b=>text(b).trim()===name || b.props['aria-label']===name);
const click=async name=>{const b=button(name);assert.ok(b,'button: '+name);await act(async()=>{b.props.onClick?.();await flush();});};
const mount=async userId=>{await act(async()=>{app=renderer.create(React.createElement(MemoryRouter,{initialEntries:['/app/usc-rohrbach?tab=verein&section=tauschboerse']},React.createElement(ClubExchange,{clubId:'club',userId,defaultTeamLabel:'U11',ownTeamLabels:['U11'],seasons:[{id:'season',age_group:'U11',team:{name:'USC Rohrbach'}}]})),{createNodeMock:element=>element.type==='dialog'?{showModal(){},close(){}}:null});await flush();});window.exchangeFixture.user=userId;};
try{
 await mount('requester');
 const card=app.root.findAllByType('button').find(b=>b.props.className==='exchange-card');
 assert.ok(card);await act(async()=>{card.props.onClick();await flush();});
 await act(async()=>{app.root.findAllByType('input').find(i=>i.props.type==='checkbox').props.onChange({target:{checked:true}});});
 await click('Interesse senden');
 assert.equal(window.exchangeFixture.tables.exchange_threads.length,1);
 assert.equal(window.exchangeFixture.tables.exchange_messages.length,1);
 assert.match(text(app.toJSON()),/Privater Chat mit Johannes/);
 await act(async()=>{app.root.findByProps({id:'exchange-reply'}).props.onChange({target:{value:'Übergabe am Donnerstag?'}});});
 const compose=app.root.findAllByType('form').find(f=>f.props.className==='exchange-compose');
 await act(async()=>{compose.props.onSubmit({preventDefault(){}});await flush();});
 assert.equal(window.exchangeFixture.tables.exchange_messages.at(-1).body,'Übergabe am Donnerstag?');
 await click('Kontaktdaten freiwillig teilen');
 await act(async()=>{app.root.findAllByType('input').find(i=>i.props.maxLength===200).props.onChange({target:{value:'private@example.invalid'}});});
 await act(async()=>{app.root.findAllByType('form').find(f=>f.props.className==='exchange-contact').props.onSubmit({preventDefault(){}});await flush();});
 assert.match(window.exchangeFixture.tables.exchange_messages.at(-1).body,/freiwillig.*private@example/);
 await click('Person blockieren');
 assert.match(text(app.toJSON()),/Neue Nachrichten sind gesperrt/);
 assert.equal(button('Nachricht senden'),undefined);
 await click('Blockierung aufheben');assert.ok(button('Nachricht senden'));
 await act(async()=>app.unmount());
 await mount('owner');
 await click('Inserat');
 const labelInput=label=>app.root.findAllByType('label').find(l=>text(l).startsWith(label)).findByType('input');
 await act(async()=>{labelInput('Bezeichnung').props.onChange({target:{value:'USC Trainingsshirt'}});});
 await act(async()=>{labelInput('Größe').props.onChange({target:{value:'128'}});});
 await act(async()=>{app.root.findAllByType('input').find(i=>i.props.multiple).props.onChange({target:{files:[new File(['png-fixture'],'shirt.png',{type:'image/png'})],value:''}});});
 await act(async()=>{app.root.findAllByType('input').find(i=>i.props.type==='checkbox').props.onChange({target:{checked:true}});});
 await act(async()=>{app.root.findByType('dialog').findByType('form').props.onSubmit({preventDefault(){}});await flush();});
 assert.equal(window.exchangeFixture.uploads[0].type,'image/jpeg');
 assert.match(window.exchangeFixture.uploads[0].path,/^club\/owner\//);
 assert.equal(window.exchangeFixture.tables.exchange_listings.find(l=>l.title==='USC Trainingsshirt').status,'Verfügbar');
 assert.equal(window.exchangeFixture.tables.exchange_listings.find(l=>l.title==='USC Trainingsshirt').team_label,'U11','own team prefilled and saved');
 const ownerCard=app.root.findAllByType('button').find(b=>b.props.className==='exchange-card'&&text(b).includes('USC Trainingspulli'));
 await act(async()=>ownerCard.props.onClick());
 await act(async()=>{app.root.findByProps({'aria-label':'Status des Inserats'}).props.onChange({target:{value:'Reserviert'}});await flush();});
 assert.equal(window.exchangeFixture.tables.exchange_listings[0].status,'Reserviert');
 assert.ok(window.exchangeFixture.pushCalls>=4);
 console.log('PASS: UI interest, private replies, voluntary contact sharing, block/unblock, photo input/upload path, publish and reserve. DOM/camera rendering uses mocks; no real push sent.');
}finally{if(app)await act(async()=>app.unmount());}
