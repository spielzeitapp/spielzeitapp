/** Feature-Flag: U11-Spieler-QR + Code/PIN-Login. */
export function isPlayerQrAccessEnabled(): boolean {
  return import.meta.env.VITE_PLAYER_QR_ACCESS === 'true';
}
