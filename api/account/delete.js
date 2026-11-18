const {createClient}=require('@supabase/supabase-js');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'POST erforderlich.'});
 const url=String(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'').trim().replace(/\/$/,''),key=process.env.SUPABASE_SERVICE_ROLE_KEY,anon=process.env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
 if(!['https://acbaecjzoabafbsjrzvr.supabase.co','https://shxugattqatahckhspwk.supabase.co'].includes(url)||!key||!anon)return res.status(503).json({error:'Kontolöschung derzeit nicht verfügbar.'});
 const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(!token)return res.status(401).json({error:'Bitte zuerst anmelden.'});
 const body=req.body||{};
 if(body.confirmation!=='KONTO LÖSCHEN'||typeof body.password!=='string'||!body.password||body.password.length>1024||typeof body.captchaToken!=='undefined'&&typeof body.captchaToken!=='string')return res.status(400).json({error:'Bitte Löschung bestätigen und Passwort eingeben.'});
 let check;
 try{
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const db=createClient(url,key,options);
  const {data,error}=await db.auth.getUser(token);const user=data?.user;
  if(error||!user?.email||user.is_anonymous)return res.status(401).json({error:'Bitte erneut anmelden.'});
  // Never take a target user ID/email from the body. Password is only sent to Auth.
  if(user.factors?.some(f=>f.status==='verified'))return res.status(409).json({error:'Bei aktivierter Zwei-Faktor-Anmeldung nutze bitte Hilfe & Kontakt für die Kontolöschung.'});
  check=createClient(url,anon,options);
  const proof=await check.auth.signInWithPassword({email:user.email,password:body.password,options:body.captchaToken?{captchaToken:body.captchaToken}:undefined});
  if(proof.error||proof.data?.user?.id!==user.id)return res.status(401).json({error:'Passwort oder Sicherheitsprüfung nicht korrekt. Bitte erneut versuchen.'});
  // Preflight before touching files; bounded batches also remove orphan uploads.
  for(let batch=0;batch<6;batch++){
   const plan=await db.rpc('market_delete_account',{p_user_id:user.id,p_finish:false});
   if(plan.error)return res.status(plan.error.code==='P0001'?409:503).json({error:plan.error.code==='P0001'?plan.error.message:'Löschung konnte nicht vorbereitet werden. Bitte erneut versuchen.'});
   if(plan.data?.deleted)return res.status(200).json({deleted:true});
   const files=plan.data?.files;
   if(!Array.isArray(files))throw Error('Invalid deletion plan');
   if(!files.length){const done=await db.rpc('market_delete_account',{p_user_id:user.id,p_finish:true});if(done.error||done.data?.deleted!==true)throw Error('Account deletion incomplete');return res.status(200).json({deleted:true});}
   const paths=files.map(f=>{if(f.bucket!=='exchange-photos'||typeof f.path!=='string')throw Error('Invalid storage plan');return f.path;});
   const removed=await db.storage.from('exchange-photos').remove(paths);if(removed.error)throw Error('Storage deletion incomplete');
  }
  return res.status(503).json({error:'Es sind noch Fotos zu entfernen. Bitte die Kontolöschung erneut starten. Dein Konto ist noch vorhanden.'});
 }catch{return res.status(503).json({error:'Löschung noch nicht abgeschlossen. Dein Konto kann noch vorhanden sein; bitte erneut anmelden und versuchen oder Hilfe & Kontakt nutzen.'});}finally{if(check)await check.auth.signOut({scope:'local'}).catch(()=>{});}
};
