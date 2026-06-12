/** Shared Web-Push helpers (Client). */

export const PUSH_SUBSCRIBE_API = '/api/push/subscribe';
export const PUSH_UNSUBSCRIBE_API = '/api/push/unsubscribe';
export const PUSH_TEST_API = '/api/push/test';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Nur VITE_VAPID_PUBLIC_KEY – muss mit Backend VAPID_PUBLIC_KEY identisch sein. */
export function getVapidPublicKey(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY != null) {
    return String(import.meta.env.VITE_VAPID_PUBLIC_KEY).trim();
  }
  return '';
}

export function textLooksLikeVapidMismatch(t: string): boolean {
  return /VapidPkHashMismatch/i.test(t);
}

export function isPushBrowserSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

export async function readPushStateFromBrowser(): Promise<{
  permission: NotificationPermission;
  subscriptionActive: boolean;
}> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { permission: 'default', subscriptionActive: false };
  }
  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return { permission, subscriptionActive: Boolean(sub) };
  } catch {
    return { permission, subscriptionActive: false };
  }
}

export function isPushFullyActive(
  permission: NotificationPermission,
  subscriptionActive: boolean,
): boolean {
  return subscriptionActive && permission === 'granted';
}
