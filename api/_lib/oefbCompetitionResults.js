/** Read-only league results. Only numeric competition/round IDs can reach the fixed ÖFB proxy. */
function logoUrl(id) {
  return /^[a-f0-9]{20}$/i.test(String(id ?? ''))
    ? `https://www.oefb.at/oefb2/images/1278650591628556536_${id}-1,0-120x120-120x120.png` : null;
}
function normalizeSchedule(data) {
  if (!Array.isArray(data.runden) || !Array.isArray(data.ergebnisse) || !Array.isArray(data.spiele)) throw new Error('Invalid schedule');
  const games = new Map();
  for (const row of [...data.ergebnisse, ...data.spiele]) {
    const kickoff = Number(row.anstoss);
    if (!row.heimMannschaft || !row.gastMannschaft || !Number.isFinite(kickoff) || kickoff <= 0) continue;
    const rawScore = String(row.ergebnisShort ?? '').trim();
    const cancelled = /abgesagt|abgebrochen|annulliert/i.test(String(row.status ?? ''));
    const score = !cancelled && /^\d+\s*:\s*\d+$/.test(rawScore) ? rawScore.replace(/\s/g, '') : null;
    const url = String(row.actionLink ?? '');
    const game = {
      home: String(row.heimMannschaft), away: String(row.gastMannschaft), round: Number(row.runde),
      homeLogo: logoUrl(row.heimMannschaftLogo), awayLogo: logoUrl(row.gastMannschaftLogo),
      kickoff: new Date(kickoff).toISOString(), score,
      status: cancelled ? 'Abgesagt' : row.live ? 'Live' : score ? 'Endstand' : 'Geplant',
      venue: String(row.spielortBezeichnung ?? ''),
      sourceUrl: /^https:\/\/(www\.)?oefb\.at\//i.test(url) ? url : null,
    };
    games.set(`${game.round}-${game.kickoff}-${game.home}-${game.away}`, game);
  }
  return {
    name: String(data.title ?? ''),
    rounds: data.runden.map((r) => ({ id: Number(r.runde), label: String(r.bezeichnung ?? '') }))
      .filter((r) => Number.isInteger(r.id) && r.id >= 0 && r.id <= 100 && r.label),
    games: [...games.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  };
}
module.exports = async function handler(req, res) {
  for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) res.setHeader(header, 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = String(req.query?.id ?? '').trim();
  const round = String(req.query?.round ?? '0').trim();
  if (!/^\d{1,10}$/.test(id) || !/^\d{1,3}$/.test(round) || Number(round) > 100) return res.status(400).json({ error: 'Ungültige Bewerbsnummer oder Runde.' });
  const roundId = Number(round);
  const backend = `http://portale-datenservice:8080/datenservice/rest/oefb/spielbetrieb/spielplanBewerbByPublicUid/${id};runde=${roundId}`;
  const url = `https://www.oefb.at/proxy/oefb3/1469066385635312874_spielbetrieb_spielplan_${id}_${roundId}.json?proxyUrl=${encodeURIComponent(backend)}`;
  try {
    const upstream = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!upstream.ok) throw new Error('Upstream failed');
    const result = normalizeSchedule(await upstream.json());
    return res.status(200).json({ ...result, round: roundId, sourceUrl: `https://www.oefb.at/bewerbe/Bewerb/${id}`, updatedAt: new Date().toISOString() });
  } catch {
    return res.status(502).json({ error: 'Die ÖFB-Liga-Ergebnisse sind derzeit nicht erreichbar. Bitte erneut versuchen.' });
  }
};
module.exports.normalizeSchedule = normalizeSchedule;
