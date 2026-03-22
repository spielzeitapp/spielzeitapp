/**
 * POST /api/push/subscribe — stabil ohne Supabase (temporär).
 */

type VercelLikeReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  let step = 'start';

  try {
    step = 'parse_body';
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    step = 'validate';
    const { endpoint, keys } = (body || {}) as {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({
        ok: false,
        step,
        error: 'Invalid subscription payload',
        body,
      });
      return;
    }

    const endpointStr = typeof endpoint === 'string' ? endpoint : String(endpoint);

    return res.status(200).json({
      ok: true,
      step: 'parsed-only',
      endpointPreview: endpointStr.slice(0, 40),
      hasKeys: true,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({
      ok: false,
      step,
      error: e.message || 'unknown',
      stack: e.stack,
    });
  }
}
