import { supabase } from './supabaseClient';
import { uploadStorageObject } from './storageUpload';
import { getClubLogo, isPlaceholderLogoUrl, PLACEHOLDER_LOGO } from './teamLogos';
import { normalizeOpponentKey } from './teamVenues';
import { resolveClubIdForTeamSeason } from './venues';

export type OpponentCatalogRow = {
  id: string;
  club_id: string;
  opponent_key: string;
  display_name: string;
  logo_url: string | null;
  external_source: string | null;
  external_id: string | null;
};

const SELECT =
  'id, club_id, opponent_key, display_name, logo_url, external_source, external_id';

function isMissingCatalogError(message: string): boolean {
  return /opponent_catalog|does not exist|schema cache/i.test(message);
}

export async function resolveClubIdFromTeamSeason(
  teamSeasonId: string,
): Promise<string | null> {
  const r = await resolveClubIdForTeamSeason(teamSeasonId);
  return r.clubId;
}

/** Upsert Gegner im Catalog (ohne Logo zu überschreiben, falls schon gesetzt). */
export async function ensureOpponentCatalogEntry(opts: {
  clubId: string;
  displayName: string;
  logoUrl?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
}): Promise<{ data: OpponentCatalogRow | null; error: string | null }> {
  const key = normalizeOpponentKey(opts.displayName);
  const name = String(opts.displayName ?? '').trim();
  if (!opts.clubId || !key || !name) return { data: null, error: null };

  const existing = await supabase
    .from('opponent_catalog')
    .select(SELECT)
    .eq('club_id', opts.clubId)
    .eq('opponent_key', key)
    .maybeSingle();

  if (existing.error) {
    if (isMissingCatalogError(existing.error.message)) {
      return { data: null, error: null };
    }
    return { data: null, error: existing.error.message };
  }

  if (existing.data) {
    const row = existing.data as OpponentCatalogRow;
    const patch: Record<string, unknown> = {
      display_name: name,
      updated_at: new Date().toISOString(),
    };
    if (!row.logo_url && opts.logoUrl) patch.logo_url = opts.logoUrl;
    if (opts.externalSource) patch.external_source = opts.externalSource;
    if (opts.externalId) patch.external_id = opts.externalId;
    const { data, error } = await supabase
      .from('opponent_catalog')
      .update(patch)
      .eq('id', row.id)
      .select(SELECT)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: (data as OpponentCatalogRow) ?? row, error: null };
  }

  const { data, error } = await supabase
    .from('opponent_catalog')
    .insert({
      club_id: opts.clubId,
      opponent_key: key,
      display_name: name,
      logo_url: opts.logoUrl ?? null,
      external_source: opts.externalSource ?? null,
      external_id: opts.externalId ?? null,
    })
    .select(SELECT)
    .maybeSingle();
  if (error) {
    if (isMissingCatalogError(error.message)) return { data: null, error: null };
    return { data: null, error: error.message };
  }
  return { data: (data as OpponentCatalogRow) ?? null, error: null };
}

export async function setOpponentCatalogLogo(opts: {
  clubId: string;
  displayName: string;
  logoUrl: string | null;
}): Promise<{ error: string | null }> {
  const ensured = await ensureOpponentCatalogEntry({
    clubId: opts.clubId,
    displayName: opts.displayName,
    logoUrl: opts.logoUrl,
  });
  if (ensured.error) return { error: ensured.error };
  if (!ensured.data) {
    return {
      error:
        'Gegner-Katalog fehlt. Bitte Migration 20260803120000_opponent_catalog_and_logos.sql ausführen.',
    };
  }
  const { error } = await supabase
    .from('opponent_catalog')
    .update({ logo_url: opts.logoUrl, updated_at: new Date().toISOString() })
    .eq('id', ensured.data.id);
  if (error) {
    if (isMissingCatalogError(error.message)) {
      return {
        error:
          'Gegner-Katalog fehlt. Bitte Migration 20260803120000_opponent_catalog_and_logos.sql ausführen.',
      };
    }
    return { error: error.message };
  }
  return { error: null };
}

/** Batch: opponent_key → logo_url */
export async function fetchOpponentCatalogLogoMap(
  clubId: string,
  opponentNames: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!clubId) return map;
  const keys = [
    ...new Set(opponentNames.map((n) => normalizeOpponentKey(n)).filter(Boolean)),
  ];
  if (keys.length === 0) return map;

  const { data, error } = await supabase
    .from('opponent_catalog')
    .select('opponent_key, logo_url')
    .eq('club_id', clubId)
    .in('opponent_key', keys);
  if (error) return map;
  for (const row of data ?? []) {
    const key = String((row as { opponent_key?: string }).opponent_key ?? '');
    const url = String((row as { logo_url?: string | null }).logo_url ?? '').trim();
    if (key && url) map.set(key, url);
  }
  return map;
}

/**
 * Priorität:
 * 1 catalog logo
 * 2 event.opponent_logo_url
 * 3 public/logos mapping
 * 4 placeholder
 */
export function resolveDisplayOpponentLogo(opts: {
  opponent: string | null | undefined;
  eventLogoUrl?: string | null;
  catalogLogoUrl?: string | null;
}): string {
  const catalog = String(opts.catalogLogoUrl ?? '').trim();
  if (catalog && !isPlaceholderLogoUrl(catalog)) {
    return getClubLogo(String(opts.opponent ?? ''), { logoUrl: catalog }) || PLACEHOLDER_LOGO;
  }
  const eventLogo = String(opts.eventLogoUrl ?? '').trim();
  if (eventLogo && !isPlaceholderLogoUrl(eventLogo)) {
    return getClubLogo(String(opts.opponent ?? ''), { logoUrl: eventLogo }) || PLACEHOLDER_LOGO;
  }
  return getClubLogo(String(opts.opponent ?? '')) || PLACEHOLDER_LOGO;
}

export async function uploadOpponentLogoFile(opts: {
  clubId: string;
  opponentName: string;
  file: File;
}): Promise<{ publicUrl: string | null; error: string | null }> {
  const key = normalizeOpponentKey(opts.opponentName);
  if (!opts.clubId || !key) return { publicUrl: null, error: 'Gegner oder Club fehlt.' };

  const ext =
    opts.file.type === 'image/png'
      ? 'png'
      : opts.file.type === 'image/webp'
        ? 'webp'
        : opts.file.type === 'image/gif'
          ? 'gif'
          : 'jpg';
  const path = `${opts.clubId}/${key.replace(/[^a-z0-9_-]+/gi, '_')}/logo.${ext}`;
  const up = await uploadStorageObject('opponent-logos', path, opts.file, {
    upsert: true,
    contentType: opts.file.type || `image/${ext}`,
    cacheControl: '3600',
  });
  if (up.error) {
    return {
      publicUrl: null,
      error:
        up.error.message.includes('Bucket') || /not found|does not exist/i.test(up.error.message)
          ? 'Storage-Bucket opponent-logos fehlt. Bitte Migration 20260803120000 ausführen.'
          : up.error.message,
    };
  }
  const { data } = supabase.storage.from('opponent-logos').getPublicUrl(path);
  const publicUrl = data?.publicUrl ?? null;
  if (!publicUrl) return { publicUrl: null, error: 'Public URL fehlt.' };

  const catalog = await setOpponentCatalogLogo({
    clubId: opts.clubId,
    displayName: opts.opponentName,
    logoUrl: publicUrl,
  });
  if (catalog.error) return { publicUrl, error: catalog.error };
  return { publicUrl, error: null };
}
