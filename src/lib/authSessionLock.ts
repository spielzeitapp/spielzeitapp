/** Keep cross-tab exclusion without the SDK's timeout recovery via steal:true.
 * Never retry a callback: it may already have refreshed a single-use token.
 */
export async function authSessionLock<R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let acquired = false;
  if (acquireTimeout > 0) timer = setTimeout(() => controller.abort(), Math.max(30000, acquireTimeout));
  try {
    return await navigator.locks.request(name,
      acquireTimeout === 0 ? { mode: 'exclusive', ifAvailable: true } : { mode: 'exclusive', signal: controller.signal },
      async lock => {
        if (!lock) throw Object.assign(new Error('Sitzung ist gerade beschäftigt. Bitte erneut versuchen.'), { isAcquireTimeout: true });
        acquired = true;
        clearTimeout(timer);
        return fn();
      });
  } catch (error) {
    if (!acquired && controller.signal.aborted) throw Object.assign(new Error('Sitzung ist gerade beschäftigt. Bitte erneut versuchen.'), { isAcquireTimeout: true });
    throw error;
  } finally { clearTimeout(timer); }
}
