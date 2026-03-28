import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPushReminderShort, buildReminderInAppBody } from './format';
import {
  getCanonicalEventType,
  getEventDisplayTitle,
  type RawEventRow,
} from './eventTypes';
import { resolveTeamSettings, type TeamNotificationSettingsRow } from './teamSettings';
import { fetchPlayerIdsForUserInTeamSeason, fetchRecipientUserIdsForTeamSeason } from './users';

/** Horizont: zukünftige Termine bis N Tage (Cron prüft regelmäßig) */
const REMINDER_HORIZON_DAYS = 365;

export type NotificationKind =
  | 'training_reminder'
  | 'game_reminder'
  | 'game_second_reminder'
  | 'event_reminder';

export type PendingNotificationItem = {
  userId: string;
  eventId: string;
  teamId: string;
  notificationType: NotificationKind;
  /** z. B. training_120, match_1440, match_second_120, event_1440 */
  reminderKey: string;
  title: string;
  body: string;
  /** Kurz-Titel fürs Push-Body */
  eventTitleShort: string;
  /** Push-Textzeile (ohne App-Titel) */
  pushBody: string;
  /** Relativer Pfad unter App-Origin */
  url: string;
  /** messages.notification_kind (Badge-Filter Termine) */
  terminReminderKind?: 'match' | 'training' | 'event';
};

function dispatchKey(userId: string, eventId: string, reminderKey: string): string {
  return `${userId}|${eventId}|${reminderKey}`;
}

function isReminderDue(startsAtIso: string, minutesBefore: number, now: Date): boolean {
  const ms = new Date(startsAtIso).getTime() - now.getTime();
  if (ms <= 0) return false;
  return ms <= minutesBefore * 60 * 1000;
}

function hasAllPlayersAnswered(playerIds: string[], attendanceByPlayerId: Map<string, string>): boolean {
  if (playerIds.length === 0) return true;
  return playerIds.every((pid) => {
    const s = attendanceByPlayerId.get(pid);
    return s === 'yes' || s === 'no';
  });
}

function locationLineForBody(ev: RawEventRow): string | null {
  const loc = (ev.location ?? '').trim();
  const addr = (ev.address ?? '').trim();
  if (loc && addr) return `${loc} (${addr})`;
  return loc || addr || null;
}

type SlotDef = {
  reminderKey: string;
  minutes: number;
  kind: NotificationKind;
  title: string;
};

function slotsForEvent(
  ctype: ReturnType<typeof getCanonicalEventType>,
  settings: TeamNotificationSettingsRow,
  event: RawEventRow,
  now: Date,
): SlotDef[] {
  const out: SlotDef[] = [];

  if (ctype === 'training' && settings.training_enabled) {
    const m = settings.training_minutes_before;
    if (isReminderDue(event.starts_at, m, now)) {
      out.push({
        reminderKey: `training_${m}`,
        minutes: m,
        kind: 'training_reminder',
        title: 'Erinnerung: Training heute',
      });
    }
  }

  if (ctype === 'game') {
    if (settings.match_enabled) {
      const m = settings.match_minutes_before;
      if (isReminderDue(event.starts_at, m, now)) {
        out.push({
          reminderKey: `match_${m}`,
          minutes: m,
          kind: 'game_reminder',
          title: 'Erinnerung: Spiel bald',
        });
      }
    }
    if (settings.match_second_enabled) {
      const m = settings.match_second_minutes_before;
      if (isReminderDue(event.starts_at, m, now)) {
        out.push({
          reminderKey: `match_second_${m}`,
          minutes: m,
          kind: 'game_second_reminder',
          title: 'Erinnerung: Spiel bald',
        });
      }
    }
  }

  if ((ctype === 'event' || ctype === 'other') && settings.event_enabled) {
    const m = settings.event_minutes_before;
    if (isReminderDue(event.starts_at, m, now)) {
      out.push({
        reminderKey: `event_${m}`,
        minutes: m,
        kind: 'event_reminder',
        title: 'Erinnerung: Termin bald',
      });
    }
  }

  return out;
}

