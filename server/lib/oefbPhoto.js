// Fixed-origin image fetch; no arbitrary URLs or redirects are forwarded.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  let url;
  try { url = new URL(String(req.query?.url || '')); } catch { return res.status(400).end(); }
  if (url.protocol !== 'https:' || url.host !== 'vereine.oefb.at' || url.username || url.password || url.search || url.hash || !/^\/netzwerk\/imagedownload\/[a-zA-Z0-9_.%-]+\.(?:jpe?g|png|webp)$/i.test(url.pathname)) return res.status(400).end();
  const larger = req.query?.quality === 'portrait' ? url.href.replace(/-80-80-([a-zA-Z0-9_%]+\.(?:jpe?g|png|webp))$/i, '-400-400-$1') : url.href;
  const sources = larger === url.href ? [url.href] : [larger, url.href];
  let status = 502;
  for (const source of sources) {
    try {
      const upstream = await fetch(source, {redirect:'error', signal:AbortSignal.timeout(12000), headers:{Accept:'image/jpeg,image/png,image/webp'}});
      const type = (upstream.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!upstream.ok || !['image/jpeg','image/png','image/webp'].includes(type)) {await upstream.body?.cancel();continue;}
      const reader = upstream.body.getReader(); const chunks = []; let size = 0;
      while (true) {
        const {done,value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 5 * 1024 * 1024) {await reader.cancel();status=413;break;}
        chunks.push(Buffer.from(value));
      }
      if(size>5*1024*1024)continue;
      const bytes = Buffer.concat(chunks);
      const valid = type === 'image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
        : type === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
      if (!valid) continue;
      res.setHeader('Content-Type',type);res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Cache-Control','public, max-age=86400');
      res.setHeader('CDN-Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
      res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(bytes);
    } catch {/* Keep the small source usable if the higher resolution is unavailable. */}
  }
  res.setHeader('Cache-Control','no-store');
  return res.status(status).end();
};
