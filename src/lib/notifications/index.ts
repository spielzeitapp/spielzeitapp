/**
 * Reminder-Logik (Training 11:00–12:00 Wien, Spiele ≤7 Tage) + Hilfen.
 * Server: getPendingNotifications + Dispatch mit Service Role.
 */

export { getNotificationConfig, type NotificationRuntimeConfig } from './config';
export {
  getCanonicalEventType,
  getParticipationMode,
  getEventDisplayTitle,
  type RawEventRow,
  type CanonicalEventType,
} from './eventTypes';
export {
  isTrainingReminderDue,
  isGameReminderDue,
  hasAllChildrenDeclinedTraining,
  hasAllChildrenAnsweredGameOptIn,
  shouldSendTrainingReminderForPlayers,
  shouldSendGameReminderForPlayers,
} from './helpers';
export { hasUserResponded } from './hasUserResponded';
export {
  getPendingNotifications,
  type PendingNotificationItem,
  type NotificationKind,
} from './pending';
export { fetchPlayerIdsForUserInTeamSeason, fetchRecipientUserIdsForTeamSeason } from './users';
export {
  buildGameReminderBody,
  buildTrainingReminderBody,
  formatEventDateVienna,
  formatEventTimeVienna,
} from './format';
