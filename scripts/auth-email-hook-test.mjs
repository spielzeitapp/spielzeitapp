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

for(const type of ['password_changed_notification','email_changed_notification','phone_changed_notification','identity_linked_notification','identity_unlinked_notification','mfa_factor_enrolled_notification','mfa_factor_unenrolled_notification']){const [notice]=buildAuthEmails({user:{email:'current@example.invalid'},email_data:{email_action_type:type,site_url:TEST_ORIGIN,old_email:'old@example.invalid'}});assert.equal(notice.to,type==='email_changed_notification'?'old@example.invalid':'current@example.invalid');assert.doesNotMatch(notice.text,/verify|token=/);}
console.log('PASS: all Supabase security notification types remain deliverable without verification tokens');

const liveModule=await import('../server/lib/authEmailHook.js');
const liveProject=liveModule.authEmailProject('https://shxugattqatahckhspwk.supabase.co/');
assert.equal(liveProject.origin,'https://spielzeitapp.at');
assert.throws(()=>liveModule.authEmailProject('https://other.supabase.co'));
const liveMail=liveModule.buildAuthEmails({user:{email:'synthetic@example.invalid'},email_data:{email_action_type:'recovery',token_hash:'synthetic-hash',redirect_to:'https://spielzeitapp.at/app/set-password?context=vereinsmarkt'}},liveProject)[0];
assert.equal(liveMail.senderName,'Vereinsmarkt');
assert.ok(liveMail.text.includes('https://shxugattqatahckhspwk.supabase.co/auth/v1/verify?'));
assert.ok(!liveMail.html.includes('app.spielzeitapp.at'));
assert.throws(()=>liveModule.buildAuthEmails({user:{email:'synthetic@example.invalid'},email_data:{email_action_type:'signup',token_hash:'hash',redirect_to:'https://app.spielzeitapp.at/'}},liveProject));
assert.notDeepEqual(liveModule.hookKey('synthetic',liveProject.ref),liveModule.hookKey('synthetic'));
console.log('PASS: LIVE links, contextual sender, TEST/LIVE origin and signature-key isolation');
// A deployment may hold another valid service credential from the same project.
// Only a server-verified admin credential may bootstrap the derived hook key.
const originalFetch=globalThis.fetch;
const setupRaw=JSON.stringify({probe:true,setup:true});
let adminLookups=0;
globalThis.fetch=async(url,opts)=>{
 const u=String(url);
 if(u.includes('/auth/v1/admin/users/')){
  adminLookups++;
  assert.equal(u,'https://acbaecjzoabafbsjrzvr.supabase.co/auth/v1/admin/users/00000000-0000-0000-0000-000000000000');
  const authorization=new Headers(opts?.headers).get('Authorization');
  return new Response(JSON.stringify(authorization==='Bearer valid-synthetic-admin'?{code:'user_not_found',msg:'User not found'}:{code:'not_admin',msg:'Not authorized'}),{status:authorization==='Bearer valid-synthetic-admin'?404:403,headers:{'Content-Type':'application/json','x-supabase-api-version':'2024-01-01'}});
 }
 if(u==='https://api.resend.com/domains')return new Response('{}',{status:200});
 throw Error('Unexpected external request in fixture');
};
process.env.RESEND_API_KEY='synthetic-resend';
assert.equal((await request(setupRaw,{query:{auth_email_hook:'1'}})).status,401);
assert.equal(adminLookups,0);
assert.equal((await request(setupRaw,{query:{auth_email_hook:'1'},headers:{authorization:'Bearer wrong-project-or-anon'}})).status,401);
const bootstrap=await request(setupRaw,{query:{auth_email_hook:'1'},headers:{authorization:'Bearer valid-synthetic-admin'}});
assert.equal(bootstrap.status,200);assert.equal(bootstrap.body.ok,true);
assert.equal(bootstrap.body.webhookSecret,hookKey('fixture-server-key').toString('base64'));
const normalProbe=await request(raw,{query:{auth_email_hook:'1'},headers});
assert.equal(normalProbe.status,200);assert.equal(normalProbe.body.webhookSecret,undefined);
assert.equal((await request(JSON.stringify({email_data:{email_action_type:'signup'}}),{query:{auth_email_hook:'1'},headers:{authorization:'Bearer valid-synthetic-admin'}})).status,401,'admin bootstrap cannot substitute for an auth-mail signature');
globalThis.fetch=originalFetch;delete process.env.RESEND_API_KEY;
console.log('PASS: admin-verified deployment bootstrap, wrong credentials rejected, no key in normal probes, mail signatures remain mandatory');
