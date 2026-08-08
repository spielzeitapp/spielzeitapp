/**
 * STEP 2B: run conflict verification SQL on staging only.
 */
import fs from 'fs';

const TARGET = 'acbaecjzoabafbsjrzvr';
const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
if (!token.startsWith('sbp_')) {
  console.error('ABORT: token');
  process.exit(1);
}

const sql = fs.readFileSync('scripts/step2b-staging-conflict-verify.sql', 'utf8');
const proj = await fetch(`https://api.supabase.com/v1/projects/${TARGET}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
if (proj.name !== 'spielzeitapp-staging' || proj.id !== TARGET) {
  console.error('ABORT identity', proj);
  process.exit(1);
}
console.log('TARGET_OK', proj.name);

const res = await fetch(`https://api.supabase.com/v1/projects/${TARGET}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
console.log('STATUS', res.status);
console.log(text.slice(0, 2000));
if (!res.ok) process.exit(1);
