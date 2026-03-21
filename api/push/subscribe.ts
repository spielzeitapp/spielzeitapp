/**
 * Vercel Serverless Function (Vite SPA): POST /api/push/subscribe
 * Gleiche Logik wie app/api/push/subscribe/route.ts (Next.js App Router).
 */
import { handlePushSubscribe } from '../../lib/pushSubscribeHandler';

type VercelLikeReq = {
  method?: string;
  headers: { authorization?: string; host?: string; 'user-agent'?: string; 'x-forwarded-host'?: string; 'x-forwarded-proto'?: string };
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

  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const url = `${proto}://${host ?? 'localhost'}/api/push/subscribe`;

  const bodyStr =
    typeof req.body === 'string'
      ? req.body
      : req.body != null
        ? JSON.stringify(req.body)
        : '{}';

  const headers = new Headers();
  const auth = req.headers.authorization;
  if (auth) headers.set('authorization', auth);
  const ua = req.headers['user-agent'];
  if (ua) headers.set('user-agent', ua);

  const request = new Request(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  });

  const response = await handlePushSubscribe(request);
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  res.status(response.status).json(json);
}
