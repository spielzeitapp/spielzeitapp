/** Kurzer Spieltags-Begleittext; der eigentliche Feed-Beitrag bleibt unverändert. */
export function compactMatchdayCaption(caption: string): string {
  const trimmed = caption.trim();
  if (!/SPIELTAG|HEIMSPIEL|AUSWÄRTSSPIEL/i.test(trimmed)) return trimmed;
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const facts = paragraphs.slice(1).flatMap((p) => p.split('\n'))
    .map((line) => line.trim())
    .filter((line) => /^(?:⚽|[\u{1F550}-\u{1F567}]|⏰|📍|📅|🗓|Anpfiff\b|Spielort\b|Datum\b)/u.test(line));
  // Ohne erkennbare Fakten keine Information blind abschneiden.
  if (facts.length === 0) return trimmed;
  return [paragraphs[0], [...new Set(facts)].join('\n')].join('\n\n');
}

export function buildMatchdayShareText(params: {
  home: string;
  away: string;
  startsAt: string;
  location?: string | null;
  isHome: boolean;
}): string {
  const date = new Date(params.startsAt);
  const valid = Number.isFinite(date.getTime());
  const dateLabel = valid ? new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date) : '';
  const timeLabel = valid ? new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit',
  }).format(date) : '';
  return [
    `⚽ ${params.isHome ? 'HEIMSPIEL' : 'AUSWÄRTSSPIEL'}`,
    `${params.home} vs. ${params.away}`,
    '',
    dateLabel ? `📅 ${dateLabel}` : null,
    timeLabel ? `⏰ Anpfiff: ${timeLabel} Uhr` : null,
    params.location?.trim() ? `📍 ${params.location.trim()}` : null,
  ].filter((line) => line !== null).join('\n');
}
