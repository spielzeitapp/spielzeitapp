/**
 * Minimal Vercel Serverless: POST /api/push/subscribe
 * Keine lokalen Imports – nur dynamisches import('@supabase/supabase-js') bei DB-Schritt.
 *
 * Standard: nur "parsed-only" (200 JSON), kein DB-Zugriff.
 * DB: Vercel ENV PUSH_SUBSCRIBE_ENABLE_DB=true setzen.
 * Optional: PUSH_SUBSCRIBE_SKIP_AUTH=true + PUSH_SUBSCRIBE_DEBUG_USER_ID=<uuid> (nur Debug).
 */

type VercelLikeReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelLikeRes = {
  status: (code: number) => { json: (data: unknown) => void };
};

function safeSendJson(res: VercelLikeRes, status: number, payload: Record<string, unknown>): void {
  try {
    res.status(status).json(payload);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[push/subscribe] safeSendJson failed', err.message);
  }
}

function bodyToString(body: unknown): string {
  if (body == null) return '{}';
  if (typeof body === 'string') return body;
  if (typeof Buffer !== 'undefined' && typeof body === 'object' && body !== null && Buffer.isBuffer(body)) {
    return (body as Buffer).toString('utf8');
  }
  if (typeof body === 'object') return JSON.stringify(body);
  return String(body);
}

function readHeader(req: VercelLikeReq, name: string): string | null {
  const h = req.headers;
  if (!h) return null;
  const v = h[name] ?? h[name.toLowerCase() as keyof typeof h];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return v[0] ?? null;
  return null;
}

