/**
 * Read-only preview of public ÖFB club roster pages.
 * Never writes players or guesses IDs from names.
 */
function decode(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
}
function extract(html) {
  const players = new Map();
  // Only trust numeric IDs explicitly present in a player's own profile URL.
  const anchor = /<a\\b([^>]*href=["']([^"']+)["'][^>]*)>([\\s\\S]*?)<\\/a>/gi;
  let match;
  while ((match = anchor.exec(html)) !== null) {
    const href = decode(match[2]);
    if (!/spieler|player|profil/i.test(href)) continue;
    const id = href.match(/(?:[?&](?:spielerId|spieler|playerId|id|:p)=|\\/(?:Spieler|Spielerprofil|Player)\\/)(\\d{4,10})(?:[&#/?]|$)/i);
    if (!id) continue;
    const name = decode(match[3]);
    if (!/^[\\p{L}][\\p{L} .'-]{3,100}$/u.test(name) || name.split(/\\s+/).length < 2) continue;
    players.set(id[1], { externalPlayerId: id[1], name });
  }
  return [...players.values()].sort((a,b) => a.name.localeCompare(b.name, 'de'));
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let url;
  try { url = new URL(String(req.query?.url || '')); }
  catch { return res.status(400).json({ error: 'Ungültige Kader-URL.' }); }
  if (url.protocol !== 'https:' || url.hostname !== 'vereine.oefb.at' || !/^\\/[a-z0-9-]+\\/Mannschaften\\/Saison-[a-z0-9-]+\\/[a-z0-9-]+\\/Kader\\/?$/i.test(url.pathname))
    return res.status(400).json({ error: 'Bitte einen ÖFB-Mannschafts-Kaderlink verwenden.' });
  try {
    const upstream = await fetch(url.toString(), { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) return res.status(502).json({ error: 'ÖFB-Kaderseite antwortet mit HTTP ' + upstream.status });
    const html = await upstream.text();
    const players = extract(html);
    return res.status(200).json({ ok: true, players, count: players.length, sourceUrl: url.toString(),
      notice: players.length ? 'Spieler-IDs aus Profil-Links gefunden. Identitäten vor einer Zuordnung prüfen.' : 'Keine verlässlichen Spieler-IDs in öffentlichen Profil-Links gefunden. Keine Zuordnung vorgenommen.' });
  } catch (e) { return res.status(502).json({ error: 'ÖFB-Kaderseite derzeit nicht abrufbar: ' + (e?.message || String(e)) }); }
};
module.exports.extract = extract;
