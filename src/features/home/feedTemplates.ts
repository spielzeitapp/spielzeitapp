export type MatchFeedTemplateKey = 'spieltag_hero_player_right' | 'spieltag_clean';

export const MATCH_FEED_TEMPLATE_KEYS: MatchFeedTemplateKey[] = [
  'spieltag_hero_player_right',
  'spieltag_clean',
];

export const MATCH_FEED_TEMPLATE_LABELS: Record<MatchFeedTemplateKey, string> = {
  spieltag_hero_player_right: 'Spieltag Hero mit Spieler rechts',
  spieltag_clean: 'Spieltag clean (ohne Spielerbild)',
};

/** Akzeptiert neue Keys und Legacy-Keys aus älteren DB-Zeilen. */
export function normalizeMatchFeedTemplateKey(raw: string | null | undefined): MatchFeedTemplateKey {
  const k = String(raw ?? '').trim().toLowerCase();
  if (k === 'spieltag_hero_player_right' || k === 'hero_red_player_right') return 'spieltag_hero_player_right';
  if (k === 'spieltag_clean' || k === 'hero_clean') return 'spieltag_clean';
  return 'spieltag_clean';
}
