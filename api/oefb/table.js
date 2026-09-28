/** Read-only proxy for an ÖFB competition table. Competition IDs are numeric; no arbitrary URL is fetched. */
function extractTable(html) {
  const preload = /SG\.container\.appPreloads\['[^']+'\]=(\[.*?\]);/g;
  for (const match of html.matchAll(preload)) {
    let blocks;
    try { blocks = JSON.parse(match[1]); } catch { continue; }
    const table = blocks.find((block) => block && Array.isArray(block.eintraege) && typeof block.bewerbName === 'string');
    if (!table) continue;
    if (table.tabelleAusblenden) return { error: 'Der ÖFB zeigt für diesen Bewerb keine Tabelle.' };
    return {
      name: table.bewerbName,
      rows: table.eintraege.map((row) => ({
        rank: Number(row.rang),
        team: String(row.mannschaft ?? ''),
        played: Number(row.spiele ?? 0),
        won: Number(row.siege ?? 0),
        drawn: Number(row.unentschieden ?? 0),
        lost: Number(row.niederlagen ?? 0),
        goalsFor: Number(row.toreErzielt ?? 0),
        goalsAgainst: Number(row.toreErhalten ?? 0),
        goalDifference: Number(row.tordifferenz ?? 0),
        points: Number(row.punkte ?? 0),
      })).filter((row) => Number.isFinite(row.rank) && row.team),
    };
  }
  return { error: 'Auf der ÖFB-Seite wurde keine Tabelle gefunden.' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = String(req.query?.id ?? '').trim();
  if (!/^\d{1,10}$/.test(id)) return res.status(400).json({ error: 'Ungültige Bewerbsnummer.' });
  const sourceUrl = `https://www.oefb.at/bewerbe/Bewerb/${id}`;
  try {
    const upstream = await fetch(sourceUrl, {
      headers: { Accept: 'text/html', 'User-Agent': 'SpielzeitApp/1.0 (+table-view)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return res.status(502).json({ error: `ÖFB antwortete mit HTTP ${upstream.status}.` });
    const result = extractTable(await upstream.text());
    if (result.error) return res.status(502).json(result);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.status(200).json({ ...result, sourceUrl, updatedAt: new Date().toISOString() });
  } catch {
    return res.status(502).json({ error: 'Die ÖFB-Tabelle ist derzeit nicht erreichbar.' });
  }
};

module.exports.extractTable = extractTable;
