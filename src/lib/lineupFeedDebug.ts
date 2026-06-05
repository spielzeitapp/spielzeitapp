export function lineupFeedDevLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.log(...args);
}

export function lineupFeedDevWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) console.warn(...args);
}
