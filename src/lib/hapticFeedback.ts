export const HAPTIC_KEY = 'haptic_enabled';

export function isHapticEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const value = localStorage.getItem(HAPTIC_KEY);
  return value !== 'false';
}

export function setHapticEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HAPTIC_KEY, enabled ? 'true' : 'false');
}

export function triggerHaptic(): void {
  if (!isHapticEnabled()) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(20);
  }
}
