const { createHash } = require('node:crypto');

const LIVE_PROJECT = 'shxugattqatahckhspwk';
const BASELINE_PATH = 'release/legacy-baseline.json';
const DENIED_VERSIONS = new Set(['20260818140000', '20260818140100']);
const SHA = /^[a-f0-9]{40}$/;
const MIGRATION = /^supabase\/migrations\/([0-9]{14})_([^/]+)\.sql$/;
const SUPPORTED_FUNCTION = 'supabase/functions/generate-club-communications/index.ts';

function validateBaseline(baseline) {
  if (baseline?.schema_version !== 1 || baseline.live_project !== LIVE_PROJECT ||
      !SHA.test(baseline.source_main ?? '') || !baseline.adopted_files ||
      Array.isArray(baseline.adopted_files) || typeof baseline.adopted_files !== 'object') {
    throw new Error('Trusted LIVE migration baseline is missing or invalid');
  }
  for (const [path, sha] of Object.entries(baseline.adopted_files)) {
    if (!MIGRATION.test(path) || !SHA.test(sha)) throw new Error('Invalid frozen migration entry');
  }
  return baseline;
}

// Adopt existing LIVE state without asserting that historic SQL versions ran.
// Only the baseline fetched from the pinned MAIN commit is trusted here.
function planDatabaseFiles(tree, history, approvals, baseline) {
  validateBaseline(baseline);
  const applied = new Map(history.map(row => [String(row.version), row]));
  const pending = [], frozen = [], alreadyApplied = [];
  const versions = new Set();
  for (const file of tree.filter(f => f.path.startsWith('supabase/migrations/') && f.path.endsWith('.sql'))) {
    const match = file.path.match(MIGRATION);
    if (!match || !SHA.test(file.sha)) throw new Error(`Noncanonical migration: ${file.path}`);
    const version = match[1];
    if (DENIED_VERSIONS.has(version)) throw new Error(`Excluded migration must not be deployed: ${file.path}`);
    if (baseline.adopted_files[file.path]) {
      if (baseline.adopted_files[file.path] !== file.sha) throw new Error(`Historical SQL changed: ${file.path}`);
      frozen.push(file);
      continue;
    }
    if (applied.has(version)) {
      alreadyApplied.push({ ...file, history: applied.get(version), approved: approvals?.[file.path] === file.sha });
      continue;
    }
    if (approvals?.[file.path] !== file.sha) throw new Error(`Migration not reviewed for LIVE: ${file.path}`);
    if (versions.has(version)) throw new Error(`Duplicate pending migration version: ${version}`);
    versions.add(version);
    pending.push({ ...file, version, name: match[2] });
  }
  return { pending: pending.sort((a, b) => a.path.localeCompare(b.path)), frozen, alreadyApplied };
}

function functionApproval(file, manifest) {
  return file.filename === SUPPORTED_FUNCTION && ['added', 'modified'].includes(file.status) &&
    SHA.test(file.sha ?? '') && manifest?.functions?.[file.filename] === file.sha;
}

function blobSha(content) {
  const data = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
}

module.exports = { LIVE_PROJECT, BASELINE_PATH, DENIED_VERSIONS, SUPPORTED_FUNCTION,
  validateBaseline, planDatabaseFiles, functionApproval, blobSha };
