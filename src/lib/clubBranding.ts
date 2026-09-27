import { supabase } from './supabaseClient';
import { uploadStorageObject } from './storageUpload';

export type ClubBranding = { logo_url: string | null; primary_color: string | null; secondary_color: string | null; accent_color: string | null };
export const DEFAULT_CLUB_BRANDING: ClubBranding = { logo_url: null, primary_color: '#111114', secondary_color: '#FFFFFF', accent_color: '#C82333' };
export function readableTextColor(hex: string): string {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#111114' : '#FFFFFF';
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
