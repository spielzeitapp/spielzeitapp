/**
 * GET /api/oefb/schedule?url=…
 * Lädt ÖFB-Vereinsseite und extrahiert SPIELPLAN_MANNSCHAFT aus appPreloads.
 */
function extractPreloadSpiele(html) {
  // ÖFB setzt viele appPreloads[…]-Blöcke; nur der mit SPIELPLAN_MANNSCHAFT zählt.
  const typeMarker = '"type":"SPIELPLAN_MANNSCHAFT"';
  const typeIdx = html.indexOf(typeMarker);
  if (typeIdx < 0) {
    return { error: 'Kein ÖFB-Spielplan-Preload (SPIELPLAN_MANNSCHAFT) gefunden.', spiele: [] };
  }

  let start = -1;
  for (let i = typeIdx; i >= 1; i--) {
    if (html[i] === '[' && html[i - 1] === '=') {
      start = i;
      break;
    }
  }
  if (start < 0) return { error: 'ÖFB-Preload-Format unbekannt.', spiele: [] };

  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return { error: 'ÖFB-Preload JSON unvollständig.', spiele: [] };

  let parsed;
  try {
    parsed = JSON.parse(html.slice(start, end + 1));
  } catch (e) {
    return { error: 'ÖFB-Preload JSON parse failed: ' + (e && e.message), spiele: [] };
  }

  const blocks = Array.isArray(parsed) ? parsed : [];
  const spielplan = blocks.find((b) => b && b.type === 'SPIELPLAN_MANNSCHAFT');
  const spiele = Array.isArray(spielplan?.spiele) ? spielplan.spiele : [];
  return {
    error: null,
    teamLabel: spielplan?.bezeichnung ? String(spielplan.bezeichnung) : null,
    spiele,
  };
}

function externalIdFromSpielUrl(spielUrl) {
  const s = String(spielUrl ?? '');
  const m = s.match(/[?&]:s=(\d+)/) || s.match(/[?&]s=(\d+)/);
  return m ? m[1] : null;
}

function mapFixture(raw, ourTeamHints) {
  const heim = String(raw.heimName ?? '').trim();
  const gast = String(raw.gastName ?? '').trim();
  const art = String(raw.art ?? '').trim();
  const hints = (ourTeamHints || []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  const heimNorm = heim.toLowerCase();
  const isHome =
    hints.length === 0
      ? false
      : hints.some((h) => heimNorm === h || heimNorm.includes(h) || h.includes(heimNorm));
  const opponent = isHome ? gast : heim;
  const externalId = externalIdFromSpielUrl(raw.spielUrl);
  const datumMs = Number(raw.datum);
  const startsAt =
    Number.isFinite(datumMs) && datumMs > 0 ? new Date(datumMs).toISOString() : null;
  const spielUrl = String(raw.spielUrl ?? '').trim();
  const absoluteUrl = spielUrl
    ? spielUrl.startsWith('http')
      ? spielUrl
      : `https://vereine.oefb.at${spielUrl.startsWith('/') ? '' : '/'}${spielUrl}`
    : null;
  const logoRel = isHome ? raw.gastLogo : raw.heimLogo;
  const logoUrl = logoRel
    ? String(logoRel).startsWith('http')
      ? String(logoRel)
      : `https://vereine.oefb.at${String(logoRel).startsWith('/') ? '' : '/'}${logoRel}`
    : null;

  return {
    art,
    opponent,
    is_home: isHome,
    starts_at: startsAt,
    competition: String(raw.bewerbBezeichnung ?? '').trim() || null,
    location: String(raw.spielort ?? '').trim() || null,
    external_id: externalId,
    external_url: absoluteUrl,
    opponent_logo_url: logoUrl,
    heim_name: heim,
    gast_name: gast,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawUrl = String(req.query?.url ?? '').trim();
  if (!rawUrl) {
    res.status(400).json({ error: 'url fehlt' });
    return;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: 'Ungültige URL' });
    return;
  }
  if (!/vereine\.oefb\.at$/i.test(parsedUrl.hostname) && !/\.oefb\.at$/i.test(parsedUrl.hostname)) {
    res.status(400).json({ error: 'Nur ÖFB-Vereins-URLs erlaubt.' });
    return;
  }

  const ourTeam = String(req.query?.ourTeam ?? '').trim();
  const ourTeamHints = ourTeam
    ? ourTeam.split('|').map((s) => s.trim()).filter(Boolean)
    : ['SPG Rohrbach', 'Rohrbach'];

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'SpielzeitApp/1.0 (+championship-import)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!upstream.ok) {
      res.status(502).json({ error: `ÖFB antwortete mit HTTP ${upstream.status}` });
      return;
    }
    const html = await upstream.text();
    const extracted = extractPreloadSpiele(html);
    if (extracted.error) {
      res.status(422).json({ error: extracted.error, fixtures: [] });
      return;
    }

    const fixtures = (extracted.spiele || [])
      .map((s) => mapFixture(s, ourTeamHints))
      .filter((f) => f.art === 'Liga' || f.art === 'Meisterschaft')
      .filter((f) => f.external_id && f.starts_at && f.opponent);

    res.status(200).json({
      ok: true,
      teamLabel: extracted.teamLabel,
      count: fixtures.length,
      fixtures,
      sourceUrl: parsedUrl.toString(),
    });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
};
