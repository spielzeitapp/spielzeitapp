/** Optional: echtes Stadionbild unter public/profile/ — CSS-Fallback wenn keins lädt. */
export const PROFILE_HERO_STADIUM_BG_CANDIDATES = [
  "/profile/profile-hero-stadium.jpg",
  "/profile/profile-hero-stadium.jpeg",
  "/profile/profile-hero-stadium.png",
  "/profile/profile-hero-stadium.PNG",
] as const;

export function probeProfileHeroStadiumBackground(
  onResolved: (url: string | null) => void,
): () => void {
  let cancelled = false;
  let index = 0;

  const tryNext = () => {
    if (cancelled || index >= PROFILE_HERO_STADIUM_BG_CANDIDATES.length) {
      if (!cancelled) onResolved(null);
      return;
    }
    const url = PROFILE_HERO_STADIUM_BG_CANDIDATES[index++];
    const img = new Image();
    img.onload = () => {
      if (!cancelled) onResolved(url);
    };
    img.onerror = () => tryNext();
    img.src = url;
  };

  tryNext();
  return () => {
    cancelled = true;
  };
}
