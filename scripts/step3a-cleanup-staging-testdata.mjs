/**
 * STEP 3A: remove staging smoke-test data only. Never touches Live.
 */
const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';
const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
if (!token.startsWith('sbp_')) {
  console.error('ABORT: token');
  process.exit(1);
}

async function api(path, init) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return { res, text: await res.text() };
}

const proj = JSON.parse((await api(`/projects/${TARGET}`)).text);
if (proj.id !== TARGET || proj.name !== 'spielzeitapp-staging') {
  console.error('ABORT identity');
  process.exit(1);
}
console.log('CONFIRMED_TARGET', proj.name, proj.id);

const sql = `
-- Cleanup STEP3A smoke tests; keep events intact.
DELETE FROM public.training_session_exercises
WHERE training_session_id IN (
  SELECT id FROM public.training_sessions WHERE title = 'Trainingseinheit'
     OR title ILIKE 'STEP3A%'
)
OR exercise_id IN (
  SELECT id FROM public.training_exercises WHERE title ILIKE 'STEP3A TEST%'
);

DELETE FROM public.training_sessions
WHERE title = 'Trainingseinheit'
   OR title ILIKE 'STEP3A%';

DELETE FROM public.training_exercises
WHERE title ILIKE 'STEP3A TEST%';

SELECT
  (SELECT count(*)::int FROM public.training_exercises WHERE title ILIKE 'STEP3A%') AS leftover_exercises,
  (SELECT count(*)::int FROM public.training_sessions WHERE title ILIKE 'STEP3A%' OR title = 'Trainingseinheit') AS leftover_sessions,
  EXISTS (SELECT 1 FROM public.events WHERE id = 'a0cf098f-fbbd-4a01-aa9d-e5ec2fe6d7e4') AS event_still_exists;
`;

const out = await api(`/projects/${TARGET}/database/query`, {
  method: 'POST',
  body: JSON.stringify({ query: sql }),
});
console.log('CLEANUP', out.res.status, out.text);

const live = await api(`/projects/${LIVE}/database/query`, {
  method: 'POST',
  body: JSON.stringify({
    query: `SELECT to_regclass('public.training_exercises')::text AS live_te;`,
  }),
});
console.log('LIVE_CHECK', live.res.status, live.text);
