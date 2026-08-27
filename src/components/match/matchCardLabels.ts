import { VIENNA_TZ } from '../../lib/viennaTime';
import { safeText } from '../../lib/safeText';

/** Spielart (match_type) → Anzeige-Label (wie Termine-Karte). */
export const MATCH_TYPE_LABELS: Record<string, string> = {
  game: 'Meisterschaftsspiel',
  league: 'Meisterschaftsspiel',
  friendly: 'Testspiel',
  tournament: 'Turnier',
  test: 'Testspiel',
  cup: 'Pokal',
  other: 'Sonstiges',
};

export function getMatchTypeLabel(matchType: unknown): string | null {
  const mt = safeText(matchType);
  if (!mt) return null;
  const key = mt.toLowerCase();
  return MATCH_TYPE_LABELS[key] ?? mt;
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
