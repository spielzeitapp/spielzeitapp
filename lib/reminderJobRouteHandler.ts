import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyCronAuth } from './notificationDispatchHandler';
import { processNotificationJob } from '../src/lib/reminders/processNotificationJob';
import type { NotificationJobRow } from '../src/lib/reminders/types';

function readEnv(key: string): string | undefined {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[key];
}

function getSupabaseUrl(): string | undefined {
  return readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
}

function mapRpcJobRow(row: Record<string, unknown>): NotificationJobRow {
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    team_id: String(row.team_id),
    kind: row.kind as NotificationJobRow['kind'],
    send_at: String(row.send_at),
    payload: (row.payload ?? {}) as NotificationJobRow['payload'],
    status: row.status as NotificationJobRow['status'],
    dedupe_key: String(row.dedupe_key),
    attempt_count: Number(row.attempt_count ?? 0),
    last_error: row.last_error != null ? String(row.last_error) : null,
    sent_at: row.sent_at != null ? String(row.sent_at) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

/**
 * POST { jobId: string } — claim_notification_job + processNotificationJob
 * Auth: wie /api/notifications/dispatch (Bearer CRON_SECRET / x-cron-secret)
 */
export async function handleReminderJobDispatch(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!verifyCronAuth(request)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Server: Supabase Service Role fehlt' }), {
      status: 500,
    });
  }

  let jobId: string | undefined;
  try {
    const body = (await request.json()) as { jobId?: string };
    jobId = typeof body.jobId === 'string' ? body.jobId.trim() : undefined;
  } catch {
    jobId = undefined;
  }

  if (!jobId) {
    return new Response(JSON.stringify({ ok: false, error: 'jobId required' }), { status: 400 });
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('[reminder-dispatch] POST jobId', jobId);

  const { data, error: rpcErr } = await admin.rpc('claim_notification_job', { p_job_id: jobId });

  if (rpcErr) {
    console.error('[reminder-dispatch] claim_notification_job RPC error', rpcErr);
    return new Response(JSON.stringify({ ok: false, error: rpcErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    console.log(
      '[reminder-dispatch] claim returned no row — evtl. send_at in der Zukunft, Status nicht pending/failed, oder attempt_count ≥ 5',
    );
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const job = mapRpcJobRow(rows[0] as Record<string, unknown>);
  const result = await processNotificationJob(admin, job);

  if (!result.ok) {
    console.error('[reminder-dispatch] process failed', result.error);
    return new Response(JSON.stringify({ ok: false, error: result.error ?? 'process failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
