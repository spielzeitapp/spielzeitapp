/**
 * Brücke Service Worker ↔ App (Inbox / Push).
 * Minimaler Stub, damit der Build stabil bleibt; Logik kann bei Bedarf ergänzt werden.
 */
export function registerServiceWorkerInboxBridge(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
}
