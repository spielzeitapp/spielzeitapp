/** Abortable self-timer shared by local and remote shutter actions. */
export async function photoCountdown(seconds: number, signal: AbortSignal, tick: (remaining: number) => void): Promise<void> {
  for (let remaining = seconds; remaining > 0; remaining--) {
    signal.throwIfAborted();
    tick(remaining);
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 1000);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
  }
  signal.throwIfAborted();
}
