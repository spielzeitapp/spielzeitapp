import type { NotificationKind } from '../notifications/pending';

export type ReminderJobKind = 'match' | 'training' | 'event';

export type NotificationJobPayload = {
  reminderKey: string;
  offsetMinutes: number;
  notificationType: NotificationKind;
  /** ISO der Basiszeit (Treff/Anstoß), für Debugging */
  baseTimeIso: string;
  /** true, wenn send_at wegen „Offset schon vorbei“ angehoben wurde */
  clamped?: boolean;
};

export type NotificationJobRow = {
  id: string;
  event_id: string;
  team_id: string;
  kind: ReminderJobKind;
  send_at: string;
  payload: NotificationJobPayload;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  dedupe_key: string;
  attempt_count: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReminderJobInsert = {
  event_id: string;
  team_id: string;
  kind: ReminderJobKind;
  send_at: string;
  payload: NotificationJobPayload;
  status: 'pending';
  dedupe_key: string;
};
