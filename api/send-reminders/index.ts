/**
 * Vercel Serverless: POST /api/send-reminders
 * Führt die zentrale Reminder-Verarbeitung aus (gleiche Logik wie /api/notifications/dispatch).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleNotificationDispatch } from '../../lib/notificationDispatchHandler';

export const config = {
  runtime: 'nodejs',
};

function safeDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) {
    console.error('Invalid date:', value);
    return null;
  }
  return d;
}

function getHeader(req: VercelRequest, key: string): string | undefined {
  const lower = key.toLowerCase();
  const direct = req.headers[lower] ?? req.headers[key];
  if (direct == null) return undefined;
  return Array.isArray(direct) ? direct[0] : direct;
}

function jsonBody(req: VercelRequest): string {
  if (typeof req.body === 'string') return req.body;
  if (req.body != null) return JSON.stringify(req.body);
  return '{}';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('🚀 send-reminders START');
  console.log('Request body:', req.body);
  console.log('[send-reminders] incoming', req.method ?? 'UNKNOWN', {
    invokedAt: safeDate(Date.now()),
  });

  try {
    if (req.method !== 'POST') {
      console.error('[send-reminders] method not allowed:', req.method);
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const auth = getHeader(req, 'authorization');
    const xs = getHeader(req, 'x-cron-secret');
    const bodyStr = jsonBody(req);

    const headers = new Headers({ 'content-type': 'application/json' });
    if (auth) headers.set('authorization', auth);
    if (xs) headers.set('x-cron-secret', xs);

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
      const pe = parseErr instanceof Error ? parseErr.message : 'Unknown error';
      res.status(500).json({
        ok: false,
        error: pe || 'Invalid JSON from reminder handler',
        raw: text.slice(0, 500),
      });
      return;
    }

    if (!response.ok || payload.ok === false) {
      const errMsg =
        typeof payload.error === 'string'
          ? payload.error
          : 'Reminder dispatch fehlgeschlagen';
      console.error('[send-reminders] dispatch failed', response.status, errMsg, payload);
      res.status(response.status >= 400 ? response.status : 500).json({
        ok: false,
        error: errMsg,
        ...payload,
      });
      return;
    }

    const processed = typeof payload.processed === 'number' ? payload.processed : 0;
    console.log('[send-reminders] success', { processed, sent: payload.sent, skipped: payload.skipped });

    res.status(200).json({
      ok: true,
      message: 'Reminder dispatch erfolgreich',
      processed,
      sent: payload.sent,
      skipped: payload.skipped,
      errors: payload.errors,
      details: payload.details,
      dryRun: payload.dryRun,
      pushAutomations: payload.pushAutomations,
    });
  } catch (err: unknown) {
    console.error('SEND REMINDERS ERROR:', err);
    console.error('[send-reminders] REMINDER DISPATCH ERROR', err);
    const message =
      err instanceof Error && err.message ? err.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
    });
  }
}
