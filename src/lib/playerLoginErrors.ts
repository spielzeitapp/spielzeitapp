/** RPC-Fehler von Spieler-Code/PIN → nutzerfreundliche Meldung (DE). */
export function mapPlayerLoginError(raw: string | null | undefined): string {
  const msg = (raw ?? '').trim().toLowerCase();
  if (!msg) return 'Anmeldung fehlgeschlagen. Bitte später erneut versuchen.';
  if (msg.includes('not_authenticated')) {
    return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
  }
  if (msg.includes('login_invalid_credentials') || msg.includes('invalid_login_code_or_pin')) {
    return 'Spieler-Code oder PIN ist falsch.';
  }
  if (msg.includes('login_revoked')) {
    return 'Dieser Spielerzugang wurde gesperrt. Bitte deine Eltern um einen neuen Zugang bitten.';
  }
  if (msg.includes('cannot_login_existing_role_parent')) {
    return 'Dieses Konto ist als Elternteil registriert. Bitte den Spieler-Login auf dem Gerät des Kindes nutzen.';
  }
  if (
    msg.includes('cannot_login_existing_role_trainer') ||
    msg.includes('cannot_login_existing_role_co_trainer') ||
    msg.includes('cannot_login_existing_role_head_coach')
  ) {
    return 'Dieses Konto hat Trainer-Rechte. Bitte den Spieler-Login auf dem Gerät des Kindes nutzen.';
  }
  if (msg.includes('forbidden_not_guardian_or_staff') || msg.includes('forbidden')) {
    return 'Keine Berechtigung für diesen Spielerzugang.';
  }
  if (msg.includes('player_not_found')) {
    return 'Spieler wurde nicht gefunden.';
  }
  if (msg.includes('login_credentials_not_found_or_revoked')) {
    return 'Kein aktiver Spieler-Code vorhanden. Bitte zuerst einen Zugang erstellen.';
  }
  if (msg.includes('login_access_not_found_or_already_revoked')) {
    return 'Zugang wurde bereits gesperrt oder ist nicht aktiv.';
  }
  if (msg.includes('could not find the function') || msg.includes('pgrst202')) {
    return 'Spieler-Login ist auf dem Server noch nicht verfügbar (Migration fehlt).';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.';
  }
  return raw ?? 'Ein Fehler ist aufgetreten.';
}

export type GenerateLoginCredentialsResult = {
  player_id: string;
  login_code: string;
  pin_plain: string;
};

export type RotateLoginPinResult = {
  player_id: string;
  pin_plain: string;
};

export type LoginCredentialsStatus = {
  has_credentials: boolean;
  active: boolean;
  login_code: string | null;
  last_used_at?: string | null;
  updated_at?: string | null;
};

export type PlayerCodeLoginResult = {
  player_id: string;
  team_season_id: string;
  access_mode?: string;
};
