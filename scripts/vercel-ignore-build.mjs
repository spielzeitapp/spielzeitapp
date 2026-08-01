/**
 * Vercel Ignored Build Step.
 * Exit 0 = Build überspringen, Exit 1 = Build ausführen.
 *
 * Pro Vercel-Projekt Env setzen:
 *   VERCEL_DEPLOY_BRANCH=main      → nur Live
 *   VERCEL_DEPLOY_BRANCH=develop   → nur Staging
 *
 * Ohne VERCEL_DEPLOY_BRANCH: nur main und develop bauen (Feature-Branches skip).
 */
const ref = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
const raw = String(process.env.VERCEL_DEPLOY_BRANCH || 'main,develop').trim();
const allowed = raw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowed.includes(ref)) {
  console.log(`[vercel-ignore-build] build allowed for branch "${ref}" (allow=${allowed.join(',')})`);
  process.exit(1);
}

console.log(`[vercel-ignore-build] skip build for branch "${ref}" (allow=${allowed.join(',')})`);
process.exit(0);
