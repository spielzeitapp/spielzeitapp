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

/**
 * Mappt DB-Spalten (`training_reminder_*`) und UI-Aliase (`training_*`) auf TeamNotificationSettingsRow.
 */
export function mapTeamNotificationSettingsFromDb(
  raw: Record<string, unknown> | null | undefined,
  teamSeasonId: string,
): TeamNotificationSettingsRow {
  if (!raw) {
    return resolveTeamSettings(teamSeasonId, undefined);
  }
  const r = raw;
  const row: TeamNotificationSettingsRow = {
    team_season_id: teamSeasonId,
    training_enabled: Boolean(r.training_enabled ?? r.training_reminder_enabled ?? true),
    training_minutes_before: Number(
      r.training_minutes_before ?? r.training_reminder_minutes_before ?? 120,
    ),
    match_enabled: Boolean(r.match_enabled ?? r.match_reminder_enabled ?? true),
    match_minutes_before: Number(r.match_minutes_before ?? r.match_reminder_minutes_before ?? 1440),
    match_second_enabled: Boolean(r.match_second_enabled ?? r.match_second_reminder_enabled ?? false),
    match_second_minutes_before: Number(
      r.match_second_minutes_before ?? r.match_second_reminder_minutes_before ?? 120,
    ),
    event_enabled: Boolean(r.event_enabled ?? r.event_reminder_enabled ?? false),
    event_minutes_before: Number(r.event_minutes_before ?? r.event_reminder_minutes_before ?? 1440),
  };
  return resolveTeamSettings(teamSeasonId, row);
}
