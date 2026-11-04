const { LIVE_PROJECT, BASELINE_PATH, SUPPORTED_FUNCTION, planDatabaseFiles, blobSha, functionApproval } = require('./releaseDatabase');

const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
async function readJson(gh, path, ref) {
  const file = await gh(`/contents/${path}?ref=${ref}`);
  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
}
async function readBlob(gh, file) {
  const blob = await gh(`/git/blobs/${file.sha}`);
  if (blob.encoding !== 'base64') throw new Error('Unexpected Git blob encoding');
  const content = Buffer.from(blob.content, 'base64').toString('utf8');
  if (blob.sha !== file.sha || blobSha(content) !== file.sha) throw new Error(`Git blob mismatch: ${file.path}`);
  return content;
}

async function publishRelease({ gh, db, verify, deployFunction, log = () => {} }) {
  const plan = await verify();
  const [tree, manifest, baseline, history] = await Promise.all([
    gh(`/git/trees/${plan.head}?recursive=1`),
    readJson(gh, 'release/live-plan.json', plan.head),
    readJson(gh, BASELINE_PATH, plan.main),
    db('select version, name, statements from supabase_migrations.schema_migrations'),
  ]);
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Candidate tree incomplete');
  const database = planDatabaseFiles(tree.tree, history, manifest.migrations, baseline);
  const sqlFiles = [];
  for (const file of database.pending) sqlFiles.push({ ...file, sql: await readBlob(gh, file) });
  // A resumed release may skip SQL only when its recorded content matches exactly.
  for (const file of database.alreadyApplied.filter(f => f.approved)) {
    const sql = await readBlob(gh, file);
    if (!Array.isArray(file.history.statements) || file.history.statements.join('\n').trim() !== sql.trim()) {
      throw new Error(`Applied version has different or missing recorded SQL: ${file.path}`);
    }
  }
  const functions = [];
  for (const file of plan.functions ?? []) {
    if (!functionApproval({ filename: file.path, status: 'modified', sha: file.sha }, manifest)) {
      throw new Error(`Server function is not approved: ${file.path}`);
    }
    functions.push({ ...file, content: await readBlob(gh, file) });
  }
  await verify();
  log(`Keeping ${database.frozen.length} frozen historical files without replay or history repair.`);
  if (sqlFiles.length) {
    // All reviewed schema changes and their exact source records commit together.
    const statements = sqlFiles.map(file => `${file.sql}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES (${literal(file.version)},${literal(file.name)},ARRAY[${literal(file.sql)}]::text[]);`);
    await db(`BEGIN;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='45s';\nSELECT pg_advisory_xact_lock(hashtextextended('spielzeit-manager-release',0));\n${statements.join('\n')}\nCOMMIT;`);
    log(`Committed ${sqlFiles.length} reviewed migrations; code promotion still pending.`);
  }
  await verify();
  for (const file of functions) {
    await deployFunction(file);
    log(`Deployed reviewed function ${file.path} (${file.sha}) with JWT validation.`);
  }
  await verify();
  await gh('/git/refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: plan.head, force: false }) });
  return { migrations: sqlFiles.length, functions: functions.length, frozen: database.frozen.length };
}

async function deployServerFunction(file, { token, request = fetch }) {
  if (!token || file.path !== SUPPORTED_FUNCTION || blobSha(file.content) !== file.sha) {
    throw new Error('Unsupported or unverified server function');
  }
  const slug = 'generate-club-communications';
  const form = new FormData();
  form.set('metadata', JSON.stringify({ entrypoint_path: 'index.ts', verify_jwt: true, name: slug }));
  form.append('file', new Blob([file.content], { type: 'application/typescript' }), 'index.ts');
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://api.supabase.com/v1/projects/${LIVE_PROJECT}/functions`;
  const response = await request(`${base}/deploy?slug=${slug}`, {
    method: 'POST', headers, body: form, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Server function deployment failed (${response.status}); schema may already be updated. Code promotion stopped.`);
  const result = await response.json();
  if (result.slug !== slug || result.status !== 'ACTIVE' || !Number.isInteger(result.version)) {
    throw new Error('Server function deployment response cannot be verified');
  }
  const check = await request(`${base}/${slug}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!check.ok) throw new Error('Cannot verify deployed function; code promotion stopped');
  const active = await check.json();
  if (active.slug !== slug || active.status !== 'ACTIVE' || active.verify_jwt !== true || active.version !== result.version) {
    throw new Error('Server function JWT, version or active-state verification failed');
  }
  return { slug, version: active.version, sha: file.sha };
}

async function finalizeRelease({ gh, db, head, publicVersion }) {
  const live = await gh('/git/ref/heads/main');
  const visible = await publicVersion();
  if (live.object.sha !== head || visible.sha !== head || visible.branch !== 'main') {
    throw new Error('Exact LIVE deployment is not confirmed; technical activation stopped');
  }
  const manifest = await readJson(gh, 'release/live-plan.json', head);
  if (manifest.post_deploy?.oefb_sync === true) {
    // Technical environment connection only. No TEST sources, tasks or team settings.
    await db("select oefb_sync.configure('https://spielzeitapp.at') as job_id");
    const rows = await db("select exists(select 1 from oefb_sync.config where singleton and origin='https://spielzeitapp.at') and exists(select 1 from cron.job where jobname='oefb-fixture-sync' and active) as ready");
    if (rows?.[0]?.ready !== true) throw new Error('LIVE technical sync activation could not be verified');
  }
}

module.exports = { publishRelease, deployServerFunction, finalizeRelease, readBlob, readJson };
