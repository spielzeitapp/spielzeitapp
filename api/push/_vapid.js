/**
 * Einheitliche VAPID-Konfiguration für alle Push-API-Routen (nur Server-Env).
 * Frontend: ausschließlich import.meta.env.VITE_VAPID_PUBLIC_KEY (muss mit VAPID_PUBLIC_KEY übereinstimmen).
 */
import webpush from "web-push";

export function getVapidEnv() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = (process.env.VAPID_SUBJECT || "").trim();
  return { publicKey, privateKey, subject };
}

/**
 * Konfiguriert web-push exakt mit VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * Keine Fallbacks auf NEXT_PUBLIC_* / VITE_* (verhindert VapidPkHashMismatch).
 */
export function ensureVapid() {
  const { publicKey, privateKey, subject } = getVapidEnv();
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT müssen gesetzt sein (Backend). Keine NEXT_PUBLIC-/VITE-Variablen verwenden.",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function previewPublicKey(pk) {
  if (!pk || pk.length < 16) return pk || null;
  return `${pk.slice(0, 20)}…${pk.slice(-6)}`;
}

/** Nur letzte Zeichen – niemals den vollständigen Private Key loggen/exponieren */
function previewPrivateKey(pk) {
  if (!pk || pk.length < 6) return null;
  return `…${pk.slice(-8)}`;
}

/**
 * Für JSON-Responses (kein vollständiger Private Key).
 */
export function getVapidDebugInfo() {
  const { publicKey, privateKey, subject } = getVapidEnv();
  return {
    publicKeyPresent: Boolean(publicKey),
    privateKeyPresent: Boolean(privateKey),
    subjectPresent: Boolean(subject),
    publicKeyPreview: publicKey ? previewPublicKey(publicKey) : null,
    privateKeyPreview: privateKey ? previewPrivateKey(privateKey) : null,
    subject: subject || null,
  };
}

export function logVapidBeforeSend(routeLabel, extra) {
  const d = getVapidDebugInfo();
  console.log(`[${routeLabel}] vapid`, {
    subject: d.subject,
    publicKeyPreview: d.publicKeyPreview,
    privateKeyPreview: d.privateKeyPreview,
    publicKeyPresent: d.publicKeyPresent,
    privateKeyPresent: d.privateKeyPresent,
    subjectPresent: d.subjectPresent,
    ...extra,
  });
}
