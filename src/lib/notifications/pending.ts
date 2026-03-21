import type { SupabaseClient } from '@supabase/supabase-js';
import { getNotificationConfig, type NotificationRuntimeConfig } from './config';
import { buildGameReminderBody, buildTrainingReminderBody } from './format';
import {
  getCanonicalEventType,
  getEventDisplayTitle,
  type RawEventRow,
} from './eventTypes';
import {
  isGameReminderDue,
  isTrainingReminderDue,
  shouldSendGameReminderForPlayers,
  shouldSendTrainingReminderForPlayers,
} from './helpers';
import { fetchPlayerIdsForUserInTeamSeason, fetchRecipientUserIdsForTeamSeason } from './users';

export type NotificationKind = 'training_reminder' | 'game_reminder';

export type PendingNotificationItem = {
  userId: string;
  eventId: string;
  notificationType: NotificationKind;
  title: string;
  body: string;
  /** Relativer Pfad unter App-Origin */
  url: string;
};

function logKey(userId: string, eventId: string, t: NotificationKind): string {
  return `${userId}|${eventId}|${t}`;
}

/**
 * Alle fälligen Reminder (ohne Web Push zu senden).
 * Duplikate werden über notification_log ausgeschlossen (Batch-Check).
 */
export async function getPendingNotifications(
  admin: SupabaseClient,
  now: Date = new Date(),
  cfg: NotificationRuntimeConfig = getNotificationConfig(),
): Promise<PendingNotificationItem[]> {
  const horizon = new Date(now.getTime() + (cfg.gameReminderDaysBefore + 2) * 24 * 60 * 60 * 1000).toISOString();
  const back = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error: evErr } = await admin
    .from('events')
    .select('*')
    .eq('status', 'upcoming')
    .gte('starts_at', back)
    .lte('starts_at', horizon);

  if (evErr) throw evErr;
  const list = (events ?? []) as RawEventRow[];
  if (list.length === 0) return [];

  const eventIds = list.map((e) => e.id);
  const { data: logRows, error: logErr } = await admin
    .from('notification_log')
    .select('user_id, event_id, notification_type')
    .in('event_id', eventIds);
  if (logErr) throw logErr;

  const sent = new Set<string>();
  for (const r of logRows ?? []) {
    const t = r.notification_type as NotificationKind;
    if (t === 'training_reminder' || t === 'game_reminder') {
      sent.add(logKey(r.user_id, r.event_id, t));
    }
  }

  const { data: attRows, error: attErr } = await admin
    .from('event_attendance')
    .select('event_id, player_id, status')
    .in('event_id', eventIds);
  if (attErr) throw attErr;

  const attendanceByEvent = new Map<string, Map<string, string>>();
  for (const row of attRows ?? []) {
    const eid = (row as { event_id: string }).event_id;
    const pid = (row as { player_id: string }).player_id;
    const st = (row as { status: string }).status;
    if (!attendanceByEvent.has(eid)) attendanceByEvent.set(eid, new Map());
    attendanceByEvent.get(eid)!.set(pid, st);
  }

  const out: PendingNotificationItem[] = [];

  for (const event of list) {
    const ctype = getCanonicalEventType(event);
    const mode = getParticipationMode(event);
    const titleStr = getEventDisplayTitle(event);

    const trainingDue =
      ctype === 'training' && mode === 'opt_out' && isTrainingReminderDue(event, now, cfg);
    const gameDue = ctype === 'game' && mode === 'opt_in' && isGameReminderDue(event, now, cfg);

    if (!trainingDue && !gameDue) continue;

    let userIds: string[];
    try {
      userIds = await fetchRecipientUserIdsForTeamSeason(admin, event.team_season_id);
    } catch {
      continue;
    }

    const attMap = attendanceByEvent.get(event.id) ?? new Map<string, string>();

    for (const userId of userIds) {
      let playerIds: string[];
      try {
        playerIds = await fetchPlayerIdsForUserInTeamSeason(admin, userId, event.team_season_id);
      } catch {
        continue;
      }
      if (playerIds.length === 0) continue;

      if (trainingDue) {
        const kind: NotificationKind = 'training_reminder';
        if (sent.has(logKey(userId, event.id, kind))) continue;
        if (!shouldSendTrainingReminderForPlayers(playerIds, attMap)) continue;
        out.push({
          userId,
          eventId: event.id,
          notificationType: kind,
          title: 'Training heute',
          body: buildTrainingReminderBody(titleStr, event.starts_at),
          url: `/app/events/${event.id}`,
        });
      }

      if (gameDue) {
        const kind: NotificationKind = 'game_reminder';
        if (sent.has(logKey(userId, event.id, kind))) continue;
        if (!shouldSendGameReminderForPlayers(playerIds, attMap)) continue;
        out.push({
          userId,
          eventId: event.id,
          notificationType: kind,
          title: 'Spiel-Zusage fehlt',
          body: buildGameReminderBody(titleStr, event.starts_at),
          url: `/app/events/${event.id}`,
        });
      }
    }
  }

  return out;
}
