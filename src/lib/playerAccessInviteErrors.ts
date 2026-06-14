/** RPC-Fehler von generate/revoke_player_access_invite → nutzerfreundliche Meldung (DE). */
export function mapPlayerAccessInviteError(raw: string | null | undefined): string {
  const msg = (raw ?? '').trim().toLowerCase();
  if (!msg) return 'Spielerzugang konnte nicht erstellt werden.';
  if (msg.includes('not_authenticated')) {
    return 'Bitte melde dich erneut an.';
  }
  if (msg.includes('forbidden_not_guardian_or_staff') || msg.includes('forbidden')) {
    return 'Keine Berechtigung, einen Spielerzugang für dieses Kind zu erstellen.';
  }
  if (msg.includes('player_not_found')) {
    return 'Spieler wurde nicht gefunden.';
  }
  if (msg.includes('could not find the function') || msg.includes('pgrst202')) {
    return 'Spielerzugang ist auf dem Server noch nicht verfügbar (Migration fehlt).';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.';
  }
  if (msg.includes('invite_not_found_or_already_revoked')) {
    return 'Zugang wurde bereits widerrufen oder ist nicht mehr gültig.';
  }
  return raw ?? 'Ein Fehler ist aufgetreten.';
}

export function buildPlayerAccessFullUrl(urlPath: string): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, '');
  const path = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  return `${base}${path}`;
}

export type GenerateInviteRpcResult = {
  invite_id: string;
  token_plain: string;
  expires_at: string;
  url_path: string;
};
