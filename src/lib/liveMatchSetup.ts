/** SessionStorage-Payload Setup → Live (gleiche Spieler-UUIDs wie `players`). */
export const LIVE_MATCH_SETUP_STORAGE_KEY = 'spz_live_match_setup';

export type LiveMatchSetupPayload = {
  opponent: string;
  matchDate: string;
  matchTime: string;
  isHome: boolean;
  locationNote: string;
  squadPlayerIds: string[];
  startingPlayerIds: string[];
};
