import { supabase } from './supabaseClient';
import { safeOptionalText, safeText } from './safeText';

export type ValidateOfficialTournamentUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function validateOfficialTournamentUrl(raw: unknown): ValidateOfficialTournamentUrlResult {
  const trimmed = safeText(raw);
  if (!trimmed) {
    return { ok: false, error: 'Bitte Turnierplan-URL eingeben.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Ungültige URL. Bitte mit http:// oder https:// beginnen.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL muss mit http:// oder https:// beginnen.' };
  }
  return { ok: true, url: parsed.toString() };
}

export function displayDomainFromOfficialPlanUrl(url: unknown): string {
  const raw = safeText(url);
  if (!raw) return '';
  try {
    return new URL(raw).hostname.replace(/^www\./i, '');
  } catch {
    return raw;
  }
}

export function openOfficialTournamentPlanUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function saveOfficialTournamentPlanUrl(
  eventId: string,
  url: string | null,
): Promise<{ error: string | null }> {
  if (String(eventId ?? '').trim() === 'ev-tournament') {
    return { error: null };
  }
  const { error } = await supabase
    .from('events')
    .update({ official_tournament_url: safeOptionalText(url) })
    .eq('id', eventId);
  return { error: error?.message ?? null };
}
