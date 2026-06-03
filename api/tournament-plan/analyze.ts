import {
  extractMeinTurnierplanId,
  isSupportedTournamentPlanHost,
  parseMeinTurnierplanJson,
  TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
  TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE,
  type TournamentPlanAnalysis,
} from '../../src/lib/tournamentPlanImport';

type VercelLikeReq = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

function queryParam(
  query: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string {
  const raw = query?.[key];
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}

async function fetchMeinTurnierplanJson(tournamentId: string): Promise<unknown> {
  const endpoint = `https://www.meinturnierplan.de/json/json.php?id=${encodeURIComponent(tournamentId)}`;
  const res = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Spielzeitapp/1.0 (+tournament-import)',
    },
  });
  if (!res.ok) {
    throw new Error(TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE);
  }
  return res.json();
}

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const url = queryParam(req.query, 'url').trim();
  if (!url) {
    res.status(400).json({ ok: false, error: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE });
    return;
  }

  if (!isSupportedTournamentPlanHost(url)) {
    res.status(422).json({ ok: false, error: TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE });
    return;
  }

  const tournamentId = extractMeinTurnierplanId(url);
  if (!tournamentId) {
    res.status(422).json({ ok: false, error: TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE });
    return;
  }

  try {
    const json = await fetchMeinTurnierplanJson(tournamentId);
    const analysis = parseMeinTurnierplanJson(json);
    if (!analysis) {
      res.status(422).json({ ok: false, error: TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE });
      return;
    }

    res.status(200).json({ ok: true, analysis } satisfies { ok: true; analysis: TournamentPlanAnalysis });
  } catch {
    res.status(502).json({ ok: false, error: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE });
  }
}
