import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(key: string): string | undefined {
  const g = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };
  return g.process?.env?.[key];
}

function getSupabaseUrl(): string | undefined {
  return readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
}

export type PushSubscribeErrorBody = {
  ok: false;
  step: string;
  error: string;
  details?: string;
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

type SubscriptionPayload = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function validatePayload(body: SubscriptionPayload): { ok: true; endpoint: string; p256dh: string; auth: string } | { ok: false; message: string } {
  const { endpoint, keys } = body;
  if (endpoint == null || typeof endpoint !== 'string' || endpoint.trim().length === 0) {
    return { ok: false, message: 'endpoint fehlt oder ist leer' };
  }
  if (keys == null || typeof keys !== 'object') {
    return { ok: false, message: 'keys fehlt' };
  }
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  if (p256dh == null || typeof p256dh !== 'string' || p256dh.trim().length === 0) {
    return { ok: false, message: 'keys.p256dh fehlt oder ist leer' };
  }
  if (auth == null || typeof auth !== 'string' || auth.trim().length === 0) {
    return { ok: false, message: 'keys.auth fehlt oder ist leer' };
  }
  return { ok: true, endpoint: endpoint.trim(), p256dh, auth };
}

export type PushSubscribeFromPartsInput = {
  bodyText: string;
  authorizationHeader: string | null;
  userAgent: string | null;
};

/**
 * Kernlogik POST /api/push/subscribe (Vercel ruft das direkt auf).
 * Header: Authorization: Bearer <access_token>
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 *
 * Tabelle public.notification_subscriptions (Migration 20260308120000):
 * user_id, endpoint, p256dh, "auth", user_agent, is_active, last_seen_at, updated_at
 */
export async function handlePushSubscribeFromParts(input: PushSubscribeFromPartsInput): Promise<Response> {
  const { bodyText, authorizationHeader, userAgent } = input;

  try {
    console.log('[push/subscribe] step: start', {
      bodyLength: bodyText?.length ?? 0,
      hasAuthHeader: Boolean(authorizationHeader?.length),
    });

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('[push/subscribe] step: env', { hasUrl: Boolean(supabaseUrl), hasServiceKey: Boolean(serviceKey) });
      return jsonResponse(500, {
        ok: false,
        step: 'env',
        error: 'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen in der Server-Umgebung gesetzt sein',
      });
    }

    let admin: SupabaseClient;
    try {
      admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      console.log('[push/subscribe] step: supabase-client', { urlHost: new URL(supabaseUrl).host });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] step: supabase-client', err.message, err.stack);
      return jsonResponse(500, {
        ok: false,
        step: 'supabase-client',
        error: err.message,
        details: err.stack,
      });
    }

    const token = authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      console.warn('[push/subscribe] step: auth', { mode: 'missing-bearer' });
      return jsonResponse(401, {
        ok: false,
        step: 'auth',
        error: 'Authorization: Bearer <access_token> fehlt',
      });
    }

    let userId: string;
    try {
      const {
        data: { user },
        error: userErr,
      } = await admin.auth.getUser(token);
      if (userErr) {
        console.error('[push/subscribe] step: auth-getUser', { message: userErr.message, status: userErr.status });
        return jsonResponse(401, {
          ok: false,
          step: 'auth-getUser',
          error: userErr.message,
        });
      }
      if (!user) {
        console.warn('[push/subscribe] step: auth-getUser', { mode: 'no-user' });
        return jsonResponse(401, {
          ok: false,
          step: 'auth-getUser',
          error: 'Kein Benutzer für dieses Token',
        });
      }
      userId = user.id;
      console.log('[push/subscribe] step: auth', { mode: 'jwt-user', userId });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] step: auth-getUser-throw', err.message, err.stack);
      return jsonResponse(500, {
        ok: false,
        step: 'auth-getUser',
        error: err.message,
        details: err.stack,
      });
    }

    let parsed: SubscriptionPayload;
    try {
      parsed = bodyText.trim().length === 0 ? {} : (JSON.parse(bodyText) as SubscriptionPayload);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] step: parse-json', err.message, { preview: bodyText.slice(0, 200) });
      return jsonResponse(400, {
        ok: false,
        step: 'parse-json',
        error: 'Ungültiges JSON',
        details: err.message,
      });
    }

    console.log('[push/subscribe] step: body-parsed', {
      hasEndpoint: typeof parsed.endpoint === 'string',
      hasKeys: parsed.keys != null,
    });

    const validated = validatePayload(parsed);
    if (!validated.ok) {
      console.warn('[push/subscribe] step: validation', { error: validated.message });
      return jsonResponse(400, {
        ok: false,
        step: 'validation',
        error: validated.message,
      });
    }

    const { endpoint, p256dh, auth: authKey } = validated;
    const now = new Date().toISOString();

    const row = {
      user_id: userId,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: userAgent ?? null,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    };

    console.log('[push/subscribe] step: supabase-upsert', {
      userId,
      endpointPrefix: endpoint.slice(0, 72),
      p256dhLen: p256dh.length,
      authLen: authKey.length,
    });

    const { error: upsertError } = await admin.from('notification_subscriptions').upsert(row, {
      onConflict: 'endpoint',
    });

    if (upsertError) {
      console.error('[push/subscribe] step: supabase-upsert', {
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint,
      });
      return jsonResponse(500, {
        ok: false,
        step: 'supabase-upsert',
        error: upsertError.message,
        details: [upsertError.code, upsertError.details, upsertError.hint].filter(Boolean).join(' | ') || undefined,
      });
    }

    console.log('[push/subscribe] step: ok', { userId });
    return jsonResponse(200, { ok: true });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[push/subscribe] step: unhandled', err.message, err.stack);
    return jsonResponse(500, {
      ok: false,
      step: 'unhandled',
      error: err.message,
      details: err.stack,
    });
  }
}

/**
 * Next.js / fetch-Handler: Body einmal lesen.
 */
export async function handlePushSubscribe(request: Request): Promise<Response> {
  try {
    const bodyText = await request.text();
    return await handlePushSubscribeFromParts({
      bodyText,
      authorizationHeader: request.headers.get('authorization'),
      userAgent: request.headers.get('user-agent'),
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[push/subscribe] handlePushSubscribe wrapper', err.message, err.stack);
    return jsonResponse(500, {
      ok: false,
      step: 'request-read',
      error: err.message,
      details: err.stack,
    });
  }
}
