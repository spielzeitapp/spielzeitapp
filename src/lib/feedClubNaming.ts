/** Altersklasse (U11 …) — nie in der zweizeiligen Vereinsanzeige. */
export function tokenLooksLikeAgeGroup(token: string): boolean {
  return /^U\d{1,2}[a-z]?$/i.test((token || '').trim());
}

export type ClubDisplayParts = {
  ageGroup: string | null;
  line1: string;
  line2: string;
};

/**
 * Vereinsname für Feed: Altersklasse optional oben (Meta), Name zweizeilig (Kürzel + Ort/Rest).
 * „U11 SPG Rohrbach“ → U11 | SPG / Rohrbach
 * „SKVg Pottenbrunn“ → SKVg / Pottenbrunn
 */
export function parseClubDisplayName(full: string): ClubDisplayParts {
  const trimmed = (full || '').trim();
  if (!trimmed) return { ageGroup: null, line1: '', line2: '' };

  let parts = trimmed.split(/\s+/).filter(Boolean);
  let ageGroup: string | null = null;
  if (parts[0] && tokenLooksLikeAgeGroup(parts[0])) {
    ageGroup = parts[0].toUpperCase();
    parts = parts.slice(1);
  }

  if (parts.length === 0) {
    return { ageGroup, line1: trimmed, line2: '' };
  }
  if (parts.length === 1) {
    return { ageGroup, line1: parts[0], line2: '' };
  }

  return {
    ageGroup,
    line1: parts[0],
    line2: parts.slice(1).join(' '),
  };
}

export function buildFeedMatchMetaLine(
  ageGroup: string | null | undefined,
  matchTypeLabel: string | null | undefined,
): string | null {
  const bits = [
    ageGroup?.trim() || null,
    matchTypeLabel?.trim() || null,
  ].filter(Boolean) as string[];
  return bits.length > 0 ? bits.join(' · ') : null;
}

export function pickFeedAgeGroup(...names: string[]): string | null {
  for (const n of names) {
    const ag = parseClubDisplayName(n).ageGroup;
    if (ag) return ag;
  }
  return null;
}
