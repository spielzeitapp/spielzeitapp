import { useEffect, useState } from 'react';
import { useSession } from '../auth/useSession';
import { fetchOpponentCatalogLogoMap, resolveClubIdFromTeamSeason } from '../lib/opponentCatalog';
import { getClubLogo, isPlaceholderLogoUrl } from '../lib/teamLogos';
import { normalizeOpponentKey } from '../lib/teamVenues';

// This identity was confirmed during setup: the former SV and current SPG Böheimkirchen.
export function catalogLogoKey(name: string): string {
  const key = normalizeOpponentKey(name).replace(/\bboeheimkirchen\b/g, 'böheimkirchen');
  return /^(spg|sv) böheimkirchen$/.test(key) ? 'sv böheimkirchen' : key;
}
export function preferredClubLogo(name: string, logos: Map<string, string>, fallback?: string | null): string | null {
  const saved = logos.get(catalogLogoKey(name)) || logos.get(normalizeOpponentKey(name));
  if (saved && !isPlaceholderLogoUrl(saved)) return saved;
  const local = getClubLogo(name);
  return !isPlaceholderLogoUrl(local) ? local : fallback ?? null;
}
export function useClubOpponentLogos(names: string[], seasonOverride?: string | null): Map<string, string> {
  const { selectedTeamSeasonId, viewTeamSeasonId } = useSession();
  const seasonId = seasonOverride === undefined ? viewTeamSeasonId ?? selectedTeamSeasonId : seasonOverride;
  const namesKey = JSON.stringify([...new Set(names.map(catalogLogoKey))].sort());
  const key = `${seasonId ?? ''}:${namesKey}`;
  const [result, setResult] = useState<{ key: string; logos: Map<string, string> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!seasonId || namesKey === '[]') return;
    void (async () => {
      const clubId = await resolveClubIdFromTeamSeason(seasonId);
      const logos = clubId ? await fetchOpponentCatalogLogoMap(clubId, JSON.parse(namesKey)) : new Map<string, string>();
      if (!cancelled) setResult({ key, logos });
    })().catch(() => { if (!cancelled) setResult({ key, logos: new Map() }); });
    return () => { cancelled = true; };
  }, [key, seasonId, namesKey]);
  return result?.key === key ? result.logos : new Map();
}
