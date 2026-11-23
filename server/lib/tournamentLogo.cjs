const { cleanTournamentLogo } = require('./tournamentLogoCutout.cjs');

module.exports=async function(req,res){
 try {
  const url=new URL(String(req.query.logo));
  if(url.protocol!=='https:' || url.hostname!=='tournej.com' || url.username || url.password || url.search || !/^\/data\/images\/[a-z0-9/_.-]+$/i.test(url.pathname))return res.status(400).end();
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('unavailable');
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>2097152)throw Error('too large');
  const {PNG}=require('pngjs');
  const png=bytes[0]===137 ? PNG.sync.read(bytes) : require('jpeg-js').decode(bytes,{useTArray:true,maxResolutionInMP:2});
  if(png.width*png.height>2000000)throw Error('too large');
  const {removeOuterWhiteBackground}=await import('../../lib/logoBackground.mjs');
  const cutout = cleanTournamentLogo(png, removeOuterWhiteBackground);
  res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public, max-age=86400');return res.status(200).send(PNG.sync.write(cutout));
 } catch {res.setHeader('Cache-Control','no-store');return res.status(502).end();}
};
