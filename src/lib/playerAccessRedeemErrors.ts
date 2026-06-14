/** RPC-Fehler von redeem_player_access_invite → nutzerfreundliche Meldung (DE). */
export function mapPlayerAccessRedeemError(raw: string | null | undefined): string {
  const msg = (raw ?? '').trim().toLowerCase();
  if (!msg) return 'Einlösung fehlgeschlagen. Bitte später erneut versuchen.';
  if (msg.includes('not_authenticated')) {
    return 'Anmeldung fehlgeschlagen. Bitte den Link erneut öffnen.';
  }
  if (msg.includes('invite_expired')) {
    return 'Diese Einladung ist abgelaufen. Bitte deine Eltern um einen neuen QR-Code bitten.';
  }
  if (msg.includes('invite_revoked')) {
    return 'Diese Einladung wurde widerrufen. Bitte deine Eltern um einen neuen QR-Code bitten.';
  }
  if (msg.includes('invite_already_used')) {
    return 'Dieser Zugang wurde bereits verwendet.';
  }
  if (msg.includes('invite_not_found') || msg.includes('invalid_token')) {
    return 'Ungültiger oder unbekannter Zugangslink.';
  }
  if (msg.includes('cannot_redeem_existing_role_parent')) {
    return 'Dieses Konto ist als Elternteil registriert. Bitte den QR-Code auf dem Gerät des Kindes öffnen.';
  }
  if (msg.includes('cannot_redeem_existing_role_trainer') || msg.includes('cannot_redeem_existing_role_co_trainer') || msg.includes('cannot_redeem_existing_role_head_coach')) {
    return 'Dieses Konto hat Trainer-Rechte. Bitte den QR-Code auf dem Gerät des Kindes öffnen.';
  }
  if (msg.includes('forbidden')) {
    return 'Keine Berechtigung für diesen Zugangslink.';
  }
  return raw ?? 'Einlösung fehlgeschlagen.';
}
