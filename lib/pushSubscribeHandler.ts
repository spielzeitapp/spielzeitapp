import { createClient } from '@supabase/supabase-js';

function readEnv(key: string): string | undefined {
  const g = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };
  return g.process?.env?.[key];
}

function getSupabaseUrl(): string | undefined {
  return readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
}

/**
 * POST /api/push/subscribe
 * Header: Authorization: Bearer <access_token>
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 */
export async function handlePushSubscribe(request: Request): Promise<Response> {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Server: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { endpoint, keys } = body;
  if (!endpoint || typeof endpoint !== 'string') {
    return new Response(JSON.stringify({ error: 'endpoint fehlt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!keys?.p256dh || !keys?.auth) {
    return new Response(JSON.stringify({ error: 'keys.p256dh und keys.auth fehlen' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ua = request.headers.get('user-agent');
  const now = new Date().toISOString();

  const { error } = await admin.from('notification_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: ua ?? null,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[push/subscribe] upsert', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
