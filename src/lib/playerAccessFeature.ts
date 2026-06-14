/** Feature-Flag: U11-Spieler-QR-Einlösung (Step 2). */
export function isPlayerQrAccessEnabled(): boolean {
  return import.meta.env.VITE_PLAYER_QR_ACCESS === 'true';
}
