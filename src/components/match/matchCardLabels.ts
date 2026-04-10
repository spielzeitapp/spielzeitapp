import { VIENNA_TZ } from '../../lib/viennaTime';

/** Spielart (match_type) → Anzeige-Label (wie Termine-Karte). */
export const MATCH_TYPE_LABELS: Record<string, string> = {
  game: 'Meisterschaftsspiel',
  league: 'Meisterschaftsspiel',
  friendly: 'Freundschaftsspiel',
  tournament: 'Turnier',
  test: 'Testspiel',
  cup: 'Pokal',
  other: 'Sonstiges',
};

export function getMatchTypeLabel(matchType: string | null | undefined): string | null {
  if (!matchType || !matchType.trim()) return null;
  const key = matchType.trim().toLowerCase();
  return MATCH_TYPE_LABELS[key] ?? matchType;
}

/** Treffpunkt → nur Uhrzeit „HH:mm Uhr“ (Vienna). */
export function formatMeetupTimeOnlyDe(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return (
    new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, hour: '2-digit', minute: '2-digit' }).format(d) +
    ' Uhr'
  );
}