/**
 * Fällige Reminder (In-App + Push folgt im Dispatch-Handler).
 * Duplikate: notification_dispatch_log (channel=in_app) + unique messages.
 */
export async function getPendingNotifications(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<PendingNotificationItem[]> {
  const horizon = new Date(now.getTime() + REMINDER_HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error: evErr } = await admin
    .from('events')
    .select('*, team_seasons(team_id)')
    .eq('status', 'upcoming')
    .gt('starts_at', now.toISOString())
    .lte('starts_at', horizon);

  if (evErr) throw evErr;

  const list = (events ?? []) as Array<
    RawEventRow & { team_seasons?: { team_id?: string } | Array<{ team_id?: string }> | null }
  >;
  if (list.length === 0) return [];

  const teamSeasonIds = Array.from(new Set(list.map((e) => e.team_season_id)));

  const { data: settingsRows, error: setErr } = await admin
    .from('team_notification_settings')
    .select('*')
    .in('team_season_id', teamSeasonIds);
  if (setErr) throw setErr;

  const settingsBySeason = new Map<string, TeamNotificationSettingsRow>();
  for (const r of settingsRows ?? []) {
    const row = r as TeamNotificationSettingsRow;
    settingsBySeason.set(row.team_season_id, row);
  }

  const eventIds = list.map((e) => e.id);

  const { data: dispRows, error: dispErr } = await admin
    .from('notification_dispatch_log')
    .select('user_id, event_id, reminder_key')
    .eq('channel', 'in_app')
    .in('event_id', eventIds);
  if (dispErr) throw dispErr;

  const dispatchedInApp = new Set<string>();
  for (const r of dispRows ?? []) {
    const row = r as { user_id: string; event_id: string; reminder_key: string };
    dispatchedInApp.add(dispatchKey(row.user_id, row.event_id, row.reminder_key));
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
    const teamIdRaw = event.team_seasons
      ? Array.isArray(event.team_seasons)
        ? event.team_seasons[0]?.team_id
        : event.team_seasons.team_id
      : undefined;
    const teamId = (teamIdRaw ?? '') as string;
    if (!teamId) continue;

    const settings = resolveTeamSettings(event.team_season_id, settingsBySeason.get(event.team_season_id));
    const ctype = getCanonicalEventType(event);
    const titleStr = getEventDisplayTitle(event);
    const meetupIso = event.meetup_at ?? event.meeting_at ?? null;
    const locLine = locationLineForBody(event);

    const slots = slotsForEvent(ctype, settings, event, now);
    if (slots.length === 0) continue;

    let userIds: string[];
    try {
      userIds = await fetchRecipientUserIdsForTeamSeason(admin, event.team_season_id);
    } catch {
      continue;
    }

    const attMap = attendanceByEvent.get(event.id) ?? new Map<string, string>();

    for (const slot of slots) {
      for (const userId of userIds) {
        if (dispatchedInApp.has(dispatchKey(userId, event.id, slot.reminderKey))) continue;

        let playerIds: string[];
        try {
          playerIds = await fetchPlayerIdsForUserInTeamSeason(admin, userId, event.team_season_id);
        } catch {
          continue;
        }
        if (playerIds.length === 0) continue;
        if (hasAllPlayersAnswered(playerIds, attMap)) continue;

        const body = buildReminderInAppBody(titleStr, event.starts_at, locLine, meetupIso);
        const pushBody = buildPushReminderShort(titleStr);

        const terminReminderKind =
          ctype === 'game' ? 'match' : ctype === 'training' ? 'training' : 'event';

        out.push({
          userId,
          eventId: event.id,
          teamId,
          notificationType: slot.kind,
          reminderKey: slot.reminderKey,
          title: slot.title,
          body,
          eventTitleShort: titleStr,
          pushBody,
          url: `/app/events/${event.id}`,
          terminReminderKind,
        });
      }
    }
  }

  return out;
}
