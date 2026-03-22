/**
 * Vercel Serverless Function: POST /api/push/subscribe
 * Kein new Request() – vermeidet Laufzeitprobleme; Kern in handlePushSubscribeFromParts.
 */
import { handlePushSubscribeFromParts } from '../../lib/pushSubscribeHandler';

type VercelLikeReq = {
  method?: string;
  headers: {
    authorization?: string;
    host?: string;
    'user-agent'?: string;
    'x-forwarded-host'?: string;
    'x-forwarded-proto'?: string;
  };
  body?: unknown;
};

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

function bodyToString(body: unknown): string {
  if (body == null) return '{}';
  if (typeof body === 'string') return body;
  if (typeof Buffer !== 'undefined' && typeof body === 'object' && body !== null && Buffer.isBuffer(body)) {
    return (body as Buffer).toString('utf8');
  }
  if (typeof body === 'object') return JSON.stringify(body);
  return String(body);
}

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  try {
    // @vercel/node setzt ggf. kein method – Default POST
    const method = req.method ?? 'POST';
    console.log('[api/push/subscribe] incoming', { method });

    if (method !== 'POST') {
      res.status(405).json({ ok: false, step: 'method', error: 'Method not allowed' });
      return;
    }

    const bodyStr = bodyToString(req.body);
    console.log('[api/push/subscribe] body', {
      length: bodyStr.length,
      preview: bodyStr.slice(0, 400),
    });

    const auth = (req.headers as { authorization?: string }).authorization;
    const ua = req.headers['user-agent'];

    const response = await handlePushSubscribeFromParts({
      bodyText: bodyStr,
      authorizationHeader: typeof auth === 'string' ? auth : null,
      userAgent: typeof ua === 'string' ? ua : null,
    });

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { ok: false, step: 'response-parse', error: 'Invalid JSON from handler', raw: text.slice(0, 500) };
    }

    res.status(response.status).json(json);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[api/push/subscribe] fatal', err.message, err.stack);
    res.status(500).json({
      ok: false,
      step: 'vercel-handler',
      error: err.message,
      details: err.stack,
    });
  }
}
