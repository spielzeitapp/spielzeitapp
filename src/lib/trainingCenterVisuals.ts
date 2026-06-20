const BASE = import.meta.env.BASE_URL || '/';

export const DEFAULT_TRAINING_HERO_URL = `${BASE}profile/profile-hero-stadium.PNG`;

export function resolveTrainingHeroBackgroundUrl(coverUrl?: string | null): string {
  const url = String(coverUrl ?? '').trim();
  if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://')) return url;
  return DEFAULT_TRAINING_HERO_URL;
}
