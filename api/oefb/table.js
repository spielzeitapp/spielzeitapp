/** Read-only proxy for an ÖFB competition table. Competition IDs are numeric; no arbitrary URL is fetched. */
function extractTable(html) {
  const preload = /SG\.container\.appPreloads\['[^']+'\]=(\[.*?\]);/g;
  for (const match of html.matchAll(preload)) {
    let blocks;
    try { blocks = JSON.parse(match[1]); } catch { continue; }
    const table = blocks.find((block) => block && Array.isArray(block.eintraege) && typeof block.bewerbName === 'string');
    if (!table) continue;
    return normalizeTable(table);
  }
  return { error: 'Auf der ÖFB-Seite wurde keine Tabelle gefunden.' };
}

function normalizeTable(table) {
  if (!table || !Array.isArray(table.eintraege) || typeof table.bewerbName !== 'string') return { error: 'Die ÖFB-Tabelle ist derzeit nicht verfügbar.' };
  if (table.tabelleAusblenden) return { error: 'Der ÖFB zeigt für diesen Bewerb keine Tabelle.' };
  return {
    name: table.bewerbName,
    rows: table.eintraege.map((row) => ({
      rank: Number(row.rang),
      team: String(row.mannschaft ?? ''),
      logo: /^[a-f0-9]{20}$/i.test(String(row.mannschaftIconPublicUid ?? ''))
        ? `/api/oefb/table?view=logo&id=${String(row.mannschaftIconPublicUid).toLowerCase()}` : null,
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

module.exports = async function handler(req, res) {
  if (req.query?.view === 'logo') return require('../_lib/oefbLogo.js')(req, res);
  if (req.query?.view === 'report') return require('../_lib/oefbMatchReport.js')(req, res);
  if (req.query?.view === 'results') return require('../_lib/oefbCompetitionResults.js')(req, res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = String(req.query?.id ?? '').trim();
  if (!/^\d{1,10}$/.test(id)) return res.status(400).json({ error: 'Ungültige Bewerbsnummer.' });
  const sourceUrl = `https://www.oefb.at/bewerbe/Bewerb/${id}`;
  try {
    const backend = `http://portale-datenservice:8080/datenservice/rest/oefb/spielbetrieb/tabelleByPublicUid/${id}`;
    const proxyUrl = `https://www.oefb.at/proxy/oefb3/1469066385635312874_spielbetrieb_tabelle_${id}.json?proxyUrl=${encodeURIComponent(backend)}`;
    const upstream = await fetch(proxyUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': 'SpielzeitApp/1.0 (+table-view)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return res.status(502).json({ error: `ÖFB antwortete mit HTTP ${upstream.status}.` });
    const result = normalizeTable(await upstream.json());
    if (result.error) return res.status(502).json(result);
    return res.status(200).json({ ...result, sourceUrl, updatedAt: new Date().toISOString() });
  } catch {
    return res.status(502).json({ error: 'Die ÖFB-Tabelle ist derzeit nicht erreichbar.' });
  }
};

module.exports.extractTable = extractTable;

module.exports.normalizeTable = normalizeTable;
