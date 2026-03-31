/**
 * Reminder-Logik: team_notification_settings + notification_dispatch_log (Server: Service Role).
 */

export { getNotificationConfig, type NotificationRuntimeConfig } from './config';
export {
  DEFAULT_TEAM_NOTIFICATION_SETTINGS,
  resolveTeamSettings,
  type TeamNotificationSettingsRow,
} from './teamSettings';
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
export {
  fetchPlayerIdsForUserInTeamSeason,
  fetchRecipientUserIdsForTeamSeason,
  fetchReminderRecipientUserIdsForTeamSeason,
} from './users';
export {
  buildGameReminderBody,
  buildTrainingReminderBody,
  buildReminderInAppBody,
  buildPushReminderShort,
  formatEventDateVienna,
  formatEventTimeVienna,
} from './format';
