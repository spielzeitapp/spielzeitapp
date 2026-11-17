import {createHmac} from 'node:crypto';
import {hookKey,LIVE_REF,LIVE_ORIGIN} from '../server/lib/authEmailHook.js';
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw Error('Missing Supabase access token');
const call=async(path,options={})=>{const r=await fetch(`https://api.supabase.com/v1/projects/${LIVE_REF}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});if(!r.ok)throw Error(`Management request: ${r.status}`);return r.json();};
const project=await call('');if(project.id!==LIVE_REF)throw Error('Unexpected project');
const keys=await call('/api-keys');const role=keys.find(k=>k.name==='service_role')?.api_key;if(!role)throw Error('Missing server key');
let key=hookKey(role,LIVE_REF);const uri=`${LIVE_ORIGIN}/api/parent/send-invite?auth_email_hook=1`;
let ready=false;
for(let attempt=0;attempt<30;attempt++){
 const raw=JSON.stringify({probe:true,setup:true}),id=crypto.randomUUID(),stamp=String(Math.floor(Date.now()/1000));
 const signature=createHmac('sha256',key).update(`${id}.${stamp}.${raw}`).digest('base64');
 try{const response=await fetch(uri,{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${role}`,'Content-Type':'application/json','webhook-id':id,'webhook-timestamp':stamp,'webhook-signature':`v1,${signature}`},body:raw});const data=await response.json();if(response.ok&&data.ok===true&&data.version==='market-auth-email-v1'&&/^[A-Za-z0-9+/]{43}=$/.test(data.webhookSecret||'')){key=Buffer.from(data.webhookSecret,'base64');ready=true;break;}}catch{}
 await new Promise(r=>setTimeout(r,10000));
}
if(!ready)throw Error('Deployed LIVE mail endpoint not ready; existing mail configuration preserved');
// Verify the returned key with the ordinary signed route before activation.
const signedRaw=JSON.stringify({probe:true}),signedId=crypto.randomUUID(),signedStamp=String(Math.floor(Date.now()/1000));
const signedSignature=createHmac('sha256',key).update(`${signedId}.${signedStamp}.${signedRaw}`).digest('base64');
const signedResponse=await fetch(uri,{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json','webhook-id':signedId,'webhook-timestamp':signedStamp,'webhook-signature':`v1,${signedSignature}`},body:signedRaw});
const signedData=await signedResponse.json();
if(!signedResponse.ok||signedData.ok!==true||signedData.version!=='market-auth-email-v1')throw Error('Signed LIVE probe failed; auth configuration preserved');
const before=await call('/config/auth');
if(before.hook_send_email_enabled&&before.hook_send_email_uri!==uri)throw Error('Existing different email hook; configuration preserved');
const patch={hook_send_email_enabled:true,hook_send_email_uri:uri,hook_send_email_secrets:`v1,whsec_${key.toString('base64')}`};
await call('/config/auth',{method:'PATCH',body:JSON.stringify(patch)});
const after=await call('/config/auth');
if(after.hook_send_email_enabled!==true||after.hook_send_email_uri!==uri)throw Error('Hook configuration readback failed');
for(const field of ['site_url','uri_allow_list','mailer_autoconfirm','smtp_sender_name','smtp_host','smtp_user','smtp_admin_email'])if(JSON.stringify(before[field])!==JSON.stringify(after[field]))throw Error('Unexpected auth configuration change');
console.log(JSON.stringify({ok:true,project:LIVE_REF,market_sender:'Vereinsmarkt',spielzeit_sender_preserved:true,signed_mail_endpoint_verified:true}));
