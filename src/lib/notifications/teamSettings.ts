/**
 * Defaults = DB-Defaults aus Migration team_notification_settings (keine Zeile nötig).
 */
export type TeamNotificationSettingsRow = {
  team_season_id: string;
  training_enabled: boolean;
  training_minutes_before: number;
  match_enabled: boolean;
  match_minutes_before: number;
  match_second_enabled: boolean;
  match_second_minutes_before: number;
  event_enabled: boolean;
  event_minutes_before: number;
};

export const DEFAULT_TEAM_NOTIFICATION_SETTINGS: Omit<TeamNotificationSettingsRow, 'team_season_id'> = {
  training_enabled: true,
  training_minutes_before: 120,
  match_enabled: true,
  match_minutes_before: 1440,
  match_second_enabled: false,
  match_second_minutes_before: 120,
  event_enabled: false,
  event_minutes_before: 1440,
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
