/**
 * Vercel: POST /api/send-reminders
 * Triggert die Supabase Edge Function `send-reminders` (Cron + manuell).
 */
import { timingSafeEqual } from 'crypto';

type IncomingHeaderRecord = Record<string, string | string[] | undefined>;

function getHeader(
  headers: Headers | IncomingHeaderRecord,
  key: string,
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(key) ?? headers.get(key.toLowerCase()) ?? undefined;
  }
  const lower = key.toLowerCase();
  const direct = headers[key] ?? headers[lower];
  if (direct == null) {
    for (const [h, v] of Object.entries(headers)) {
      if (h.toLowerCase() === lower) {
        return Array.isArray(v) ? v[0] : v;
      }
    }
    return undefined;
  }
  return Array.isArray(direct) ? direct[0] : direct;
}

function secretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

type VercelLikeReq = {
  method?: string;
  headers: IncomingHeaderRecord;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

function getBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim();
}

function getQuerySecret(req: VercelLikeReq): string | undefined {
  const q = req.query?.secret;
  if (typeof q === 'string' && q.length > 0) return q;
  if (Array.isArray(q) && q[0]) return q[0];
  if (req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      return u.searchParams.get('secret') ?? undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  console.log('[send-reminders] start', { method: req.method ?? 'unknown' });

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret) {
    console.error('[send-reminders] missing env CRON_SECRET');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }
  if (!supabaseUrl || !serviceRole) {
    console.error('[send-reminders] missing env SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const fromBearer = getBearerToken(getHeader(req.headers, 'authorization'));
  const fromQuery = getQuerySecret(req);
  const provided = fromBearer ?? fromQuery;

  if (!provided) {
    console.error('[send-reminders] auth failed: no secret');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!secretEquals(provided, cronSecret)) {
    console.error('[send-reminders] auth failed: invalid secret');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  console.log('[send-reminders] auth ok');

  const base = supabaseUrl.replace(/\/$/, '');
  const edgeUrl = `${base}/functions/v1/send-reminders`;

  try {
    console.log('[send-reminders] calling edge function', { url: edgeUrl });

    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRole}`,
      },
      body: JSON.stringify({}),
    });

    const text = await edgeRes.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { raw: text };
    }

    console.log('[send-reminders] edge response', {
      status: edgeRes.status,
      ok: edgeRes.ok,
    });

    res.status(edgeRes.ok ? 200 : edgeRes.status).json({
      ok: edgeRes.ok,
      edgeStatus: edgeRes.status,
      body: parsed,
    });
  } catch (e) {
    console.error('[send-reminders] fetch exception', e);
    res.status(502).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
