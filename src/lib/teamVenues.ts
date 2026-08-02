import { supabase } from './supabaseClient';
import {
  formatVenueAddressLine,
  listVenuesForClub,
  type VenueRow,
} from './venues';

export type TeamVenueRow = {
  id: string;
  club_id: string;
  team_id: string | null;
  opponent_key: string | null;
  opponent_label: string | null;
  venue_id: string;
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type VenueCandidate = VenueRow & {
  link_id: string | null;
  is_default: boolean;
  /** preferred = linked to team/opponent; catalog = other club venues */
  source: 'preferred' | 'catalog';
};

const LINK_SELECT =
  'id, club_id, team_id, opponent_key, opponent_label, venue_id, is_default, created_at, updated_at';

/** Saisonunabhängiger Gegner-Schlüssel (Fallback ohne opponent_team_id). */
export function normalizeOpponentKey(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function venueHasAddress(v: Pick<VenueRow, 'address' | 'postal_code' | 'city'>): boolean {
  return Boolean(formatVenueAddressLine(v));
}

/**
 * ÖFB-Vorbereitung: bekannte Spielorte für einen Gegner laden.
 * 0 / 1 / mehrere Kandidaten — Import entscheidet später.
 */
export async function resolveOpponentVenueCandidates(opts: {
  clubId: string;
  opponentName: string;
}): Promise<{ data: VenueCandidate[]; error: string | null }> {
  const key = normalizeOpponentKey(opts.opponentName);
  if (!opts.clubId || !key) return { data: [], error: null };

  const { data: links, error } = await supabase
    .from('team_venues')
    .select(LINK_SELECT)
    .eq('club_id', opts.clubId)
    .eq('opponent_key', key)
    .order('is_default', { ascending: false });

  if (error) {
    if (/team_venues|does not exist|schema cache/i.test(error.message)) {
      return { data: [], error: null };
    }
    return { data: [], error: error.message };
  }

  const rows = (links ?? []) as TeamVenueRow[];
  if (rows.length === 0) return { data: [], error: null };

  const ids = rows.map((r) => r.venue_id);
  const { data: venueRows, error: venueErr } = await supabase
    .from('venues')
    .select('id, club_id, team_id, name, address, postal_code, city, latitude, longitude, is_home, is_active')
    .in('id', ids)
    .eq('is_active', true);
  if (venueErr) return { data: [], error: venueErr.message };

  const byId = new Map((venueRows ?? []).map((v) => [String((v as VenueRow).id), v as VenueRow]));
  const out: VenueCandidate[] = [];
  for (const link of rows) {
    const v = byId.get(link.venue_id);
    if (!v) continue;
    out.push({
      ...v,
      link_id: link.id,
      is_default: link.is_default,
      source: 'preferred',
    });
  }
  out.sort(
    (a, b) =>
      Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name, 'de'),
  );
  return { data: out, error: null };
}

export async function resolveTeamHomeVenueCandidates(opts: {
  clubId: string;
  teamId: string;
}): Promise<{ data: VenueCandidate[]; error: string | null }> {
  if (!opts.clubId || !opts.teamId) return { data: [], error: null };

  const { data: links, error } = await supabase
    .from('team_venues')
    .select(LINK_SELECT)
    .eq('club_id', opts.clubId)
    .eq('team_id', opts.teamId)
    .order('is_default', { ascending: false });

  if (error) {
    if (/team_venues|does not exist|schema cache/i.test(error.message)) {
      // Fallback: venues mit is_home / team_id bis Relation existiert.
      const all = await listVenuesForClub(opts.clubId);
      if (all.error) return { data: [], error: all.error };
      const preferred = all.data.filter((v) => v.is_home || v.team_id === opts.teamId);
      return {
        data: preferred.map((v) => ({
          ...v,
          link_id: null,
          is_default: v.is_home,
          source: 'preferred' as const,
        })),
        error: null,
      };
    }
    return { data: [], error: error.message };
  }

  const rows = (links ?? []) as TeamVenueRow[];
  if (rows.length === 0) {
    const all = await listVenuesForClub(opts.clubId);
    if (all.error) return { data: [], error: all.error };
    const preferred = all.data.filter((v) => v.is_home || v.team_id === opts.teamId);
    return {
      data: preferred.map((v) => ({
        ...v,
        link_id: null,
        is_default: v.is_home,
        source: 'preferred' as const,
      })),
      error: null,
    };
  }

  const ids = rows.map((r) => r.venue_id);
  const { data: venueRows, error: venueErr } = await supabase
    .from('venues')
    .select('id, club_id, team_id, name, address, postal_code, city, latitude, longitude, is_home, is_active')
    .in('id', ids)
    .eq('is_active', true);
  if (venueErr) return { data: [], error: venueErr.message };

  const byId = new Map((venueRows ?? []).map((v) => [String((v as VenueRow).id), v as VenueRow]));
  const out: VenueCandidate[] = [];
  for (const link of rows) {
    const v = byId.get(link.venue_id);
    if (!v) continue;
    out.push({
      ...v,
      link_id: link.id,
      is_default: link.is_default,
      source: 'preferred',
    });
  }
  out.sort(
    (a, b) =>
      Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name, 'de'),
  );
  return { data: out, error: null };
}

