/** Public ÖFB staff preview; exact club/team URL only. No accounts or roles are changed here. */
function text(value) {
 return String(value||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
function photo(value) {
 try {const u=new URL(value,'https://vereine.oefb.at');return u.protocol==='https:'&&u.hostname==='vereine.oefb.at'&&/^\/netzwerk\/imagedownload\/[a-zA-Z0-9_.%-]+$/.test(u.pathname)&&!u.search?u.toString():null;}catch{return null;}
}
function extract(html) {
 const trainers=new Map(), schemaKeys=new Set();
 function visit(value, inheritedRole='', depth=0) {
  if(depth>12||!value||typeof value!=='object')return;
  if(Array.isArray(value)){value.slice(0,100).forEach(v=>visit(v,inheritedRole,depth+1));return;}
  const entries=Object.entries(value), strings=entries.filter(([,v])=>typeof v==='string');
  if(schemaKeys.size<70)entries.forEach(([key])=>{if(schemaKeys.size<70)schemaKeys.add(key);});
  const get=regex=>strings.find(([key,v])=>regex.test(key)&&text(v))?.[1]||'';
  const role=text(get(/funktion|rolle|position|bezeichnung|aufgabe/i))||inheritedRole;
  const staffRole=/trainer|betreuer|coach/i.test(role);
  const first=text(get(/^(vorname|firstName|personVorname|funktionaerVorname)$/i));
  const last=text(get(/^(nachname|lastName|personNachname|funktionaerNachname)$/i));
  let name=(first+' '+last).trim();
  if(!first||!last)name=text(get(/^(name|vollerName|trainerName|betreuerName|funktionaerName|personName|anzeigeName)$/i));
  if(staffRole&&/^[\p{L}][\p{L} .'-]{2,100}$/u.test(name)&&name.split(/\s+/).length>1&&!/trainer|betreuer|mannschaft|saison/i.test(name)) {
   const photoUrl=strings.map(([,v])=>photo(v)).find(Boolean)||null;
   const email=text(strings.map(([,v])=>v.replace(/^mailto:/i,'')).find(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))||'');
   const sourceRole=role.slice(0,120), key=name.toLocaleLowerCase('de')+'|'+sourceRole.toLowerCase();
   const previous=trainers.get(key);
   trainers.set(key,{name,sourceRole,photoUrl:photoUrl||previous?.photoUrl||null,email:email||previous?.email||'',role:/co[\s-]?trainer|assisten/i.test(sourceRole)?'co_trainer':/chef|head/i.test(sourceRole)?'head_coach':'trainer'});
  }
  for(const [key,child]of entries) {
   if(/kader|spieler|sponsor/i.test(key))continue;
   const next=/trainer|betreuer|coach/i.test(key)?(staffRole?role:key):role;
   if(child&&typeof child==='object')visit(child,next,depth+1);
  }
 }
 for(const match of html.matchAll(/SG\.container\.appPreloads\s*\[[^\]\r\n]+\]\s*=\s*(\[[\s\S]*?\])\s*;/g)){try{visit(JSON.parse(match[1]));}catch{/* never execute page scripts */}}
 return {trainers:[...trainers.values()].slice(0,40),schemaKeys:[...schemaKeys]};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let url;try{url=new URL(String(req.query?.url||''));}catch{return res.status(400).json({error:'Ungültiger ÖFB-Trainerlink.'});}
 if(url.protocol!=='https:'||url.hostname!=='vereine.oefb.at'||url.port||url.username||url.password||url.search||url.hash||!/^\/[a-z0-9-]+\/Mannschaften\/Saison-[a-z0-9-]+\/[a-z0-9-]+\/Trainer-Betreuer\/?$/i.test(url.pathname))return res.status(400).json({error:'Bitte den ÖFB-Mannschaftslink „Trainer & Betreuer“ verwenden.'});
 try{
  const upstream=await fetch(url.toString(),{redirect:'error',headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)throw Error('HTTP '+upstream.status);
  const html=await upstream.text();if(html.length>5000000)throw Error('Seite zu groß');
  const result=extract(html);
  return res.status(200).json({...result,sourceUrl:url.toString(),notice:result.trainers.length?'Trainer gefunden. Vorhandenes Profil auswählen und Identität prüfen.':'Keine Trainer erkannt. Bitte Link und Saison prüfen.'});
 }catch{return res.status(502).json({error:'Die ÖFB-Trainerseite ist derzeit nicht abrufbar.'});}
};
module.exports.extract=extract;