export default async function handler(req: VercelLikeReq, res: VercelLikeRes): Promise<void> {
  let step = 'start';

  try {
    console.log('[push/subscribe] route entered');

    step = 'method-check';
    const method = typeof req.method === 'string' ? req.method : 'GET';
    console.log('[push/subscribe] method', method);
    if (method !== 'POST') {
      safeSendJson(res, 405, {
        ok: false,
        step: 'method-check',
        error: 'Nur POST erlaubt',
        details: null,
      });
      return;
    }

    step = 'parse-body';
    let bodyStr: string;
    try {
      bodyStr = bodyToString(req.body);
      console.log('[push/subscribe] parse-body ok', { length: bodyStr.length });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] parse-body failed', err.message);
      safeSendJson(res, 400, {
        ok: false,
        step: 'parse-body',
        error: 'Request-Body konnte nicht gelesen werden',
        details: err.stack ?? err.message,
      });
      return;
    }

    step = 'parse-json';
    let parsed: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    try {
      const raw = bodyStr.trim().length === 0 ? '{}' : bodyStr;
      parsed = JSON.parse(raw) as typeof parsed;
      console.log('[push/subscribe] parse-json ok');
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] parse-json failed', err.message);
      safeSendJson(res, 400, {
        ok: false,
        step: 'parse-json',
        error: 'Ungültiges JSON',
        details: err.message,
      });
      return;
    }

    step = 'validate-payload';
    const endpoint = parsed.endpoint;
    const keys = parsed.keys;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    const epOk = typeof endpoint === 'string' && endpoint.trim().length > 0;
    const pOk = typeof p256dh === 'string' && p256dh.trim().length > 0;
    const aOk = typeof auth === 'string' && auth.trim().length > 0;

    console.log('[push/subscribe] payload validation', {
      hasEndpoint: epOk,
      hasP256dh: pOk,
      hasAuth: aOk,
    });

    if (!epOk || !pOk || !aOk) {
      safeSendJson(res, 400, {
        ok: false,
        step: 'validate-payload',
        error: 'endpoint, keys.p256dh und keys.auth sind erforderlich',
        details: { hasEndpoint: epOk, hasP256dh: pOk, hasAuth: aOk },
      });
      return;
    }

    const endpointStr = (endpoint as string).trim();
    const p256dhStr = (p256dh as string).trim();
    const authStr = (auth as string).trim();

    console.log('[push/subscribe] parsed payload', {
      endpointPreview: endpointStr.slice(0, 80),
      hasP256dh: p256dhStr.length > 0,
      hasAuth: authStr.length > 0,
    });

    const enableDb =
      process.env.PUSH_SUBSCRIBE_ENABLE_DB === '1' || process.env.PUSH_SUBSCRIBE_ENABLE_DB === 'true';

    const forceParsedOnly =
      process.env.PUSH_SUBSCRIBE_PARSED_ONLY === '1' || process.env.PUSH_SUBSCRIBE_PARSED_ONLY === 'true';

    if (!enableDb || forceParsedOnly) {
      console.log('[push/subscribe] parsed-only mode (no DB)', { enableDb, forceParsedOnly });
      safeSendJson(res, 200, {
        ok: true,
        step: 'parsed-only',
        endpointPreview: endpointStr.slice(0, 40),
        hasP256dh: true,
        hasAuth: true,
        hint: 'Setze PUSH_SUBSCRIBE_ENABLE_DB=true in Vercel, um die DB zu nutzen.',
      });
      return;
    }

    step = 'create-supabase-client';
    let createClient: (typeof import('@supabase/supabase-js'))['createClient'];
    try {
      const mod = await import('@supabase/supabase-js');
      createClient = mod.createClient;
      console.log('[push/subscribe] supabase module loaded');
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] create-supabase-client import failed', err);
      safeSendJson(res, 500, {
        ok: false,
        step: 'create-supabase-client',
        error: 'Supabase-Modul konnte nicht geladen werden',
        details: err.stack ?? err.message,
      });
      return;
    }

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('[push/subscribe] missing env for supabase');
      safeSendJson(res, 500, {
        ok: false,
        step: 'create-supabase-client',
        error: 'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen',
        details: null,
      });
      return;
    }

    let admin: ReturnType<typeof createClient>;
    try {
      admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      console.log('[push/subscribe] supabase client created');
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] createClient threw', err);
      safeSendJson(res, 500, {
        ok: false,
        step: 'create-supabase-client',
        error: err.message,
        details: err.stack ?? null,
      });
      return;
    }

    step = 'resolve-user';
    const ua = readHeader(req, 'user-agent');
    let userId: string;

    const skipAuth =
      process.env.PUSH_SUBSCRIBE_SKIP_AUTH === '1' || process.env.PUSH_SUBSCRIBE_SKIP_AUTH === 'true';
    const debugUserId = (process.env.PUSH_SUBSCRIBE_DEBUG_USER_ID ?? '').trim();

    if (skipAuth && debugUserId.length > 0) {
      userId = debugUserId;
      console.log('[push/subscribe] resolve-user: debug skip-auth', { userId: userId.slice(0, 8) + '…' });
    } else {
      const authHeader = readHeader(req, 'authorization');
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
      if (!token) {
        console.warn('[push/subscribe] resolve-user: no token');
        safeSendJson(res, 401, {
          ok: false,
          step: 'resolve-user',
          error: 'Authorization Bearer-Token fehlt (oder SKIP_AUTH+DEBUG_USER_ID setzen)',
          details: null,
        });
        return;
      }

      const {
        data: { user },
        error: userErr,
      } = await admin.auth.getUser(token);

      if (userErr) {
        console.error('[push/subscribe] resolve-user getUser error', userErr.message);
        safeSendJson(res, 401, {
          ok: false,
          step: 'resolve-user',
          error: userErr.message,
          details: userErr.status != null ? String(userErr.status) : null,
        });
        return;
      }

      if (!user?.id) {
        safeSendJson(res, 401, {
          ok: false,
          step: 'resolve-user',
          error: 'Keine user_id aus Token',
          details: null,
        });
        return;
      }

      userId = user.id;
      console.log('[push/subscribe] resolve-user ok');
    }

    step = 'save-subscription';
    const now = new Date().toISOString();
    const userAgentStr: string | null = ua == null ? null : String(ua);

    console.log('Saving subscription', {
      user_id: userId,
      endpoint: endpointStr.slice(0, 40),
      hasKeys: Boolean(p256dhStr) && Boolean(authStr),
    });

    const upsertPayload = [
      {
        user_id: userId,
        endpoint: endpointStr,
        p256dh: p256dhStr,
        auth: authStr,
        user_agent: userAgentStr,
        is_active: true,
        last_seen_at: now,
        updated_at: now,
      },
    ] as any;

    // TS: generische Tabellentypen lösen TS2769 – gesamte Kette als any
    const supabaseAny = admin as any;
    const { data, error } = await supabaseAny
      .from('notification_subscriptions')
      .upsert(upsertPayload, { onConflict: 'endpoint' })
      .select('id');

    if (error) {
      console.error('[push/subscribe] supabase insert/upsert error', error);
      safeSendJson(res, 500, {
        ok: false,
        step: 'supabase_insert',
        error: error.message,
        details: error,
      });
      return;
    }

    console.log('[push/subscribe] supabase write ok', { id: data?.[0]?.id ?? null });
    safeSendJson(res, 200, {
      ok: true,
      step: 'saved',
      id: data?.[0]?.id ?? null,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[push/subscribe] catch block full error', err.message, err.stack);
    safeSendJson(res, 500, {
      ok: false,
      step,
      error: err.message || String(e),
      details: err.stack ?? null,
    });
  }
}
