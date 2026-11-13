import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const Module=require('module');
const output=await build({entryPoints:['api/exchange/push.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',plugins:[{name:'push-fixtures',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'db',namespace:'fixture'}));
 b.onLoad({filter:/^db$/,namespace:'fixture'},()=>({contents:`
 class Query{
 constructor(table){this.table=table;this.filters=[];this.values=null;this.single=false;}
 select(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}lt(k,v){this.filters.push(r=>r[k]<v);return this;}order(){return this;}limit(){return this;}
 update(values){this.values=values;return this;}maybeSingle(){this.single=true;return this;}
 then(resolve,reject){const rows=(global.__exchange[this.table]||[]).filter(r=>this.filters.every(f=>f(r)));if(this.values)rows.forEach(r=>Object.assign(r,this.values));return Promise.resolve({data:this.single?rows[0]||null:rows,error:null}).then(resolve,reject);}}
 exports.createClient=()=>({auth:{getUser:async token=>({data:{user:token==='valid'?{id:'sender'}:null},error:token==='valid'?null:Error('invalid')})},from:table=>new Query(table)});
 `}));
 b.onResolve({filter:/^web-push$/},()=>({path:'push',namespace:'fixture'}));
 b.onLoad({filter:/^push$/,namespace:'fixture'},()=>({contents:`module.exports={setVapidDetails(){},sendNotification:async(sub,payload)=>{global.__exchange.sent.push({sub,payload:JSON.parse(payload)});}};`}));
}}]});
const m=new Module('exchange-push-test.cjs');m.paths=require.resolve.paths('react');m._compile(output.outputFiles[0].text,'exchange-push-test.cjs');
const handler=m.exports.default;
const keys=['SUPABASE_URL','VITE_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','STAGING_DISABLE_OUTBOUND','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'];
const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const call=async(req={})=>{const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};await handler({method:'POST',headers:{authorization:'Bearer valid'},...req},res);return res;};
try{
 Object.assign(process.env,{SUPABASE_URL:'https://acbaecjzoabafbsjrzvr.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',VAPID_PUBLIC_KEY:'fixture',VAPID_PRIVATE_KEY:'fixture',VAPID_SUBJECT:'mailto:fixture@example.invalid'});
 delete process.env.STAGING_DISABLE_OUTBOUND;
 assert.equal((await call({method:'GET'})).statusCode,405);
 assert.equal((await call({headers:{}})).statusCode,401);
 assert.equal((await call({headers:{authorization:'Bearer invalid'}})).statusCode,401);
 process.env.SUPABASE_URL='https://shxugattqatahckhspwk.supabase.co';
 assert.equal((await call()).statusCode,403,'LIVE is blocked');
 process.env.SUPABASE_URL='https://acbaecjzoabafbsjrzvr.supabase.co';
 process.env.STAGING_DISABLE_OUTBOUND='true';
 assert.equal((await call()).body.disabled,true);
 delete process.env.STAGING_DISABLE_OUTBOUND;
 global.__exchange={sent:[],exchange_push_queue:[{message_id:'message',sender_id:'sender',recipient_id:'receiver',link:'/app/usc-rohrbach?tab=verein&section=tauschboerse&thread=thread',status:'pending',attempts:0},{message_id:'foreign',sender_id:'other',recipient_id:'intruder',link:'/malicious',status:'pending',attempts:0}],exchange_messages:[{id:'message'}],notification_subscriptions:[{id:'sub',user_id:'receiver',is_active:true,endpoint:'https://push.example.invalid',p256dh:'key',auth:'auth'}]};
 const result=await call({body:{recipient_id:'intruder',title:'Injected',message:'PRIVATE CHAT'}});
 assert.equal(result.statusCode,200);assert.equal(result.body.sent,1);
 const sent=global.__exchange.sent[0];assert.equal(sent.payload.title,'Tauschbörse');assert.ok(!JSON.stringify(sent.payload).includes('PRIVATE CHAT'));
 assert.ok(sent.payload.url.includes('thread=thread'));assert.equal(global.__exchange.exchange_push_queue[1].status,'pending','other senders untouched');
 assert.equal(global.__exchange.exchange_push_queue[0].status,'sent');
 assert.equal((await call()).body.sent,0,'completed delivery not sent again');
 console.log('PASS: push auth, TEST guard, outbound-disable, server-selected recipient/content, claim/deduplication; no real push sent');
}finally{for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}delete global.__exchange;}
