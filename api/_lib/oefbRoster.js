/**
 * Read-only preview of public ÖFB club roster pages.
 * Never writes players or guesses IDs from names.
 */
function decode(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function extract(html) {
  const players = new Map();
  const normalizeName = (text) => decode(text).replace(/\s+/g, ' ').trim();
  const add = (urlText, label) => {
    const url = String(urlText).replace(/&amp;/g, '&').replace(/\\\//g, '/');
    // ÖFB uses /Profile/Spieler/1392818/Nino-Semellechner (including slug).
    const found = url.match(/\/Profile\/Spieler\/(\d{4,10})(?:\/([^"'?#\s<]+))?/i);
    if (!found) return;
    const slugName = found[2] ? decodeURIComponent(found[2]).replace(/[-_]+/g, ' ') : '';
    const name = normalizeName(label) || normalizeName(slugName);
    if (!/^[\p{L}][\p{L} .'-]{3,100}$/u.test(name) || name.split(/\s+/).length < 2) return;
    players.set(found[1], { externalPlayerId: found[1], name });
  };
  // Capture visible anchors, including nested images and names in the profile slug.
  const anchors = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchors)) {
    const href = match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const title = match[1].match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    add(href, normalizeName(match[2]) || normalizeName(title));
  }
  // Also recognize profile URLs embedded in the ÖFB preload / serialized data.
  // IDs must still be present in actual profile URLs, never inferred from names.
  const urls = /(?:https?:\/\/(?:www\.)?oefb\.at)?(?:\\\/|\/)Profile(?:\\\/|\/)Spieler(?:\\\/|\/)\d{4,10}(?:(?:\\\/|\/)[\p{L}\p{N}_%-]+)?/giu;
  for (const match of html.matchAll(urls)) add(match[0], '');
  return [...players.values()].sort((a,b) => a.name.localeCompare(b.name, 'de'));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let url;
  try { url = new URL(String(req.query?.url || '')); }
  catch { return res.status(400).json({ error: 'Ungültige Kader-URL.' }); }
  if (url.protocol !== 'https:' || url.hostname !== 'vereine.oefb.at' || !/^\/[a-z0-9-]+\/Mannschaften\/Saison-[a-z0-9-]+\/[a-z0-9-]+\/Kader\/?$/i.test(url.pathname))
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
