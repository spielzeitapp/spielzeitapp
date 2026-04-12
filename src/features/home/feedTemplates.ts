export type MatchFeedTemplateKey = 'hero_red_player_right' | 'hero_clean';

export const MATCH_FEED_TEMPLATE_KEYS: MatchFeedTemplateKey[] = [
  'hero_red_player_right',
  'hero_clean',
];

export const MATCH_FEED_TEMPLATE_LABELS: Record<MatchFeedTemplateKey, string> = {
  hero_red_player_right: 'Hero mit Spieler rechts',
  hero_clean: 'Hero clean (ohne Spielerbild)',
};

export function normalizeMatchFeedTemplateKey(raw: string | null | undefined): MatchFeedTemplateKey {
  const k = String(raw ?? '').trim().toLowerCase();
  if (k === 'hero_red_player_right') return 'hero_red_player_right';
  return 'hero_clean';
}
