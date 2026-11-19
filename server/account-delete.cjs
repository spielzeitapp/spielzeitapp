const {createClient}=require('@supabase/supabase-js');
/** Self-service only. Never accept a target user ID from the caller. */
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST erforderlich.'});
 const url=String(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'').trim().replace(/\/$/,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!['https://acbaecjzoabafbsjrzvr.supabase.co','https://shxugattqatahckhspwk.supabase.co'].includes(url))return res.status(403).json({error:'Unbekannte Umgebung.'});
 if(!key)return res.status(503).json({error:'Kontolöschung ist derzeit nicht verfügbar.'});
 const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)return res.status(401).json({error:'Bitte erneut anmelden.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Ungültige Anfrage.'});}
 if(body?.confirmation!=='LÖSCHEN'||typeof body.password!=='string'||!body.password||body.password.length>1024)return res.status(400).json({error:'Bitte Passwort und LÖSCHEN eingeben.'});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const auth=await db.auth.getUser(token),user=auth.data?.user;
  if(auth.error||!user||user.is_anonymous||!user.email)return res.status(401).json({error:'Bitte erneut anmelden.'});
  const verify=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const checked=await verify.auth.signInWithPassword({email:user.email,password:body.password});
  if(checked.error||checked.data.user?.id!==user.id)return res.status(403).json({error:'Das Passwort stimmt nicht. Dein Konto wurde nicht gelöscht.'});
  if(checked.data.session?.access_token)await verify.auth.admin.signOut(checked.data.session.access_token,'local');
  const plan=await db.rpc('account_delete_plan',{p_user_id:user.id});
  if(plan.error)throw plan.error;
  if(plan.data?.blocked)return res.status(409).json({error:plan.data.reason});
  if(!Array.isArray(plan.data?.files))throw Error('Missing deletion plan');
  const files=plan.data.files;
  if(files.some(f=>f.bucket!=='exchange-photos'||typeof f.path!=='string'||f.path.split('/')[1]!==user.id))throw Error('Invalid deletion plan');
  for(let i=0;i<files.length;i+=100){const removed=await db.storage.from('exchange-photos').remove(files.slice(i,i+100).map(f=>f.path));if(removed.error)throw removed.error;}
  for(const table of ['push_subscriptions','notifications']){const cleared=await db.from(table).delete().eq('user_id',user.id);if(cleared.error)throw cleared.error;}
  const revoke=await db.auth.admin.signOut(token,'global');if(revoke.error)throw revoke.error;
  const deleted=await db.auth.admin.deleteUser(user.id,false);if(deleted.error)throw deleted.error;
  return res.status(200).json({deleted:true});
 }catch{return res.status(503).json({error:'Das Löschen konnte nicht vollständig abgeschlossen werden. Bitte melde dich erneut an und versuche es nochmals oder kontaktiere die Vereinsverwaltung.'});}
};
