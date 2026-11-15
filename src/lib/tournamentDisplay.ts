/** Short labels are presentation only; provider names still identify teams and logos. */
export function tournamentTeamLabel(name: string): string {
  const value = String(name ?? '').trim();
  const known: Array<[RegExp,string]> = [
    [/wilhelmsburg/i,'Wilhelmsburg'],[/hertha\s+wels/i,'Hertha Wels'],
    [/(?:bw|blau[ -]?wei(?:ss|ß))\s+linz/i,'BW Linz'],[/markersdorf/i,'Markersdorf'],
    [/rohrbach/i,'Rohrbach'],[/harland/i,'Harland'],
  ];
  const match = known.find(([pattern])=>pattern.test(value));
  if (match) {
    const suffix=value.match(/\s+(I{1,3}|U\d{1,2}|[AB])$/i)?.[1];
    return match[1]+(suffix?` ${suffix}`:'');
  }
  return value.replace(/^(?:FC|SC|SV|USC|ASK|SPS|NSG|SPG)\s+/i,'') || value;
}
