import { supabase } from './supabaseClient';
import { uploadStorageObject } from './storageUpload';

export type ClubBranding = { logo_url: string | null; primary_color: string | null; secondary_color: string | null; accent_color: string | null };
export const DEFAULT_CLUB_BRANDING: ClubBranding = { logo_url: null, primary_color: '#111114', secondary_color: '#FFFFFF', accent_color: '#C82333' };

export function normalizeBrandColor(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

export function hexToRgbChannels(value: string): string {
  const normalized = normalizeBrandColor(value) ?? '#000000';
  return [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16)).join(' ');
}

export function readableTextColor(hex: string): string {
  const normalized = normalizeBrandColor(hex) ?? '#000000';
  const rgb = [1, 3, 5].map(i => parseInt(normalized.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#111114' : '#FFFFFF';
}

/** RGB channels for accent text on the dark app surface (minimum 4.5:1). */
export function readableAccentOnDark(hex: string): string {
  const normalized = normalizeBrandColor(hex) ?? '#FF4050';
  const original = [1, 3, 5].map(i => parseInt(normalized.slice(i, i + 2), 16));
  const luminance = (channels: number[]) => {
    const linear = channels.map(channel => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const darkLuminance = luminance([11, 11, 15]);
  for (let mix = 0; mix <= 100; mix++) {
    const channels = original.map(c => Math.round(c + (255 - c) * mix / 100));
    if ((luminance(channels) + 0.05) / (darkLuminance + 0.05) >= 4.5) return channels.join(' ');
  }
  return '255 255 255';
}

/** Branding des Vereins laden, zu dem die aktuell betrachtete Mannschaftssaison gehört. */
export async function getClubBrandingForTeamSeason(teamSeasonId: string): Promise<{ data: ClubBranding | null; error: string | null }> {
  const { data: teamSeason, error: teamSeasonError } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();
  if (teamSeasonError) return { data: null, error: teamSeasonError.message };
  const teamId = (teamSeason as { team_id?: string | null } | null)?.team_id;
  if (!teamId) return { data: null, error: null };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('club_id')
    .eq('id', teamId)
    .maybeSingle();
  if (teamError) return { data: null, error: teamError.message };
  const clubId = (team as { club_id?: string | null } | null)?.club_id;
  if (!clubId) return { data: null, error: null };

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('logo_url, primary_color, secondary_color, accent_color')
    .eq('id', clubId)
    .maybeSingle();
  if (clubError) return { data: null, error: clubError.message };
  if (!club) return { data: null, error: null };
  const row = club as ClubBranding;
  return {
    data: {
      logo_url: row.logo_url ?? null,
      primary_color: normalizeBrandColor(row.primary_color),
      secondary_color: normalizeBrandColor(row.secondary_color),
      accent_color: normalizeBrandColor(row.accent_color),
    },
    error: null,
  };
}
export async function getClubBranding(clubId: string): Promise<{ data: ClubBranding | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_get_club_branding', { p_club_id: clubId });
  return { data: data as ClubBranding | null, error: error?.message ?? null };
}
export async function saveClubBranding(clubId: string, branding: ClubBranding, logoFile: File | null): Promise<{ error: string | null }> {
  let logoUrl = branding.logo_url;
  if (logoFile) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(logoFile.type) || logoFile.size > 5 * 1024 * 1024) return { error: 'Logo muss PNG, JPEG oder WebP sein und darf höchstens 5 MB groß sein.' };
    const ext = logoFile.type === 'image/png' ? 'png' : logoFile.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${clubId}/${crypto.randomUUID()}.${ext}`;
    const upload = await uploadStorageObject('club-logos', path, logoFile, { contentType: logoFile.type });
    if (upload.error) return { error: upload.error.message };
    logoUrl = supabase.storage.from('club-logos').getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.rpc('admin_set_club_branding', { p_club_id: clubId, p_logo_url: logoUrl,
    p_primary_color: branding.primary_color, p_secondary_color: branding.secondary_color, p_accent_color: branding.accent_color });
  return { error: error?.message ?? null };
}
