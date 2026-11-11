/** Participant-facing notices for saved tournament logistics. No delivery side effects. */
export type TournamentLogistics = {
  starts_at: string;
  meeting_at?: string | null;
  location?: string | null;
};
function minute(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 60_000) : null;
}
function dateTime(value: string | null | undefined): string {
  if (!value || minute(value) === null) return 'noch offen';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value)) + ' Uhr';
}
const place = (value: string | null | undefined) => value?.trim() || 'noch offen';
export function tournamentChangeNotice(before: TournamentLogistics, after: TournamentLogistics, tournamentTitle: string) {
  const changes: string[] = [];
  const moved = minute(before.starts_at) !== minute(after.starts_at);
  if (moved) changes.push(`Beginn: ${dateTime(before.starts_at)} → ${dateTime(after.starts_at)}`);
  if (minute(before.meeting_at) !== minute(after.meeting_at)) changes.push(`Treffpunkt: ${dateTime(before.meeting_at)} → ${dateTime(after.meeting_at)}`);
  if (place(before.location) !== place(after.location)) changes.push(`Spielort: ${place(before.location)} → ${place(after.location)}`);
  if (!changes.length) return null;
  return {
    title: moved ? 'Turnier verschoben' : 'Turnier geändert',
    body: `${tournamentTitle.trim() || 'Turnier'}: ${moved ? 'Termin verschoben' : 'Informationen geändert'}.\n${changes.join('\n')}`,
  };
}
export function tournamentCanBeCanceled(status: string, slots: ReadonlyArray<{is_own_team?: boolean | null; match_status?: string | null}>) {
  return status === 'upcoming' && !slots.some(slot => slot.is_own_team !== false && ['live', 'finished'].includes(slot.match_status ?? ''));
}
