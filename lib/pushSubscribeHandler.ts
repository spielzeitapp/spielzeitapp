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

export type PushSubscribeResult = {
  status: number;
  body: Record<string, unknown>;
};

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
 * POST /api/push/subscribe – reine Datenstruktur, kein Response-Objekt (Vercel-sicher).
 * Tabelle: public.notification_subscriptions
 */
export async function runPushSubscribeFromParts(input: PushSubscribeFromPartsInput): Promise<PushSubscribeResult> {
  let step = 'enter';

  try {
    console.log('[push/subscribe] entering route', {
      bodyLength: input.bodyText?.length ?? 0,
      hasAuthHeader: Boolean(input.authorizationHeader?.length),
    });

    step = 'parse-body';
    console.log('[push/subscribe] parse-body start');
    let parsed: SubscriptionPayload;
    try {
      const raw = typeof input.bodyText === 'string' ? input.bodyText : String(input.bodyText ?? '');
      parsed = raw.trim().length === 0 ? {} : (JSON.parse(raw) as SubscriptionPayload);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] parse-body end (error)', err.message);
      return {
        status: 400,
        body: {
          ok: false,
          step: 'parse-body',
          error: 'Ungültiges JSON',
          details: err.message,
        },
      };
    }
    console.log('[push/subscribe] parse-body end (ok)', {
      hasEndpoint: typeof parsed.endpoint === 'string',
      hasKeys: parsed.keys != null,
    });

    step = 'validate-payload';
    console.log('[push/subscribe] validate-payload start');
    const validated = validatePayload(parsed);
    if (!validated.ok) {
      console.warn('[push/subscribe] validate-payload result: invalid', validated.message);
      return {
        status: 400,
        body: {
          ok: false,
          step: 'validate-payload',
          error: validated.message,
          details: null,
        },
      };
    }
    console.log('[push/subscribe] validate-payload result: ok');

    step = 'create-supabase-client';
    console.log('[push/subscribe] create-supabase-client start');
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('[push/subscribe] create-supabase-client: missing env', {
        hasUrl: Boolean(supabaseUrl),
        hasServiceKey: Boolean(serviceKey),
      });
      return {
        status: 500,
        body: {
          ok: false,
          step: 'create-supabase-client',
          error: 'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen in der Server-Umgebung gesetzt sein',
          details: null,
        },
      };
    }

    let admin: SupabaseClient;
    try {
      admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      let hostHint: string | null = null;
      try {
        hostHint = new URL(supabaseUrl).host;
      } catch {
        hostHint = null;
      }
      console.log('[push/subscribe] supabase client created', { urlHost: hostHint });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] create-supabase-client failed', err.message, err.stack);
      return {
        status: 500,
        body: {
          ok: false,
          step: 'create-supabase-client',
          error: err.message,
          details: err.stack ?? null,
        },
      };
    }

    step = 'resolve-user';
    console.log('[push/subscribe] resolve-user start');
    const token = input.authorizationHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token || token.length === 0) {
      console.warn('[push/subscribe] resolve-user: no bearer token');
      return {
        status: 401,
        body: {
          ok: false,
          step: 'resolve-user',
          error: 'Authorization: Bearer <access_token> fehlt – user_id kann nicht ermittelt werden',
          details: null,
        },
      };
    }

    let userId: string;
    try {
      const {
        data: { user },
        error: userErr,
      } = await admin.auth.getUser(token);
      if (userErr) {
        console.error('[push/subscribe] resolve-user: getUser error', userErr.message, userErr.status);
        return {
          status: 401,
          body: {
            ok: false,
            step: 'resolve-user',
            error: userErr.message,
            details: userErr.status != null ? String(userErr.status) : null,
          },
        };
      }
      if (!user || typeof user.id !== 'string' || user.id.length === 0) {
        console.warn('[push/subscribe] resolve-user: no user or empty user_id');
        return {
          status: 401,
          body: {
            ok: false,
            step: 'resolve-user',
            error: 'Kein Benutzer bzw. keine user_id für dieses Token',
            details: null,
          },
        };
      }
      userId = user.id;
      console.log('[push/subscribe] resolve-user ok', { userId });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('[push/subscribe] resolve-user threw', err.message, err.stack);
      return {
        status: 500,
        body: {
          ok: false,
          step: 'resolve-user',
          error: err.message,
          details: err.stack ?? null,
        },
      };
    }

    const { endpoint, p256dh, auth: authKey } = validated;
    const now = new Date().toISOString();

    const row = {
      user_id: userId,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: input.userAgent ?? null,
      is_active: true as const,
      last_seen_at: now,
      updated_at: now,
    };

    step = 'save-subscription';
    console.log('[push/subscribe] save-subscription: insert/upsert attempt', {
      table: 'notification_subscriptions',
      userId,
      endpointPrefix: endpoint.slice(0, 72),
      p256dhLen: p256dh.length,
      authLen: authKey.length,
    });

    const { error: upsertError } = await admin.from('notification_subscriptions').upsert(row, {
      onConflict: 'endpoint',
    });

    if (upsertError) {
      console.error('[push/subscribe] save-subscription: insert/upsert result error', {
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint,
      });
      return {
        status: 500,
        body: {
          ok: false,
          step: 'save-subscription',
          error: upsertError.message,
          details: [upsertError.code, upsertError.details, upsertError.hint].filter(Boolean).join(' | ') || null,
        },
      };
    }

    console.log('[push/subscribe] save-subscription: insert/upsert result ok', { userId });
    return {
      status: 200,
      body: { ok: true },
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[push/subscribe] catch block full error', err, err.stack);
    return {
      status: 500,
      body: {
        ok: false,
        step,
        error: err.message || String(err),
        details: err.stack ?? null,
      },
    };
  }
}

/**
 * Next.js App Router: Request → plain result → Response
 */
export async function handlePushSubscribe(request: Request): Promise<Response> {
  try {
    const bodyText = await request.text();
    const result = await runPushSubscribeFromParts({
      bodyText,
      authorizationHeader: request.headers.get('authorization'),
      userAgent: request.headers.get('user-agent'),
    });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[push/subscribe] handlePushSubscribe catch', err.message, err.stack);
    return new Response(
      JSON.stringify({
        ok: false,
        step: 'request-read',
        error: err.message || String(err),
        details: err.stack ?? null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }
}
