import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * notifications (nach Migrationen):
 * - Pflicht: title, message, type ('manual' | 'auto')
 * - Optional: team_id, link, event_type, created_by
 * - Erweitert: user_id, event_id, read (Migration 20260328120000)
 */
type NotificationInsertRow = {
  user_id: string;
  team_id: string;
  event_id: string;
  title: string;
  message: string;
  read: boolean;
  type: 'auto';
  link: string | null;
  event_type: string | null;
};

export async function POST(req: Request): Promise<Response> {
  console.log('REMINDER DISPATCH START');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      const missing = [
        !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL (oder SUPABASE_URL)' : null,
        !serviceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      ]
        .filter(Boolean)
        .join(', ');
      console.error('REMINDER DISPATCH: fehlende Env', missing);
      return Response.json(
        { ok: false, error: `Missing environment: ${missing}` },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let jobId: string | undefined;
    try {
      const json = (await req.json()) as { jobId?: string };
      jobId = typeof json.jobId === 'string' ? json.jobId.trim() : undefined;
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!jobId) {
      return Response.json({ ok: false, error: 'Missing jobId' }, { status: 400 });
    }

    console.log('JOB ID', jobId);

    const { data: claimedJobs, error: claimError } = await supabase.rpc('claim_notification_job', {
      p_job_id: jobId,
    });

    if (claimError) {
      console.error('CLAIM ERROR', claimError);
      return Response.json({ ok: false, error: claimError.message }, { status: 500 });
    }

    console.log('CLAIMED JOB', claimedJobs);

    const claimed = Array.isArray(claimedJobs) ? claimedJobs : [];
    if (claimed.length === 0) {
      return Response.json(
        { ok: true, skipped: true, hint: 'Kein Job geclaimt (send_at in Zukunft, falscher Status oder max. Versuche)' },
        { status: 200 },
      );
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

    console.log('EVENT', event ?? null, eventError ?? null);

    if (eventError || !event) {
      await supabase
        .from('notification_jobs')
        .update({
          status: 'failed',
          last_error: eventError?.message ?? 'Event not found',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing');

      return Response.json(
        {
          ok: false,
          error: 'Event not found',
          detail: eventError?.message ?? null,
        },
        { status: 404 },
      );
    }

    const { data: users, error: usersError } = await supabase.from('profiles').select('id');

    if (usersError) {
      console.error('USERS QUERY ERROR', usersError);
      await supabase
        .from('notification_jobs')
        .update({
          status: 'failed',
          last_error: usersError.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing');

      return Response.json({ ok: false, error: usersError.message }, { status: 500 });
    }

    const userList = Array.isArray(users) ? users : [];
    console.log('USERS', userList.length);

    if (userList.length === 0) {
      await supabase
        .from('notification_jobs')
        .update({
          status: 'failed',
          last_error: 'No users found for test notification',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing');

      return Response.json({ ok: false, error: 'No users found for test notification' }, { status: 400 });
    }

    const messageBody = 'Erinnerung: Termin steht an';

    const rows: NotificationInsertRow[] = userList.map((u: { id: string }) => ({
      user_id: u.id,
      team_id: job.team_id,
      event_id: job.event_id,
      title: 'Reminder',
      message: messageBody,
      read: false,
      type: 'auto',
      link: `/app/events/${job.event_id}`,
      event_type: 'reminder',
    }));

    const { error: insertError } = await supabase.from('notifications').insert(rows);

    if (insertError) {
      console.error('NOTIFICATIONS INSERT ERROR', insertError);
      await supabase
        .from('notification_jobs')
        .update({
          status: 'failed',
          last_error: insertError.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing');

      return Response.json(
        {
          ok: false,
          error: insertError.message,
          hint:
            'Prüfe Migration notifications (user_id, event_id, read) und Spalten title, message, type.',
        },
        { status: 500 },
      );
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

    return Response.json({ ok: true, inserted: rows.length }, { status: 200 });
  } catch (error) {
    console.error('REMINDER DISPATCH ERROR', error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
