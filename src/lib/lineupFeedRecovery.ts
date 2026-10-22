import type { EnsureLineupFeedPostResult } from './ensureLineupFeedPost';

/** Bounded polling plus recovery on reconnect/foreground. Dedupe stays server-side. */
export function startLineupFeedRecovery(
  ensurePost: () => Promise<EnsureLineupFeedPostResult>,
): () => void {
  let stopped = false;
  let busy = false;
  let done = false;
  let attempts = 0;
  const run = async () => {
    if (stopped || busy || done) return;
    busy = true;
    attempts += 1;
    try {
      const result = await ensurePost();
      done = result.ok && (result.created || ['already_exists', 'duplicate_race', 'disabled', 'suppressed', 'match_finished'].includes(result.reason ?? ''));
      if (!result.ok) console.warn('[LineupFeed] kickoff publication failed', result.error);
    } catch (error) {
      console.warn('[LineupFeed] kickoff publication failed', error);
    } finally {
      busy = false;
    }
  };
  const onVisible = () => { if (document.visibilityState === 'visible') void run(); };
  const onOnline = () => { void run(); };
  const interval = window.setInterval(() => { if (attempts < 5) void run(); }, 15_000);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  void run();
  return () => {
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}
