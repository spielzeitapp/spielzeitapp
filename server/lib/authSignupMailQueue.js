import { createClient } from '@supabase/supabase-js';
import { authEmailProject } from './authEmailHook.js';
import { sendDirectInviteEmail } from './sendParentInviteEmail.js';

function queueClient(project, secret, timeout) {
  return createClient(`https://${project.ref}.supabase.co`, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeout) }),
    },
  });
}

export async function enqueueSignupMail(project, secret, deliveryId, payload, mail) {
  const { error } = await queueClient(project, secret, 2800).rpc('enqueue_auth_signup_mail', {
    p_delivery_id: deliveryId,
    p_user_id: payload.user.id,
    p_token_hash: payload.email_data.token_hash,
    p_mail: mail,
  });
  if (error?.code === 'PGRST202') return false;
  if (error) throw new Error('Signup mail enqueue failed');
  return true;
}

export async function deliverSignupMail(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const workerSecret = req.headers.authorization?.match(/^Bearer ([a-f0-9-]{72})$/)?.[1];
  if (!workerSecret) return res.status(401).end();

  try {
    const project = authEmailProject(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!secret) return res.status(503).end();
    const client = queueClient(project, secret, 6000);
    const { data, error } = await client.rpc('claim_auth_signup_mail', { p_worker_secret: workerSecret });
    if (error) return res.status(error.code === '42501' ? 401 : 503).end();

    const results = await Promise.allSettled(data.map(async (job) => {
      let delivered = false;
      try {
        delivered = (await sendDirectInviteEmail(job.mail)).ok;
      } finally {
        const { error: finishError } = await client.rpc('finish_auth_signup_mail', {
          p_delivery_id: job.delivery_id,
          p_lease: job.lease,
          p_delivered: delivered,
        });
        if (finishError) throw new Error('Could not finalize mail delivery');
      }
      return delivered;
    }));
    const delivered = results.filter((result) => result.status === 'fulfilled' && result.value).length;
    if (delivered !== data.length) console.error('[auth-signup-mail] delivery will be retried');
    return res.status(200).json({ delivered, claimed: data.length });
  } catch {
    return res.status(503).end();
  }
}
