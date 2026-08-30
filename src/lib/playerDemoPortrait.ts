const DEMO_PLAYER_AVATAR_DIR = "/avatars/demo";
const DEMO_FIELD_PLAYER_COUNT = 4;
const GOALKEEPER_JERSEY_NUMBERS = new Set([1, 21]);

function normalizedJerseyNumber(value: number | string | null | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function stableIndex(stableKey: string): number {
  let hash = 2166136261;
  for (let index = 0; index < stableKey.length; index += 1) {
    hash ^= stableKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % DEMO_FIELD_PLAYER_COUNT) + 1;
}

export function isGoalkeeperDemoJersey(value: number | string | null | undefined): boolean {
  const jerseyNumber = normalizedJerseyNumber(value);
  return jerseyNumber != null && GOALKEEPER_JERSEY_NUMBERS.has(jerseyNumber);
}

export function getDemoPlayerPortraitUrl(
  jersey: number | string | null | undefined,
  stableKey = "spieler",
): string {
  const jerseyNumber = normalizedJerseyNumber(jersey);
  if (jerseyNumber != null && GOALKEEPER_JERSEY_NUMBERS.has(jerseyNumber)) {
    return `${DEMO_PLAYER_AVATAR_DIR}/demo-player-goalkeeper-green.webp`;
  }

  const portraitNumber = jerseyNumber != null
    ? ((jerseyNumber - 1) % DEMO_FIELD_PLAYER_COUNT) + 1
    : stableIndex(stableKey);
  return `${DEMO_PLAYER_AVATAR_DIR}/demo-player-upper-${String(portraitNumber).padStart(2, "0")}.webp`;
}

export function isDemoUpperBodyPortraitUrl(url: string | null | undefined): boolean {
  return /\/demo-player-(?:upper-\d+|goalkeeper-green)\.webp(?:\?|$)/i.test((url ?? "").trim());
}
