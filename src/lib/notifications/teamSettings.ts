/**
 * Defaults = DB-Defaults aus Migration team_notification_settings (keine Zeile nötig).
 */
export type TeamNotificationSettingsRow = {
  team_season_id: string;
  training_reminder_enabled: boolean;
  training_reminder_minutes_before: number;
  match_reminder_enabled: boolean;
  match_reminder_minutes_before: number;
  match_second_reminder_enabled: boolean;
  match_second_reminder_minutes_before: number;
  event_reminder_enabled: boolean;
  event_reminder_minutes_before: number;
};

export const DEFAULT_TEAM_NOTIFICATION_SETTINGS: Omit<TeamNotificationSettingsRow, 'team_season_id'> = {
  training_reminder_enabled: true,
  training_reminder_minutes_before: 120,
  match_reminder_enabled: true,
  match_reminder_minutes_before: 1440,
  match_second_reminder_enabled: false,
  match_second_reminder_minutes_before: 120,
  event_reminder_enabled: false,
  event_reminder_minutes_before: 1440,
};

export function resolveTeamSettings(
  teamSeasonId: string,
  row: TeamNotificationSettingsRow | undefined,
): TeamNotificationSettingsRow {
  return {
    ...DEFAULT_TEAM_NOTIFICATION_SETTINGS,
    ...(row ?? {}),
    team_season_id: teamSeasonId,
  };
}
