/** Only the selected club/team/season table; bounded read, JSON only. */
function pageUrl(value) {
 const u=new URL(value);
 if(u.protocol!=='https:'||u.hostname!=='vereine.oefb.at'||u.port||u.username||u.password||u.search||u.hash||!/^\/[a-z0-9-]+\/Mannschaften\/Saison-\d{4}-\d{2}\/[a-z0-9-]+\/Tabellen\/?$/i.test(u.pathname))throw Error('Ungültiger ÖFB-Mannschafts-Tabellenlink.');
 return u;
}
function extract(html,source) {
 for(const m of html.matchAll(/SG\.container\.appPreloads\s*\[[^\]\r\n]+\]\s*=\s*(\[[\s\S]*?\])\s*;/g)) {
  let blocks;try{blocks=JSON.parse(m[1]);}catch{continue;}
  for(const b of Array.isArray(blocks)?blocks:[]) {
   let link;try{link=new URL(b.detailUrl,source);}catch{continue;}
   if(link.origin!==source.origin||link.pathname.replace(/\/$/,'').toLowerCase()!==source.pathname.replace(/\/$/,'').toLowerCase())continue;
   const table=b.tabellen?.NORMAL;
   if(!table||table.tabelleAusblenden||!Array.isArray(table.eintraege))continue;
   const result=require('../../api/oefb/table.js').normalizeTable({...table,eintraege:table.eintraege.map(r=>({...r,mannschaft:r.mannschaftBezeichnung,mannschaftIconPublicUid:r.mannschaftLogoId}))});
   if(result.error)continue;
   const own=table.eintraege.filter(r=>String(r.vereinsnummern||'').split(/\s+/).includes(String(b.vereinsnummer)));
   return {...result, suggestedTeam:own.length===1?String(own[0].mannschaftBezeichnung):null};
  }
 }
 throw Error('Für diese Mannschaft ist keine öffentliche Gesamttabelle verfügbar.');
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 let source;try{source=pageUrl(String(req.query?.url||''));}catch(e){return res.status(400).json({error:e.message});}
 try{
  const r=await fetch(source.href,{redirect:'error',headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('ÖFB-Tabelle derzeit nicht erreichbar.');
  const reader=r.body.getReader();const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3*1024*1024)throw Error('ÖFB-Seite ist zu groß.');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  return res.status(200).json({...extract(Buffer.concat(chunks).toString('utf8'),source),sourceUrl:source.href,updatedAt:new Date().toISOString()});
 }catch(e){return res.status(502).json({error:e.message});}
};
module.exports.pageUrl=pageUrl;module.exports.extract=extract;
