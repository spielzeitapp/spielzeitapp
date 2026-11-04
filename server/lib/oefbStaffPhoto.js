/** Fixed official image renderer for the photo IDs published on OFB staff pages. */
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).end();
 const id=String(req.query?.id||'').toLowerCase();
 if(!/^[a-f0-9]{20}$/.test(id))return res.status(400).end();
 try{
  const upstream=await fetch('https://www.oefb.at/oefb2/images/1278650591628556536_'+id+'-1,0-400x400-400x400.png',{redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)throw Error('Photo unavailable');
  const reader=upstream.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5*1024*1024)throw Error('Photo too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks);
  // The upstream sometimes labels JPEG bytes as PNG. Trust the verified signature.
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(!jpeg&&!png)throw Error('Not a portrait image');
  res.setHeader('Content-Type',jpeg?'image/jpeg':'image/png');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public,max-age=86400');
  return res.status(200).send(bytes);
 }catch{res.setHeader('Cache-Control','no-store');return res.status(502).end();}
};