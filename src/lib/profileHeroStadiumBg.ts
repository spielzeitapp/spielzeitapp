/**
 * Premium-Stadion-Hintergrund für Profil-Hero (Trainer + Spieler).
 * Asset: public/profile/profile-hero-stadium.png
 */
export const PROFILE_HERO_STADIUM_BG = "/profile/profile-hero-stadium.png";

/** Fallback-Reihenfolge, falls Primärdatei fehlt. */
export const PROFILE_HERO_STADIUM_BG_CANDIDATES = [
  PROFILE_HERO_STADIUM_BG,
  "/profile/profile-hero-stadium.jpg",
  "/profile/profile-hero-stadium.jpeg",
  "/profile/profile-hero-stadium.PNG",
] as const;

let stadiumPreloaded = false;

/** Stadion-Asset früh preloaden — weniger Layout-Shift beim Hero-Mount. */
export function preloadProfileHeroStadiumBackground(): void {
  if (stadiumPreloaded || typeof document === "undefined") return;
  stadiumPreloaded = true;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = PROFILE_HERO_STADIUM_BG;
  document.head.appendChild(link);
  preloadProfileHeroStadiumImage();
}

export function preloadProfileHeroStadiumImage(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = PROFILE_HERO_STADIUM_BG;
  });
}

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
