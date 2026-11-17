import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {hookKey,verifyHook,buildAuthEmails,TEST_ORIGIN} from '../server/lib/authEmailHook.js';
const key=hookKey('fixture-server-key'),raw=JSON.stringify({probe:true}),id='fixture',stamp=String(Math.floor(Date.now()/1000));
const headers={'webhook-id':id,'webhook-timestamp':stamp,'webhook-signature':`v1,${createHmac('sha256',key).update(`${id}.${stamp}.${raw}`).digest('base64')}`};
assert.equal(verifyHook(raw,headers,key),true);assert.equal(verifyHook(raw+' ',headers,key),false);assert.equal(verifyHook(raw,headers,hookKey('wrong')),false);assert.equal(verifyHook(raw,headers,key,Date.now()+600000),false);assert.equal(verifyHook(raw,{},key),false);
const club='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a',invite='a'.repeat(64);
for(const market of [true,false])for(const type of ['signup','recovery','magiclink','invite','email','reauthentication']){
 const next=`/marktplatz/${club}?invite=${invite}&view=start`;
 const target=market?`${TEST_ORIGIN}/app/set-password?${new URLSearchParams({context:'vereinsmarkt',marketClub:club,next})}`:`${TEST_ORIGIN}/app`;
 const [mail]=buildAuthEmails({user:{email:'test@example.invalid'},email_data:{email_action_type:type,redirect_to:target,token_hash:'hash-fixture',token:'123456'}});
 assert.equal(mail.senderName,market?'Vereinsmarkt':'SpielzeitApp');assert.ok(mail.subject.endsWith(`· ${mail.senderName}`));
 if(type!=='reauthentication'){const link=new URL(mail.text.split('\n').find(l=>l.startsWith('https://')));assert.equal(link.searchParams.get('redirect_to'),target);assert.equal(link.searchParams.get('type'),type);assert.equal(link.searchParams.get('token'),'hash-fixture');}
}
const base={user:{email:'old@example.invalid',new_email:'new@example.invalid'},email_data:{email_action_type:'email_change',redirect_to:TEST_ORIGIN,token_hash:'new-hash',token_hash_new:'old-hash',token:'old-otp',token_new:'new-otp'}};
const mails=buildAuthEmails(base);assert.equal(mails.length,2);assert.equal(mails[0].to,'old@example.invalid');assert.match(mails[0].text,/token=old-hash/);assert.equal(mails[1].to,'new@example.invalid');assert.match(mails[1].text,/token=new-hash/);
delete base.email_data.token_hash_new;assert.equal(buildAuthEmails(base).length,1);
assert.throws(()=>buildAuthEmails({user:{email:'a'},email_data:{email_action_type:'recovery',redirect_to:'https://evil.invalid',token_hash:'hash'}}));
console.log('PASS: signed payloads, tamper/expiry rejection, contextual sender, recovery return/invite, all auth mail actions and secure email-change token mapping');
// Shared Vercel function keeps invitation JSON parsing and rejects unsigned hook calls.
const {Readable}=await import('node:stream');
const {default:handler,config}=await import('../api/parent/send-invite.js');
assert.equal(config.api.bodyParser,false);
async function request(raw,{method='POST',query={},headers={}}={}){
 const req=Readable.from([raw]);Object.assign(req,{method,query,headers});
 const result={};const res={setHeader(){},status(code){result.status=code;return this;},json(body){result.body=body;return this;},end(){return this;}};
 await handler(req,res);return result;
}
assert.equal((await request('{')).status,400);
assert.equal((await request('x'.repeat(131073))).status,413);
assert.equal((await request('',{method:'GET'})).status,405);
process.env.SUPABASE_URL='https://acbaecjzoabafbsjrzvr.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-server-key';
assert.equal((await request('{}',{query:{auth_email_hook:'1'}})).status,401);
assert.equal((await request(raw,{query:{auth_email_hook:'1'},headers})).status,503,'no configured transport must block activation');
console.log('PASS: shared serverless endpoint preserves JSON validation, method/size guards and signed hook isolation');
