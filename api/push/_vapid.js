/**
 * Backend liest ausschließlich process.env:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * Keine NEXT_PUBLIC_*, VITE_* oder andere Namen.
 */
import webpush from "web-push";

/** Einzige Env-Namen, die für web-push gelesen werden */
export const VAPID_ENV_KEYS_USED = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

export function getVapidEnv() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = (process.env.VAPID_SUBJECT || "").trim();
  return { publicKey, privateKey, subject };
}

/**
 * web-push: setVapidDetails(subject, publicKey, privateKey)
 * Genau die drei Werte aus VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
 */
export function ensureVapid() {
  const { publicKey, privateKey, subject } = getVapidEnv();
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT müssen gesetzt sein (nur diese drei Namen).",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function previewPublic12(pk) {
  if (!pk || pk.length < 1) return null;
  return pk.slice(0, 12);
}

function previewPrivateFirst6Last6(pk) {
  if (!pk || pk.length < 1) return null;
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}…${pk.slice(-6)}`;
}

/**
 * Temporär für Push-Send-Responses: zeigt, welche Keys geladen sind (kein voller Private Key).
 */
export function getVapidSendResponseDebug() {
  const { publicKey, privateKey, subject } = getVapidEnv();
  return {
    vapidPublicPresent: Boolean(publicKey),
    vapidPrivatePresent: Boolean(privateKey),
    vapidSubjectPresent: Boolean(subject),
    vapidPublicPreview: previewPublic12(publicKey),
    vapidPrivatePreview: previewPrivateFirst6Last6(privateKey),
    vapidSubject: subject || null,
    vapidEnvKeysRead: [...VAPID_ENV_KEYS_USED],
  };
}

function previewPublicKeyOld(pk) {
  if (!pk || pk.length < 16) return pk || null;
  return `${pk.slice(0, 20)}…${pk.slice(-6)}`;
}

function previewPrivateKeyOld(pk) {
  if (!pk || pk.length < 6) return null;
  return `…${pk.slice(-8)}`;
}

/**
 * Für GET /api/push/test, GET /api/push/subscribe (älteres Format).
 */
export function getVapidDebugInfo() {
  const { publicKey, privateKey, subject } = getVapidEnv();
  return {
    publicKeyPresent: Boolean(publicKey),
    privateKeyPresent: Boolean(privateKey),
    subjectPresent: Boolean(subject),
    publicKeyPreview: publicKey ? previewPublicKeyOld(publicKey) : null,
    privateKeyPreview: privateKey ? previewPrivateKeyOld(privateKey) : null,
    subject: subject || null,
    vapidEnvKeysRead: [...VAPID_ENV_KEYS_USED],
  };
}

export function logVapidBeforeSend(routeLabel, extra) {
  const d = getVapidSendResponseDebug();
  console.log(`[${routeLabel}] vapid`, {
    subject: d.vapidSubject,
    vapidPublicPreview: d.vapidPublicPreview,
    vapidPrivatePreview: d.vapidPrivatePreview,
    ...extra,
  });
}
