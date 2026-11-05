/** Resolve the selected team's photo from public ÖFB JSON, never execute page scripts. */
function pageUrl(value) {
 const u=new URL(value);
 if(u.protocol!=='https:'||u.hostname!=='vereine.oefb.at'||u.port||u.username||u.password||u.search||u.hash||!/^\/[a-z0-9-]+\/Mannschaften\/Saison-\d{4}-\d{2}\/[a-z0-9-]+\/Kader\/?$/i.test(u.pathname))throw Error('Bitte einen ÖFB-Mannschafts-Kaderlink verwenden.');
 return u;
}
function extract(html,source) {
 const path=source.pathname.replace(/\/$/,'').toLowerCase();let id=null;
 for(const m of html.matchAll(/SG\.container\.appPreloads\s*\[[^\]\r\n]+\]\s*=\s*(\[[\s\S]*?\])\s*;/g)) {
  let rows;try{rows=JSON.parse(m[1]);}catch{continue;}
  for(const row of Array.isArray(rows)?rows:[])for(const team of Array.isArray(row?.mannschaften)?row.mannschaften:[]) {
   try{const u=new URL(team.url,source);if(u.origin===source.origin&&u.pathname.replace(/\/$/,'').toLowerCase()===path&&/^[a-f0-9]{20}$/i.test(team.pictureId))id=team.pictureId.toLowerCase();}catch{}
  }
 }
 if(!id)throw Error('Für diese Mannschaft wurde kein eindeutiges Mannschaftsfoto gefunden. Bitte eine Bilddatei hochladen.');
 for(const m of html.matchAll(/<meta\b[^>]*>/gi)) {
  if(!/\bproperty\s*=\s*["']og:image["']/i.test(m[0]))continue;
  const raw=m[0].match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
  try{const u=new URL(raw,source);if(u.protocol==='https:'&&u.hostname==='vereine.oefb.at'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/vereine3\/images\/[a-z0-9_,.-]+\.(?:jpg|png|webp)$/i.test(u.pathname)&&u.pathname.toLowerCase().includes('_'+id+'-'))return u.href;}catch{}
 }
 throw Error('Das Mannschaftsfoto konnte nicht aus der ÖFB-Seite gelesen werden. Bitte eine Bilddatei hochladen.');
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let source;try{source=pageUrl(String(req.query?.url||''));}catch(e){return res.status(400).json({error:e.message});}
 try{
  let upstream;
  const identity=source.pathname.replace(/\/$/,'').toLowerCase();
  for(let attempt=0;attempt<3;attempt++){
   upstream=await fetch(source.href,{redirect:'manual',headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000)});
   if(![301,302,303,307,308].includes(upstream.status))break;
   const location=upstream.headers.get('location');if(!location)throw Error('Ungültige ÖFB-Weiterleitung.');
   const next=pageUrl(new URL(location,source).href);
   if(next.pathname.replace(/\/$/,'').toLowerCase()!==identity)throw Error('ÖFB-Weiterleitung gehört zu einer anderen Mannschaft.');
   await upstream.body?.cancel();source=next;
  }
  if(!upstream.ok)throw Error('ÖFB-Seite derzeit nicht verfügbar.');
  const reader=upstream.body.getReader();let total=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>3*1024*1024)throw Error('ÖFB-Seite ist zu groß.');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  let photoUrl=extract(Buffer.concat(chunks).toString('utf8'),source);
  // The sharing thumbnail is only 600px wide. Prefer the club page's own
  // 940x400 team image, but retain the verified thumbnail if unavailable.
  const larger=photoUrl.replace(/-1,0-600x315-600x315\.(jpg|png|webp)$/i,'-1,0-940x400-940x400.$1');
  if(larger!==photoUrl){try{
   const image=await fetch(larger,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(5000)});
   if(image.ok&&/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(image.headers.get('content-type')||''))photoUrl=larger;
  }catch{/* Keep the known source image on timeout or unavailable sizes. */}}

  return res.status(200).json({photoUrl,sourceUrl:source.href});
 }catch(e){return res.status(502).json({error:e.message||'Mannschaftsfoto konnte nicht geladen werden.'});}
};
module.exports.extract=extract;module.exports.pageUrl=pageUrl;
