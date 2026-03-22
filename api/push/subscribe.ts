/**
 * Vercel Serverless: POST /api/push/subscribe
 * Oberstes try/catch; dynamischer Import vermeidet Load-Crash ohne JSON.
 */
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
    console.log('[api/push/subscribe] entering route');

    let runPushSubscribeFromParts: (input: {
      bodyText: string;
      authorizationHeader: string | null;
      userAgent: string | null;
    }) => Promise<{ status: number; body: Record<string, unknown> }>;
    try {
      const mod = await import('../../lib/pushSubscribeHandler');
      runPushSubscribeFromParts = mod.runPushSubscribeFromParts;
      console.log('[api/push/subscribe] handler module loaded');
    } catch (importErr) {
      const err = importErr instanceof Error ? importErr : new Error(String(importErr));
      console.error('[api/push/subscribe] module import failed', err.message, err.stack);
      res.status(500).json({
        ok: false,
        step: 'module-load',
        error: err.message || String(importErr),
        details: err.stack ?? null,
      });
      return;
    }

    const method = typeof req.method === 'string' ? req.method : 'POST';
    if (method !== 'POST') {
      console.warn('[api/push/subscribe] method-check failed', { method });
      res.status(405).json({
        ok: false,
        step: 'method-check',
        error: 'Nur POST erlaubt',
        details: null,
      });
      return;
    }
    console.log('[api/push/subscribe] method-check ok');

    let bodyStr: string;
    try {
      console.log('[api/push/subscribe] parse-body (raw) start');
      bodyStr = bodyToString(req.body);
      console.log('[api/push/subscribe] parse-body (raw) end', { length: bodyStr.length });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[api/push/subscribe] parse-body (raw) failed', err.message, err.stack);
      res.status(400).json({
        ok: false,
        step: 'parse-body',
        error: 'Request-Body konnte nicht gelesen werden',
        details: err.stack ?? err.message,
      });
      return;
    }

    const auth = (req.headers as { authorization?: string }).authorization;
    const ua = req.headers['user-agent'];

    const result = await runPushSubscribeFromParts({
      bodyText: bodyStr,
      authorizationHeader: typeof auth === 'string' ? auth : null,
      userAgent: typeof ua === 'string' ? ua : null,
    });

    console.log('[api/push/subscribe] runPushSubscribeFromParts done', {
      status: result.status,
      ok: result.body?.ok,
      step: result.body?.step,
    });

    try {
      res.status(result.status).json(result.body);
    } catch (sendErr) {
      const err = sendErr instanceof Error ? sendErr : new Error(String(sendErr));
      console.error('[api/push/subscribe] res.json failed', err.message, err.stack);
      throw err;
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[api/push/subscribe] TOP LEVEL CATCH', err.message, err.stack);
    try {
      res.status(500).json({
        ok: false,
        step: 'vercel-handler',
        error: err.message || String(err),
        details: err.stack ?? null,
      });
    } catch (sendErr) {
      console.error('[api/push/subscribe] TOP LEVEL CATCH: could not send JSON', sendErr);
    }
  }
}
