import { supabase } from './supabaseClient';
import { formatFullLocation } from './eventLocation';

export type VenueRow = {
  id: string;
  club_id: string | null;
  team_id: string | null;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_home: boolean;
  is_active: boolean;
};

export type VenueInput = {
  clubId: string;
  teamId?: string | null;
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHome?: boolean;
};

const VENUE_SELECT =
  'id, club_id, team_id, name, address, postal_code, city, latitude, longitude, is_home, is_active';

function nullIfEmpty(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

export function formatVenueAddressLine(v: Pick<VenueRow, 'address' | 'postal_code' | 'city'>): string {
  const street = nullIfEmpty(v.address);
  const cityLine = [nullIfEmpty(v.postal_code), nullIfEmpty(v.city)].filter(Boolean).join(' ');
  return [street, cityLine].filter(Boolean).join(', ');
}

export function formatVenueLocationText(v: Pick<VenueRow, 'name' | 'address' | 'postal_code' | 'city'>): string {
  return formatFullLocation(v.name, formatVenueAddressLine(v)) || v.name;
}

export function venueMapsOpts(v: VenueRow | null | undefined): {
  lat?: number | null;
  lng?: number | null;
  place?: string | null;
  address?: string | null;
} {
  if (!v) return {};
  return {
    lat: v.latitude,
    lng: v.longitude,
    place: v.name,
    address: formatVenueAddressLine(v) || null,
  };
}

export async function resolveClubIdForTeamSeason(
  teamSeasonId: string,
): Promise<{ clubId: string | null; teamId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('team_id, teams(id, club_id)')
    .eq('id', teamSeasonId)
    .maybeSingle();
  if (error) return { clubId: null, teamId: null, error: error.message };
  const team = (data as { team_id?: string; teams?: { id?: string; club_id?: string } | { id?: string; club_id?: string }[] | null } | null)
    ?.teams;
  const teamObj = Array.isArray(team) ? team[0] : team;
  const teamId =
    String(teamObj?.id ?? (data as { team_id?: string } | null)?.team_id ?? '').trim() || null;
  const clubId = String(teamObj?.club_id ?? '').trim() || null;
  return { clubId, teamId, error: null };
}

export async function listVenuesForClub(
  clubId: string,
): Promise<{ data: VenueRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_SELECT)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('is_home', { ascending: false })
    .order('name', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as VenueRow[], error: null };
}

export async function getVenueById(
  venueId: string,
): Promise<{ data: VenueRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_SELECT)
    .eq('id', venueId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: (data as VenueRow | null) ?? null, error: null };
}

export async function createVenue(
  input: VenueInput,
): Promise<{ data: VenueRow | null; error: string | null }> {
  const name = String(input.name ?? '').trim();
  if (!name) return { data: null, error: 'Name ist Pflicht.' };
  if (!input.clubId) return { data: null, error: 'Club fehlt.' };

  const payload = {
    club_id: input.clubId,
    team_id: input.teamId ?? null,
    name,
    address: nullIfEmpty(input.address),
    postal_code: nullIfEmpty(input.postalCode),
    city: nullIfEmpty(input.city),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    is_home: input.isHome === true,
    is_active: true,
  };

  const { data, error } = await supabase.from('venues').insert(payload).select(VENUE_SELECT).maybeSingle();
  if (error) {
    if (/idx_venues_club_name_unique|duplicate/i.test(error.message)) {
      return { data: null, error: 'Dieser Spielort existiert bereits.' };
    }
    return { data: null, error: error.message };
  }
  return { data: (data as VenueRow | null) ?? null, error: null };
}

/** Location-Text für events.location aus Venue (Kompatibilität ohne venue_id-Join). */
export function locationTextFromVenue(v: VenueRow): string {
  return formatVenueLocationText(v);
}
