import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase URL or service role key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let jobId: string | undefined;
  try {
    const json = (await req.json()) as { jobId?: string };
    jobId = typeof json.jobId === 'string' ? json.jobId.trim() : undefined;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Missing jobId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: claimedJobs, error: claimError } = await supabase.rpc('claim_notification_job', {
    p_job_id: jobId,
  });

  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const claimed = Array.isArray(claimedJobs) ? claimedJobs : [];
  if (claimed.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const job = claimed[0] as {
    id: string;
    event_id: string;
    team_id: string;
  };

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', job.event_id)
    .single();

  if (eventError || !event) {
    await supabase
      .from('notification_jobs')
      .update({
        status: 'failed',
        last_error: eventError?.message ?? 'event not found',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('status', 'processing');

    return new Response(JSON.stringify({ error: eventError?.message ?? 'event not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: users, error: usersError } = await supabase.from('profiles').select('id');

  if (usersError) {
    await supabase
      .from('notification_jobs')
      .update({
        status: 'failed',
        last_error: usersError.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('status', 'processing');

    return new Response(JSON.stringify({ error: usersError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = 'Erinnerung: Termin steht an';
  const userList = Array.isArray(users) ? users : [];

  const rows = userList.map((u: { id: string }) => ({
    user_id: u.id,
    team_id: job.team_id,
    event_id: job.event_id,
    title: 'Reminder',
    /** DB-Spalte heißt `message`, nicht `body` */
    message: body,
    read: false,
    type: 'auto' as const,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('notifications').insert(rows);

    if (insertError) {
      await supabase
        .from('notification_jobs')
        .update({
          status: 'failed',
          last_error: insertError.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing');

      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  await supabase
    .from('notification_jobs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'processing');

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
