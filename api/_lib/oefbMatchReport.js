/** Public, read-only source report. Numeric IDs only; no database writes or player mapping. */
function extractReport(html, id) {
  const profileId = url => /^https:\/\/(www\.)?oefb\.at\/Profile\/Spieler\/(\d{1,10})(?:[/?]|$)/i.exec(String(url ?? ''))?.[2] ?? null;
  const blocks = [];
  for (const match of html.matchAll(/SG\.container\.appPreloads\['[^']+'\]\s*=\s*(\[.*?\]);/g)) {
    try { blocks.push(...JSON.parse(match[1])); } catch { /* Ignore unrelated malformed preloads. */ }
  }
  const title = blocks.find(b => b && String(b.spielUid) === id && b.heimMannschaft && b.gastMannschaft);
  if (!title) throw new Error('Report unavailable');
  const report = blocks.find(b => b && Array.isArray(b.gameData) && b.heimAufstellung && b.gastAufstellung);
  const text = value => typeof value === 'string' ? value.slice(0, 250) : '';
  const players = side => {
    const seen = new Set();
    return ['tor', 'abwehr', 'mittelfeld', 'sturm', 'weitere'].flatMap(k => Array.isArray(side?.[k]) ? side[k] : [])
      .filter(p => {
        if (!p?.name) return false;
        const key = profileId(p.url) ?? `${p.name}:${p.rueckennummer ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      })
      .map(p => ({ name: text(p.name), number: text(p.rueckennummer), externalPlayerId: profileId(p.url) })).slice(0, 40);
  };
  // ÖFB includes the halftime score in the final result, e.g. "4:0 (0:0)".
  // Anchor the whole value so abandoned/awarded or otherwise qualified scores
  // cannot silently become an ordinary completed result.
  const finalScore = /^\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*\(\s*\d{1,3}\s*:\s*\d{1,3}\s*\))?\s*$/.exec(String(title.ergebnis ?? ''));
  const displayMinute = event => {
    const label = String(event.minuteString ?? '').trim();
    const parsed = /^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?$/.exec(label);
    if (parsed) return Number(parsed[1]) + Number(parsed[2] ?? 0);
    // An explicit nonnumeric label (HT, etc.) is not an internal timeline minute.
    if (label) return null;
    return event.minute != null && Number.isFinite(Number(event.minute)) && Number(event.minute) >= 0 ? Number(event.minute) : null;
  };
  const events = (report?.gameData ?? []).filter(e => ['goal', 'playerchange', 'yellow', 'red', 'yellowred'].includes(e.type))
    .map(e => ({ type: e.type, minute: displayMinute(e),
      side: e.team === 'a' ? 'home' : e.team === 'b' ? 'away' : null,
      player: text(e.playerPrimary), externalPlayerId: profileId(e.url), secondPlayer: text(e.playerSecondary), ownGoal: e.eigentor === true,
      score: /^\d+\s*:\s*\d+$/.test(e.spielstand ?? '') ? String(e.spielstand).replace(/\s/g, '') : null }))
    .sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity)).slice(0, 200);
  return { id, home: text(title.heimMannschaft), away: text(title.gastMannschaft),
    score: finalScore ? `${Number(finalScore[1])}:${Number(finalScore[2])}` : null,
    venue: text(title.spielort), field: text(title.spielfeld), competition: text(title.bewerb),
    events, homePlayers: players(report?.heimAufstellung), awayPlayers: players(report?.gastAufstellung),
    sourceUrl: `https://www.oefb.at/bewerbe/Spiel/Spielbericht/${id}/`, updatedAt: new Date().toISOString() };
}
module.exports = async function handler(req, res) {
  for (const h of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) res.setHeader(h, 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = String(req.query?.id ?? '').trim();
  if (!/^\d{1,10}$/.test(id)) return res.status(400).json({ error: 'Ungültige ÖFB-Spielnummer.' });
  try {
    const upstream = await fetch(`https://www.oefb.at/bewerbe/Spiel/Spielbericht/${id}/`,
      { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) throw new Error('Upstream failed');
    const html = await upstream.text();
    if (html.length > 3000000) throw new Error('Report too large');
    return res.status(200).json(extractReport(html, id));
  } catch {
    return res.status(502).json({ error: 'Der ÖFB-Spielbericht ist derzeit nicht erreichbar.' });
  }
};
module.exports.extractReport = extractReport;
