/** Alias-Vergleich ohne Supabase — sicher für Server/API-Bundles. */

const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

/** Normalisiert Namen für Alias-Vergleich (Import). */
export function normalizeTeamAliasName(name: string): string {
  let s = name.trim().toLowerCase();
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    s = s.split(from).join(to);
  }
  try {
    s = s.normalize('NFD').replace(/\p{M}/gu, '');
  } catch {
    /* ältere Umgebungen ohne Unicode-Property */
  }
  return s
    .replace(/\./g, ' ')
    .replace(/[/\\|]/g, ' ')
    .replace(/[-–—_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(normalized: string): string[] {
  const stop = new Set([
    'u',
    'u8',
    'u9',
    'u10',
    'u11',
    'u12',
    'u13',
    'u14',
    'u15',
    'u16',
    'u17',
    'u18',
    'u19',
    'fc',
    'sv',
    'sc',
    'sk',
    'spg',
    'nsg',
    'sg',
    'tsv',
    'fsv',
    'fk',
    'ask',
    'usc',
  ]);
  return normalized
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function tokensContainedIn(haystack: string, needles: string[]): boolean {
  if (needles.length === 0) return false;
  return needles.every((n) => haystack.includes(n));
}

/**
 * Prüft, ob ein Turnier-Teilnehmername zu einem unserer bekannten Namen passt.
 * Vorsichtiger Enthält-Vergleich (min. Token-Länge / mehrwortige Aliase).
 */
export function isTeamAliasMatch(candidateName: string, knownNames: string[]): boolean {
  const cand = normalizeTeamAliasName(candidateName);
  if (!cand) return false;

  const candTokens = significantTokens(cand);

  for (const known of knownNames) {
    const raw = known.trim();
    if (!raw) continue;

    const norm = normalizeTeamAliasName(raw);
    if (!norm) continue;

    if (cand === norm) return true;

    const shorter = cand.length <= norm.length ? cand : norm;
    const longer = cand.length > norm.length ? cand : norm;

    if (shorter.length >= 4 && longer.includes(shorter)) {
      return true;
    }

    const knownTokens = significantTokens(norm);
    if (knownTokens.length >= 1 && tokensContainedIn(cand, knownTokens)) {
      const hasSubstantial = knownTokens.some((t) => t.length >= 4);
      if (hasSubstantial || knownTokens.length >= 2) {
        return true;
      }
    }

    if (candTokens.length >= 2 && tokensContainedIn(norm, candTokens)) {
      const hasSubstantial = candTokens.some((t) => t.length >= 4);
      if (hasSubstantial) return true;
    }
  }

  return false;
}

export function collectUniqueKnownNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) continue;
    const key = normalizeTeamAliasName(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
