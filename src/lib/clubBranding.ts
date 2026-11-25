import { prepareLogoFile } from './logoPreparation';
import { supabase } from './supabaseClient';
import { uploadStorageObject } from './storageUpload';
import { getClubLogo, isPlaceholderLogoUrl } from './teamLogos';

export type ClubBranding = { logo_url: string | null; primary_color: string | null; secondary_color: string | null; accent_color: string | null };
export const BRANDING_CHANGED_EVENT = 'spielzeit:club-branding-changed';
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
  return luminance(hexToRgbChannels(normalized).split(' ').map(Number)) > 0.179 ? '#111114' : '#FFFFFF';
}

function luminance(channels: number[]): number {
  const linear = channels.map(channel => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Muted club accent for text on a light surface and buttons with white labels. */
export function mutedAccentOnLight(hex: string): string {
  const original = hexToRgbChannels(hex).split(' ').map(Number);
  const dark = [23, 18, 25];
  const lightSurfaceLuminance = luminance([247, 248, 250]);
  for (let accentShare = 60; accentShare > 0; accentShare--) {
    const channels = dark.map((channel, index) => Math.round(channel + (original[index] - channel) * accentShare / 100));
    if ((lightSurfaceLuminance + 0.05) / (luminance(channels) + 0.05) >= 4.5) return `rgb(${channels.join(' ')})`;
  }
  return '#171219';
}

/** RGB channels for accent text on the dark app surface (minimum 4.5:1). */
export function readableAccentOnDark(hex: string): string {
  const normalized = normalizeBrandColor(hex) ?? '#FF4050';
  const original = [1, 3, 5].map(i => parseInt(normalized.slice(i, i + 2), 16));
  const darkLuminance = luminance([11, 11, 15]);
  for (let mix = 0; mix <= 100; mix++) {
    const channels = original.map(c => Math.round(c + (255 - c) * mix / 100));
    if ((luminance(channels) + 0.05) / (darkLuminance + 0.05) >= 4.5) return channels.join(' ');
  }
  return '255 255 255';
}

/** Mannschaftsdesign laden oder auf das Design des zugehörigen Vereins zurückfallen. */
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
    .select('club_id, team_branding_overrides(logo_url, primary_color, secondary_color, accent_color)')
    .eq('id', teamId)
    .maybeSingle();
  if (teamError) return { data: null, error: teamError.message };
  const teamBranding = team?.team_branding_overrides as ClubBranding | null | undefined;
  if (teamBranding?.logo_url) return { data: teamBranding, error: null };
  const clubId = team?.club_id;
  if (!clubId) return { data: null, error: null };

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('name, logo_url, primary_color, secondary_color, accent_color')
    .eq('id', clubId)
    .maybeSingle();
  if (clubError) return { data: teamBranding ?? null, error: clubError.message };
  if (!club) return { data: teamBranding ?? null, error: null };
  const row = club as ClubBranding & { name: string };
  const mappedClubLogo = getClubLogo(row.name);
  const clubLogo = row.logo_url || (isPlaceholderLogoUrl(mappedClubLogo) ? null : mappedClubLogo);
  if (teamBranding) return { data: { ...teamBranding, logo_url: clubLogo }, error: null };
  return {
    data: {
      logo_url: clubLogo,
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
  // Saving manager branding also upgrades an existing white-backed logo.
  if (!logoFile && logoUrl) {
    try {
      const response = await fetch(logoUrl);
      const blob = response.ok ? await response.blob() : null;
      if (blob && ['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) && blob.size <= 5 * 1024 * 1024) {
        const prepared = await prepareLogoFile(new File([blob], 'club-logo', { type: blob.type }));
        if (prepared.changed) logoFile = prepared.file;
      }
    } catch { /* Keep the saved logo if the source cannot be prepared. */ }
  }
  if (logoFile) {
    const uploaded = await uploadBrandingLogo('club-logos', clubId, logoFile);
    if ('error' in uploaded) return { error: uploaded.error };
    logoUrl = uploaded.url;
  }
  const { error } = await supabase.rpc('admin_set_club_branding', { p_club_id: clubId, p_logo_url: logoUrl,
    p_primary_color: branding.primary_color, p_secondary_color: branding.secondary_color, p_accent_color: branding.accent_color });
  return { error: error?.message ?? null };
}

async function uploadBrandingLogo(bucket: 'club-logos' | 'team-logos', ownerId: string, file: File): Promise<{ url: string } | { error: string }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    return { error: 'Logo muss PNG, JPEG oder WebP sein und darf höchstens 5 MB groß sein.' };
  }
  try { file = (await prepareLogoFile(file)).file; }
  catch { return { error: 'Logo konnte nicht aufbereitet werden. Bitte ein anderes Bild verwenden.' }; }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const upload = await uploadStorageObject(bucket, path, file, { contentType: file.type });
  if (upload.error) return { error: upload.error.message };
  return { url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

export async function getTeamBranding(teamId: string): Promise<{ data: ClubBranding | null; error: string | null }> {
  const { data, error } = await supabase.from('team_branding_overrides')
    .select('logo_url, primary_color, secondary_color, accent_color').eq('team_id', teamId).maybeSingle();
  return { data: data as ClubBranding | null, error: error?.message ?? null };
}

export async function saveTeamBranding(clubId: string, teamId: string, branding: ClubBranding | null, file: File | null): Promise<{ data: ClubBranding | null; error: string | null }> {
  let draft = branding;
  if (draft && file) {
    const uploaded = await uploadBrandingLogo('team-logos', teamId, file);
    if ('error' in uploaded) return { data: null, error: uploaded.error };
    draft = { ...draft, logo_url: uploaded.url };
  }
  const { error } = await supabase.rpc('admin_set_team_branding', {
    p_club_id: clubId, p_team_id: teamId, p_branding: draft,
  });
  if (error) return { data: null, error: error.message };
  window.dispatchEvent(new Event(BRANDING_CHANGED_EVENT));
  return { data: draft, error: null };
}
