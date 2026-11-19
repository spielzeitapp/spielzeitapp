const {createClient}=require('@supabase/supabase-js');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'GET erforderlich'});
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(url!=='https://acbaecjzoabafbsjrzvr.supabase.co')return res.status(403).json({error:'Nur TEST'});
 if(!key)return res.status(503).json({error:'Marktplatz derzeit nicht verfügbar'});
 const club=String(req.query.club||''),listing=String(req.query.listing||'');
 if(!UUID.test(club)||(listing&&!UUID.test(listing)))return res.status(400).json({error:'Ungültiger Link'});
 if(req.query.manifest==='1'){
  res.setHeader('Content-Type','application/manifest+json');
  return res.status(200).json({id:`/marktplatz/${club}`,name:'Vereinsmarkt · SpielzeitApp',short_name:'Vereinsmarkt',start_url:`/vereinsmarkt/${club}`,scope:'/',display:'standalone',background_color:'#08080b',theme_color:'#08080b',icons:[{src:'/vereinsmarkt/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/vereinsmarkt/icon-512.png',sizes:'512x512',type:'image/png'}]});
 }
 const ids=req.query.ids===undefined?null:String(req.query.ids).split(',');
 if(ids&&(!ids.length||ids.length>50||ids.some(id=>!UUID.test(id))))return res.status(400).json({error:'Ungültige Inserat-Auswahl'});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const c=await db.from('clubs').select('id,name').eq('id',club).eq('status','active').maybeSingle();
  if(c.error)throw c.error;if(!c.data)return res.status(404).json({error:'Verein nicht verfügbar'});
  let q=db.from('exchange_listings').select('id,title,category,size,condition,offer,price,description,status,photo_paths,created_at')
   .eq('club_id',club).eq('is_public',true).not('public_confirmed_at','is',null).in('status',['Verfügbar','Reserviert']);
  if(listing)q=q.eq('id',listing);
  if(ids)q=q.in('id',ids);
  const result=await q.order('created_at',{ascending:false}).limit(200);if(result.error)throw result.error;
  if(req.query.photo!==undefined){
   const index=Number(req.query.photo),item=result.data?.[0];
   if(!listing||!item||!Number.isInteger(index)||index<0||index>=item.photo_paths.length)return res.status(404).end();
   const path=item.photo_paths[index];
   if(!path.startsWith(club+'/')||path.split('/')[2]!==listing)return res.status(404).end();
   const file=await db.storage.from('exchange-photos').download(path);if(file.error||!file.data)return res.status(404).end();
   res.setHeader('Content-Type','image/jpeg');return res.status(200).send(Buffer.from(await file.data.arrayBuffer()));
  }
  // Explicit serialization: never return owner IDs, names, teams, paths or contacts.
  return res.status(200).json({club:c.data,items:(result.data||[]).map(i=>({id:i.id,title:i.title,category:i.category,size:i.size,condition:i.condition,offer:i.offer,price:i.price,description:i.description,status:i.status,created_at:i.created_at,photos:i.photo_paths.map((_,index)=>`/api/exchange/public?club=${club}&listing=${i.id}&photo=${index}`)}))});
 }catch{return res.status(503).json({error:'Angebote konnten nicht geladen werden. Bitte erneut versuchen.'});}
};
