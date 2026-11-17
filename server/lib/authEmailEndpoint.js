import {hookKey,verifyHook,buildAuthEmails,authEmailProject} from './authEmailHook.js';
import {isDirectMailConfigured,getWorld4YouSmtpConfig,sendDirectInviteEmail} from './sendParentInviteEmail.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 const secret=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
 let project;try{project=authEmailProject(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL);}catch{}
 if(!secret||!project)return res.status(503).json({error:{http_code:503,message:'Mailversand nicht verfügbar'}});
 let raw='';
 try{for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>131072)return res.status(413).end();}}
 catch{return res.status(400).end();}
 let payload;try{payload=JSON.parse(raw);}catch{return res.status(400).end();}
 let setupAuthorized=false;
 // Deployment bootstrap only: a currently valid server credential for this exact
 // Supabase project may obtain the derived webhook key. Normal auth emails still
 // require a webhook signature. No credentials or personal rows are logged.
 if(payload.probe===true&&payload.setup===true){
  const bearer=String(req.headers.authorization||'').match(/^Bearer ([^\s]+)$/)?.[1];
  if(bearer){try{
   const {createClient}=await import('@supabase/supabase-js');
   const client=createClient(`https://${project.ref}.supabase.co`,bearer,{auth:{persistSession:false,autoRefreshToken:false}});
   const {error}=await client.auth.admin.getUserById('00000000-0000-0000-0000-000000000000');
   setupAuthorized=error?.status===404&&error?.code==='user_not_found';
  }catch{}}
  if(!setupAuthorized)return res.status(401).end();
 }
 if(!setupAuthorized&&!verifyHook(raw,req.headers,hookKey(secret,project.ref)))return res.status(401).end();
 if(payload.probe===true){
  let ready=isDirectMailConfigured();
  const smtp=getWorld4YouSmtpConfig();
  if(smtp){try{const {default:nodemailer}=await import('nodemailer');const transport=nodemailer.createTransport({host:smtp.host,port:smtp.port,secure:smtp.secure,requireTLS:!smtp.secure,auth:{user:smtp.user,pass:smtp.pass},connectionTimeout:4000,greetingTimeout:4000,socketTimeout:4000,tls:{minVersion:'TLSv1.2'}});await transport.verify();transport.close();}catch{ready=false;}}
  else if(ready){try{const response=await fetch('https://api.resend.com/domains',{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`},signal:AbortSignal.timeout(4000)});ready=response.ok;}catch{ready=false;}}
  return res.status(ready?200:503).json({ok:ready,version:'market-auth-email-v1',...(ready&&setupAuthorized?{webhookSecret:hookKey(secret,project.ref).toString('base64')}:{})});
 }
 try{
  const emails=buildAuthEmails(payload,project);
  for(const mail of emails){const result=await sendDirectInviteEmail(mail);if(!result.ok)throw Error('Delivery failed');}
  return res.status(200).json({});
 }catch{return res.status(503).json({error:{http_code:503,message:'E-Mail konnte nicht versendet werden. Bitte erneut versuchen.'}});}
}
