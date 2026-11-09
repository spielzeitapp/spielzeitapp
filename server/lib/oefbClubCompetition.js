/** Resolve a club team's league through its exact season table and a matching league fixture. */
const { pageUrl, extract } = require('./oefbClubTable');
function blocks(html) {
  return [...html.matchAll(/SG\.container\.appPreloads\s*\[[^\]\r\n]+\]\s*=\s*(\[[\s\S]*?\])\s*;/g)].flatMap(m => {
    try { const value = JSON.parse(m[1]); return Array.isArray(value) ? value : []; } catch { return []; }
  });
}
function fixtureId(html, source, league) {
  const schedule = new URL(source.href.replace(/\/Tabellen\/?$/i, '/Spiele/'));
  for (const block of blocks(html)) {
    let detail; try { detail = new URL(block.detailUrl, schedule); } catch { continue; }
    if (detail.href.replace(/\/$/, '') !== schedule.href.replace(/\/$/, '') || !Array.isArray(block.spiele)) continue;
    for (const game of block.spiele) {
      if (game.art !== 'Liga' || game.bewerbBezeichnung !== league) continue;
      let link; try { link = new URL(game.spielUrl, schedule); } catch { continue; }
      if (link.origin !== schedule.origin || link.pathname.toLowerCase() !== `/${source.pathname.split('/')[1]}/Spielbericht/`.toLowerCase()) continue;
      const id = /(?:^|&):s=(\d{1,10})(?:&|$)/.exec(link.search.slice(1))?.[1];
      if (id) return id;
    }
  }
  throw Error('Kein Ligaspiel für diesen Bewerb verfügbar.');
}
function competitionId(html, id, league) {
  const report = blocks(html).find(b => String(b.spielUid) === id && b.bewerb === league && b.heimMannschaft && b.gastMannschaft);
  if (!report) throw Error('Bewerb nicht eindeutig zugeordnet.');
  const url = new URL(report.bewerbLink);
  const value = /^\/(?:bewerbe|noefv|stfv|ooefv|bfv|kfv|sfv|tfv|vfv|wfv)\/Bewerb\/(\d{1,10})\/?$/i.exec(url.pathname)?.[1];
  if (url.protocol !== 'https:' || !/^(?:www\.)?(?:oefb|noefv|stfv|ooefv|bfv|kfv|sfv|tfv|vfv|wfv)\.at$/i.test(url.hostname) || !value) throw Error('Ungültiger Bewerbslink.');
  return value;
}
async function read(url, signal) {
  const response = await fetch(url, { redirect: 'error', signal, headers: { Accept: 'text/html' } });
  if (!response.ok) throw Error('ÖFB nicht erreichbar.');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 3 * 1024 * 1024) throw Error('ÖFB-Seite zu groß.'); chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
module.exports = async function(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  let source; try { source = pageUrl(String(req.query?.url || '')); } catch { return res.status(400).json({ error: 'Ungültiger ÖFB-Tabellenlink.' }); }
  try {
    const signal = AbortSignal.timeout(20000);
    const table = extract(await read(source.href, signal), source);
    const id = fixtureId(await read(source.href.replace(/\/Tabellen\/?$/i, '/Spiele/'), signal), source, table.name);
    const resolved = competitionId(await read(`https://www.oefb.at/bewerbe/Spiel/Spielbericht/${id}/`, signal), id, table.name);
    return res.status(200).json({ competitionId: resolved });
  } catch { return res.status(502).json({ error: 'ÖFB-Liga konnte noch nicht zugeordnet werden. Die Vereinstabelle bleibt verfügbar.' }); }
};
module.exports.fixtureId = fixtureId;
module.exports.competitionId = competitionId;