export async function linkVenueToTeam(opts: {
  clubId: string;
  teamId: string;
  venueId: string;
  isDefault?: boolean;
}): Promise<{ data: TeamVenueRow | null; error: string | null }> {
  if (opts.isDefault) {
    await supabase
      .from('team_venues')
      .update({ is_default: false })
      .eq('club_id', opts.clubId)
      .eq('team_id', opts.teamId)
      .eq('is_default', true);
  }
  const { data, error } = await supabase
    .from('team_venues')
    .insert({
      club_id: opts.clubId,
      team_id: opts.teamId,
      opponent_key: null,
      opponent_label: null,
      venue_id: opts.venueId,
      is_default: opts.isDefault === true,
    })
    .select(LINK_SELECT)
    .maybeSingle();
  if (error) {
    if (/idx_team_venues_team_venue_unique|duplicate/i.test(error.message)) {
      return { data: null, error: null };
    }
    return { data: null, error: error.message };
  }
  return { data: (data as TeamVenueRow | null) ?? null, error: null };
}

export async function linkVenueToOpponent(opts: {
  clubId: string;
  opponentName: string;
  venueId: string;
  isDefault?: boolean;
}): Promise<{ data: TeamVenueRow | null; error: string | null }> {
  const key = normalizeOpponentKey(opts.opponentName);
  const label = String(opts.opponentName ?? '').trim() || null;
  if (!key) return { data: null, error: 'Gegner fehlt.' };

  if (opts.isDefault) {
    await supabase
      .from('team_venues')
      .update({ is_default: false })
      .eq('club_id', opts.clubId)
      .eq('opponent_key', key)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('team_venues')
    .insert({
      club_id: opts.clubId,
      team_id: null,
      opponent_key: key,
      opponent_label: label,
      venue_id: opts.venueId,
      is_default: opts.isDefault === true,
    })
    .select(LINK_SELECT)
    .maybeSingle();
  if (error) {
    if (/idx_team_venues_opponent_venue_unique|duplicate/i.test(error.message)) {
      return { data: null, error: null };
    }
    return { data: null, error: error.message };
  }
  return { data: (data as TeamVenueRow | null) ?? null, error: null };
}

export async function isVenueLinkedToOpponent(opts: {
  clubId: string;
  opponentName: string;
  venueId: string;
}): Promise<boolean> {
  const key = normalizeOpponentKey(opts.opponentName);
  if (!key || !opts.venueId) return false;
  const { data, error } = await supabase
    .from('team_venues')
    .select('id')
    .eq('club_id', opts.clubId)
    .eq('opponent_key', key)
    .eq('venue_id', opts.venueId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function isVenueLinkedToTeam(opts: {
  clubId: string;
  teamId: string;
  venueId: string;
}): Promise<boolean> {
  if (!opts.teamId || !opts.venueId) return false;
  const { data, error } = await supabase
    .from('team_venues')
    .select('id')
    .eq('club_id', opts.clubId)
    .eq('team_id', opts.teamId)
    .eq('venue_id', opts.venueId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
