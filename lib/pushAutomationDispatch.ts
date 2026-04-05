import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
  getCanonicalEventType,
  getEventDisplayTitle,
  type RawEventRow,
} from '../src/lib/notifications/eventTypes';
import { fetchPlayerIdsForUserInTeamSeason, fetchPlayerUserIdsForTeamSeason } from '../src/lib/notifications/users';
import { buildWebPushJsonPayload } from './webPushPayload';

function readEnv(key: string): string | undefined {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[key];
}

let vapidConfigured = false;

function ensureWebPushVapid(): void {
  if (vapidConfigured) return;
  const publicKey = readEnv('VAPID_PUBLIC_KEY')?.trim();
  const privateKey = readEnv('VAPID_PRIVATE_KEY')?.trim();
  const subject = readEnv('VAPID_SUBJECT')?.trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT müssen gesetzt sein (Web Push; kein NEXT_PUBLIC_/VITE_ auf dem Server).',
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

const REMINDER_HORIZON_DAYS = 365;

/** reminder_time = start - minutes_before; fällig wenn NOW >= reminder_time und Termin noch nicht gestartet (täglicher Cron). */
function isAutomationReminderDue(startsAtIso: string, minutesBefore: number, now: Date): boolean {
  const start = new Date(startsAtIso).getTime();
  const remindAt = start - minutesBefore * 60 * 1000;
  const t = now.getTime();
  if (t >= start) return false;
  return t >= remindAt;
}

function hasAllPlayersAnswered(playerIds: string[], attendanceByPlayerId: Map<string, string>): boolean {
  if (playerIds.length === 0) return true;
  return playerIds.every((pid) => {
    const s = attendanceByPlayerId.get(pid);
    return s === 'yes' || s === 'no';
  });
}

function applyTemplateVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function formatDateDe(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatTimeDe(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function eventMatchesTrigger(
  ctype: ReturnType<typeof getCanonicalEventType>,
  trigger: 'match_before' | 'training_before',
): boolean {
  if (trigger === 'match_before') return ctype === 'game';
  if (trigger === 'training_before') return ctype === 'training';
  return false;
}

export type PushAutomationResult = {
  automationsFound: number;
  messagesSent: number;
  pushNotificationsSent: number;
  errors: string[];
};

type AutomationRow = {
  id: string;
  team_id: string;
  template_id: string | null;
  trigger_type: 'match_before' | 'training_before';
  minutes_before: number;
  enabled: boolean;
  only_unanswered?: boolean;
};

/** Zeilen aus `notification_subscriptions` für Web-Push (explizit typisiert, kein `never` aus Supabase-Inferenz). */
type NotificationSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function processPushAutomations(
  admin: SupabaseClient,
  now: Date,
  dryRun: boolean,
): Promise<PushAutomationResult> {
  const result: PushAutomationResult = {
    automationsFound: 0,
    messagesSent: 0,
    pushNotificationsSent: 0,
    errors: [],
  };

  let autos: AutomationRow[] = [];
  try {
    const { data, error } = await admin.from('push_automations').select('*').eq('enabled', true);
    if (error) throw error;
    autos = (data ?? []) as AutomationRow[];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[pushAutomations] push_automations load failed', msg);
    result.errors.push(msg);
    return result;
  }

  result.automationsFound = autos.length;
  console.log('[pushAutomations] enabled automations:', result.automationsFound);

  const horizon = new Date(now.getTime() + REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const automation of autos) {
    try {
      if (!automation.template_id) continue;

      let template: { title: string; message: string; link: string | null } | null = null;
      try {
        const { data: tpl, error: tplErr } = await admin
          .from('push_templates')
          .select('title, message, link')
          .eq('id', automation.template_id)
          .maybeSingle();
        if (tplErr) throw tplErr;
        if (!tpl) continue;
        template = tpl as { title: string; message: string; link: string | null };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[pushAutomations] template load', automation.template_id, msg);
        result.errors.push(msg);
        continue;
      }

      let teamName = 'Team';
      try {
        const { data: teamRow, error: teamErr } = await admin
          .from('teams')
          .select('name')
          .eq('id', automation.team_id)
          .maybeSingle();
        if (!teamErr && teamRow && typeof (teamRow as { name?: string }).name === 'string') {
          teamName = (teamRow as { name: string }).name.trim() || teamName;
        }
      } catch {
        /* ignore */
      }

      let seasonIds: string[] = [];
      try {
        const { data: tsRows, error: tsErr } = await admin
          .from('team_seasons')
          .select('id')
          .eq('team_id', automation.team_id);
        if (tsErr) throw tsErr;
        seasonIds = (tsRows ?? []).map((r: { id: string }) => r.id);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[pushAutomations] team_seasons', msg);
        result.errors.push(msg);
        continue;
      }

      if (seasonIds.length === 0) continue;

      let events: Array<
        RawEventRow & { team_seasons?: { team_id?: string } | Array<{ team_id?: string }> | null }
      > = [];
      try {
        const { data: evs, error: evErr } = await admin
          .from('events')
          .select('*, team_seasons(team_id)')
          .in('team_season_id', seasonIds)
          .eq('status', 'upcoming')
          .gt('starts_at', now.toISOString())
          .lte('starts_at', horizon);
        if (evErr) throw evErr;
        events = (evs ?? []) as typeof events;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[pushAutomations] events query', msg);
        result.errors.push(msg);
        continue;
      }

      const onlyUnanswered = automation.only_unanswered !== false;

      const reminderKey = `push_automation_${automation.id}`;

      for (const event of events) {
        const ctype = getCanonicalEventType(event);
        if (!eventMatchesTrigger(ctype, automation.trigger_type)) continue;
        if (!isAutomationReminderDue(event.starts_at, automation.minutes_before, now)) continue;

        const teamIdRaw = event.team_seasons
          ? Array.isArray(event.team_seasons)
            ? event.team_seasons[0]?.team_id
            : event.team_seasons.team_id
          : undefined;
        const teamId = (teamIdRaw ?? automation.team_id) as string;

        let userIds: string[] = [];
        try {
          userIds = await fetchPlayerUserIdsForTeamSeason(admin, event.team_season_id);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          result.errors.push(msg);
          continue;
        }

        let attMap = new Map<string, string>();
        try {
          const { data: attRows, error: attErr } = await admin
            .from('event_attendance')
            .select('player_id, status')
            .eq('event_id', event.id);
          if (attErr) throw attErr;
          const attendanceRows: unknown[] = Array.isArray(attRows) ? attRows : [];
          for (const row of attendanceRows) {
            const r = row as { player_id: string; status: string };
            attMap.set(r.player_id, r.status);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('[pushAutomations] event_attendance', event.id, msg);
          result.errors.push(msg);
          attMap = new Map();
        }

        const eventTitle = getEventDisplayTitle(event);
        const vars: Record<string, string> = {
          team_name: teamName,
          event_name: eventTitle,
          date: formatDateDe(event.starts_at),
          time: formatTimeDe(event.starts_at),
        };

        const titleRendered = applyTemplateVars(template.title, vars);
        const bodyRendered = applyTemplateVars(template.message, vars);
        const url =
          (template.link && template.link.trim()) || `/app/events/${event.id}`;

        for (const userId of userIds) {
          if (onlyUnanswered) {
            let playerIds: string[] = [];
            try {
              playerIds = await fetchPlayerIdsForUserInTeamSeason(admin, userId, event.team_season_id);
            } catch {
              continue;
            }
            if (playerIds.length === 0) continue;
            if (hasAllPlayersAnswered(playerIds, attMap)) continue;
          }

          if (dryRun) {
            result.messagesSent += 1;
            continue;
          }

          const sendOutcome = await sendOneAutomationReminder(admin, {
            userId,
            eventId: event.id,
            teamId,
            reminderKey,
            title: titleRendered,
            body: bodyRendered,
            url,
          });
          if (sendOutcome.messageInserted) result.messagesSent += 1;
          result.pushNotificationsSent += sendOutcome.pushCount;
          if (sendOutcome.errors.length) result.errors.push(...sendOutcome.errors);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[pushAutomations] automation loop', automation.id, msg);
      result.errors.push(msg);
    }
  }

  console.log('[pushAutomations] messages sent (in-app rows):', result.messagesSent);
  console.log('[pushAutomations] push notifications sent:', result.pushNotificationsSent);

  return result;
}

async function sendOneAutomationReminder(
  admin: SupabaseClient,
  item: {
    userId: string;
    eventId: string;
    teamId: string;
    reminderKey: string;
    title: string;
    body: string;
    url: string;
  },
): Promise<{ messageInserted: boolean; pushCount: number; errors: string[] }> {
  const errors: string[] = [];

  const { data: dupInApp } = await admin
    .from('notification_dispatch_log')
    .select('id')
    .eq('user_id', item.userId)
    .eq('event_id', item.eventId)
    .eq('reminder_key', item.reminderKey)
    .eq('channel', 'in_app')
    .maybeSingle();

  if (dupInApp) {
    return { messageInserted: false, pushCount: 0, errors };
  }

  let messageInserted = false;
  try {
    const { error: msgErr } = await admin.from('messages').insert({
      team_id: item.teamId,
      user_id: item.userId,
      title: item.title,
      body: item.body,
      content: item.body,
      type: 'auto_reminder',
      event_id: item.eventId,
      related_event_id: item.eventId,
      reminder_key: item.reminderKey,
      read: false,
    });

    if (msgErr) {
      const code = (msgErr as { code?: string }).code;
      if (code === '23505') {
        return { messageInserted: false, pushCount: 0, errors };
      }
      console.warn('[pushAutomations] messages.insert failed', msgErr.message || msgErr);
      errors.push(msgErr.message || String(msgErr));
      return { messageInserted: false, pushCount: 0, errors };
    }
    messageInserted = true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[pushAutomations] messages.insert', msg);
    errors.push(msg);
    return { messageInserted: false, pushCount: 0, errors };
  }

  try {
    const { error: dispErr } = await admin.from('notification_dispatch_log').insert({
      user_id: item.userId,
      event_id: item.eventId,
      reminder_key: item.reminderKey,
      channel: 'in_app',
    });
    if (dispErr) {
      const code = (dispErr as { code?: string }).code;
      if (code !== '23505') {
        console.warn('[pushAutomations] notification_dispatch_log in_app', dispErr.message || dispErr);
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[pushAutomations] dispatch_log in_app', msg);
    errors.push(msg);
  }

  let pushCount = 0;
  let subs: NotificationSubscriptionRow[] = [];
  try {
    const { data, error: subErr } = await admin
      .from('notification_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', item.userId)
      .eq('is_active', true);
    if (subErr) throw subErr;
    const raw: unknown = data ?? [];
    subs = Array.isArray(raw) ? (raw as NotificationSubscriptionRow[]) : [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[pushAutomations] subscriptions query', msg);
    errors.push(msg);
    return { messageInserted, pushCount, errors };
  }

  if (subs.length === 0) {
    return { messageInserted, pushCount, errors };
  }

  try {
    ensureWebPushVapid();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`vapid: ${msg}`);
    return { messageInserted, pushCount, errors };
  }

  const payload = buildWebPushJsonPayload({
    title: item.title,
    body: item.body,
    url: item.url,
    tag: `${item.reminderKey}-${item.eventId}`,
  });

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: {
            p256dh: s.p256dh,
            auth: s.auth,
          },
        },
        payload,
        { TTL: 86400 },
      );
      pushCount += 1;
      await admin
        .from('notification_subscriptions')
        .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', s.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${item.userId}: ${msg}`);
    }
  }

  if (pushCount > 0) {
    try {
      const { error: pushLogErr } = await admin.from('notification_dispatch_log').insert({
        user_id: item.userId,
        event_id: item.eventId,
        reminder_key: item.reminderKey,
        channel: 'push',
      });
      if (pushLogErr) {
        const code = (pushLogErr as { code?: string }).code;
        if (code !== '23505') {
          console.warn('[pushAutomations] notification_dispatch_log push', pushLogErr.message || pushLogErr);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[pushAutomations] dispatch_log push', msg);
      errors.push(msg);
    }
  }

  return { messageInserted, pushCount, errors };
}
