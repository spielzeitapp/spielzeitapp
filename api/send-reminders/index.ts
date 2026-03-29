/**
 * Vercel Serverless: POST /api/send-reminders
 * Führt die zentrale Reminder-Verarbeitung aus (gleiche Logik wie /api/notifications/dispatch).
 *
 * Diagnose: Minimal-Handler aktiv; Legacy-Logik ist in runSendRemindersLegacy_DISABLED gebündelt (nicht ausgeführt).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('SEND REMINDERS HANDLER ENTER');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    message: 'send-reminders handler reached',
  });
}

/**
 * Vorherige Produktionslogik – bewusst nicht aufgerufen (Diagnose FUNCTION_INVOCATION_FAILED).
 * Reaktivierung: obigen Handler-Body durch Aufruf dieser Funktion ersetzen (und dynamischen Import beibehalten oder wieder statisch setzen).
 */
async function runSendRemindersLegacy_DISABLED(req: VercelRequest, res: VercelResponse) {
  const { handleNotificationDispatch } = await import('../../lib/notificationDispatchHandler');

  function safeDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    const d = new Date(value as string | number | Date);
    if (Number.isNaN(d.getTime())) {
      console.error('Invalid date:', value);
      return null;
    }
    return d;
  }

  function getHeader(reqInner: VercelRequest, key: string): string | undefined {
    const lower = key.toLowerCase();
    const direct = reqInner.headers[lower] ?? reqInner.headers[key];
    if (direct == null) return undefined;
    return Array.isArray(direct) ? direct[0] : direct;
  }

  function jsonBody(reqInner: VercelRequest): string {
    if (typeof reqInner.body === 'string') return reqInner.body;
    if (reqInner.body != null) return JSON.stringify(reqInner.body);
    return '{}';
  }

  console.log('SEND REMINDERS START');
  console.log('METHOD:', req.method);

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    console.log('BODY:', req.body);

    const auth = getHeader(req, 'authorization');
    const xs = getHeader(req, 'x-cron-secret');
    const bodyStr = jsonBody(req);

    console.log('[send-reminders] pre-dispatch', {
      hasAuthorization: Boolean(auth),
      hasCronSecret: Boolean(xs),
      bodyLength: bodyStr.length,
      invokedAt: safeDate(Date.now()),
    });

    const headers = new Headers({ 'content-type': 'application/json' });
    if (auth) headers.set('authorization', auth);
    if (xs) headers.set('x-cron-secret', xs);

    console.log('[send-reminders] invoking handleNotificationDispatch');
    const request = new Request('https://internal.vercel.app/api/send-reminders', {
      method: 'POST',
      headers,
      body: bodyStr,
    });

    const response = await handleNotificationDispatch(request);
    const text = await response.text();

    let payload: Record<string, unknown>;
    try {
      payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch (parseErr: unknown) {
      console.error('SEND REMINDERS ERROR:', parseErr);
      console.error('[send-reminders] dispatch response not JSON', parseErr, text.slice(0, 300));
      const msg =
        parseErr instanceof Error && parseErr.message ? parseErr.message : 'Unknown error';
      return res.status(500).json({
        ok: false,
        error: msg || 'Invalid JSON from reminder handler',
        rawPreview: text.slice(0, 500),
        stack: parseErr instanceof Error ? parseErr.stack ?? null : null,
      });
    }

    if (!response.ok || payload.ok === false) {
      const errMsg =
        typeof payload.error === 'string'
          ? payload.error
          : 'Reminder dispatch fehlgeschlagen';
      console.error('[send-reminders] dispatch failed', response.status, errMsg, payload);
      return res.status(response.status >= 400 ? response.status : 500).json({
        ok: false,
        error: errMsg,
        ...payload,
      });
    }

    const processed = typeof payload.processed === 'number' ? payload.processed : 0;
    console.log('[send-reminders] success', { processed, sent: payload.sent, skipped: payload.skipped });

    console.log('SEND REMINDERS SUCCESS');
    return res.status(200).json({
      ok: true,
      message: 'Reminder dispatch erfolgreich',
      processed: typeof processed === 'number' ? processed : 0,
      sent: payload.sent,
      skipped: payload.skipped,
      errors: payload.errors,
      details: payload.details,
      dryRun: payload.dryRun,
      pushAutomations: payload.pushAutomations,
    });
  } catch (err: unknown) {
    console.error('SEND REMINDERS ERROR:', err);
    const message = err instanceof Error && err.message ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack ?? null : null;
    return res.status(500).json({
      ok: false,
      error: message,
      stack,
    });
  }
}
