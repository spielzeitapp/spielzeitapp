/**
 * Vercel: POST /api/reminders/process
 * Cron (z. B. alle 15 Min): gleiche Auth wie /api/notifications/dispatch
 */
import { handleNotificationDispatch } from '../../lib/notificationDispatchHandler';

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

type VercelLikeReq = {
  method?: string;
  headers: IncomingHeaderRecord;
  body?: unknown;
};

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const host =
    getHeader(req.headers, 'x-forwarded-host') ?? getHeader(req.headers, 'host') ?? 'localhost';
  const proto = getHeader(req.headers, 'x-forwarded-proto') ?? 'https';
  const url = `${proto}://${host}/api/reminders/process`;

  const bodyStr =
    typeof req.body === 'string' ? req.body : req.body != null ? JSON.stringify(req.body) : '{}';

  const forwardHeaders = new Headers();
  const auth = getHeader(req.headers, 'authorization');
  if (auth) forwardHeaders.set('authorization', auth);
  const xs = getHeader(req.headers, 'x-cron-secret');
  if (xs) forwardHeaders.set('x-cron-secret', xs);

  const request = new Request(url, {
    method: 'POST',
    headers: forwardHeaders,
    body: bodyStr,
  });

  const response = await handleNotificationDispatch(request);
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  res.status(response.status).json(json);
}
