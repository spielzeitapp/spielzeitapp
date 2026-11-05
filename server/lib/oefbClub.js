/** Public, bounded club discovery. Never fetch arbitrary hosts or execute page scripts. */
function clubUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.hostname !== 'vereine.oefb.at' || u.port || u.username || u.password || u.search || u.hash || !/^\/[a-z0-9-]+(?:\/(?:News|Mannschaften))?\/?$/i.test(u.pathname)) throw Error('Bitte den ÖFB-Vereinslink eingeben (https://vereine.oefb.at/Vereinsname/).');
  return new URL('/' + u.pathname.split('/')[1] + '/News/', u.origin);
}
function extract(html, source, season) {
  const teams = new Map();
  for (const m of html.matchAll(/SG\.container\.appPreloads\s*\[[^\]\r\n]+\]\s*=\s*(\[[\s\S]*?\])\s*;/g)) {
    let rows; try { rows = JSON.parse(m[1]); } catch { continue; }
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!Array.isArray(row?.mannschaften) || row.saison !== season) continue;
      for (const t of row.mannschaften) {
        try {
          const u = new URL(t.url, source);
          const parts = u.pathname.match(/^\/([a-z0-9-]+)\/Mannschaften\/Saison-(\d{4}-\d{2})\/([a-z0-9-]+)\/Kader\/?$/i);
          if (!parts || u.origin !== source.origin || parts[1].toLowerCase() !== source.pathname.split('/')[1].toLowerCase() || parts[2] !== season.replace('/', '-') || u.search || u.hash) continue;
          const name = String(t.bezeichnung || '').trim().slice(0, 100);
          if (!name) continue;
          const base = u.origin + u.pathname.replace(/Kader\/?$/i, '');
          teams.set(base, { key: parts[3], name, rosterUrl: base + 'Kader/', scheduleUrl: base + 'Spiele/', tableUrl: base + 'Tabellen/', hasTeamPhoto: /^[a-f0-9]{20}$/i.test(t.pictureId || '') });
        } catch { /* Ignore unrelated/malformed links. */ }
      }
    }
  }
  return [...teams.values()];
}
async function readPage(url) {
  const r = await fetch(url, { redirect: 'error', headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw Error('ÖFB antwortet mit HTTP ' + r.status);
  const reader = r.body.getReader(); const chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 3 * 1024 * 1024) throw Error('ÖFB-Seite ist zu groß.'); chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let source; const season = String(req.query?.season || '');
  try { source = clubUrl(String(req.query?.url || '')); if (!/^\d{4}\/\d{2}$/.test(season) || Number(season.slice(5)) !== (Number(season.slice(0,4)) + 1) % 100) throw Error('Saison im Format 2026/27 angeben.'); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  try { const teams = extract(await readPage(source.href), source, season); return res.status(200).json({ teams, sourceUrl: source.href, season, notice: teams.length ? 'Nur Mannschaften aus der ausgewählten ÖFB-Vereinsseite. Spielgemeinschaften und doppelte Altersklassen bitte prüfen.' : 'Keine Mannschaften für diese Saison gefunden. Einzelimport bleibt verfügbar.' }); }
  catch (e) { return res.status(502).json({ error: e.message || 'Verein derzeit nicht erreichbar.' }); }
};
module.exports.clubUrl = clubUrl; module.exports.extract = extract;
