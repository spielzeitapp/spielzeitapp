/** Stable same-origin PNGs for public ÖFB logos. Never accepts arbitrary URLs. */
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const id=String(req.query?.id??'');if(!/^[a-f0-9]{20}$/i.test(id))return res.status(400).json({error:'Ungültige Logo-ID.'});
 try {
  const upstream=await fetch(`https://www.oefb.at/oefb2/images/1278650591628556536_${id.toLowerCase()}-1,0-120x120-120x120.png`,{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!upstream.ok)throw Error('Logo unavailable');
  const bytes=Buffer.from(await upstream.arrayBuffer());if(bytes.length>2097152)throw Error('Too large');
  const {PNG}=require('pngjs');const png=PNG.sync.read(bytes);if(png.width*png.height>1000000)throw Error('Too large');
  const {removeOuterWhiteBackground}=await import('../../lib/logoBackground.mjs');removeOuterWhiteBackground(png);
  res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public, max-age=86400, stale-while-revalidate=604800');
  return res.status(200).send(PNG.sync.write(png));
 }catch{res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'ÖFB-Logo derzeit nicht erreichbar.'});}
};
