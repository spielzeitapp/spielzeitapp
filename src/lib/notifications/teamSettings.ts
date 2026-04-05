/**
 * Defaults = DB-Defaults aus Migration team_notification_settings (keine Zeile nötig).
 *
 * DB kann `*_reminder_*` (Migration) und/oder kurze Aliase (`match_enabled`, …) haben.
 * Lesen: zuerst `*_reminder_*` (das schreibt die App), sonst Kurzname — niemals `a ?? b` für Booleans,
 * sonst überschreibt ein explizites `false` in der ersten Spalte den gespeicherten `true` in der zweiten.
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

function readBoolFromDb(
  r: Record<string, unknown>,
  reminderKey: string,
  shortKey: string,
  defaultVal: boolean,
): boolean {
  const rem = r[reminderKey];
  if (typeof rem === 'boolean') return rem;
  const sh = r[shortKey];
  if (typeof sh === 'boolean') return sh;
  return defaultVal;
}

function readIntFromDb(
  r: Record<string, unknown>,
  reminderKey: string,
  shortKey: string,
  defaultVal: number,
): number {
  const tryNum = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
    return null;
  };
  const a = tryNum(r[reminderKey]);
  if (a !== null) return a;
  const b = tryNum(r[shortKey]);
  if (b !== null) return b;
  return defaultVal;
}

/**
 * Mappt DB-Spalten (`training_reminder_*`) und ggf. kurze Aliase auf TeamNotificationSettingsRow.
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
    training_enabled: readBoolFromDb(r, 'training_reminder_enabled', 'training_enabled', true),
    training_minutes_before: readIntFromDb(r, 'training_reminder_minutes_before', 'training_minutes_before', 120),
    match_enabled: readBoolFromDb(r, 'match_reminder_enabled', 'match_enabled', true),
    match_minutes_before: readIntFromDb(r, 'match_reminder_minutes_before', 'match_minutes_before', 1440),
    match_second_enabled: readBoolFromDb(
      r,
      'match_second_reminder_enabled',
      'match_second_enabled',
      false,
    ),
    match_second_minutes_before: readIntFromDb(
      r,
      'match_second_reminder_minutes_before',
      'match_second_minutes_before',
      120,
    ),
    event_enabled: readBoolFromDb(r, 'event_reminder_enabled', 'event_enabled', false),
    event_minutes_before: readIntFromDb(r, 'event_reminder_minutes_before', 'event_minutes_before', 1440),
  };
  return resolveTeamSettings(teamSeasonId, row);
}
