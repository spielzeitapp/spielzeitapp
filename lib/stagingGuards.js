/**
 * Server-seitige Staging-Guards (Vercel API-Routen).
 * Staging darf keine echten Push-/Reminder-Jobs an Live-Nutzer auslösen.
 */
function readEnv(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function deployEnv() {
  return (readEnv('APP_ENV') || readEnv('VITE_APP_ENV') || '').toLowerCase();
}

/** Staging/Test: Outbound Push, Reminder-Cron, Team-Push deaktivieren. */
function isStagingOutboundDisabled() {
  if (readEnv('STAGING_DISABLE_OUTBOUND') === 'true') return true;
  const env = deployEnv();
  return env === 'staging' || env === 'test';
}

const LIVE_REF = 'shxugattqatahckhspwk';

function supabaseUrlLooksLikeLive(url) {
  return String(url || '')
    .toLowerCase()
    .includes(`${LIVE_REF}.supabase.co`);
}

/**
 * @returns {{ blocked: true, reason: string } | { blocked: false }}
 */
function assertStagingSafeToRunOutbound() {
  if (!isStagingOutboundDisabled()) {
    const url =
      readEnv('SUPABASE_URL') ||
      readEnv('NEXT_PUBLIC_SUPABASE_URL') ||
      readEnv('VITE_SUPABASE_URL');
    // Defense-in-depth: staging project must not use live DB even if APP_ENV missing
    if (deployEnv() === 'staging' && supabaseUrlLooksLikeLive(url)) {
      return {
        blocked: true,
        reason: 'Staging misconfigured: APP_ENV=staging but SUPABASE_URL points to live.',
      };
    }
    return { blocked: false };
  }
  return {
    blocked: true,
    reason: 'Staging outbound disabled (APP_ENV/VITE_APP_ENV=staging or STAGING_DISABLE_OUTBOUND).',
  };
}

module.exports = {
  isStagingOutboundDisabled,
  assertStagingSafeToRunOutbound,
  supabaseUrlLooksLikeLive,
  LIVE_REF,
};
