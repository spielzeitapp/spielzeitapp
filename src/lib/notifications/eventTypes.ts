/**
 * Normalisiert DB-Zeilen (kind/type/event_type, attendance_mode/participation_mode).
 */
export type RawEventRow = {
  id: string;
  team_season_id: string;
  kind?: string | null;
  /** Legacy / alternativ */
  type?: string | null;
  event_type?: string | null;
  starts_at: string;
  status?: string | null;
  participation_mode?: string | null;
  attendance_mode?: string | null;
  notes?: string | null;
  opponent?: string | null;
  training_absence_deadline_disabled?: boolean | null;
  meetup_at?: string | null;
  meeting_at?: string | null;
};

export type CanonicalEventType = 'training' | 'game' | 'event' | 'other';

export function getCanonicalEventType(row: RawEventRow): CanonicalEventType {
  const et = (row.event_type ?? '').toLowerCase().trim();
  if (et === 'game') return 'game';
  if (et === 'training') return 'training';
  if (et === 'event') return 'event';
  if (et === 'other') return 'other';
  const t = (row.type ?? '').toLowerCase().trim();
  if (t === 'match') return 'game';
  if (t === 'training') return 'training';
  if (t === 'event') return 'event';
  const k = (row.kind ?? '').toLowerCase().trim();
  if (k === 'match') return 'game';
  if (k === 'training') return 'training';
  if (k === 'event') return 'event';
  return 'other';
}

export function getParticipationMode(row: RawEventRow): 'opt_in' | 'opt_out' {
  const p = (row.participation_mode ?? row.attendance_mode ?? 'opt_in').toLowerCase().trim();
  return p === 'opt_out' ? 'opt_out' : 'opt_in';
}

export function getEventDisplayTitle(row: RawEventRow): string {
  const notes = row.notes?.trim();
  if (notes) {
    const first = notes.split('·')[0]?.trim();
    if (first) return first;
  }
  if (getCanonicalEventType(row) === 'game') {
    return row.opponent?.trim() ? `vs ${row.opponent.trim()}` : 'Spiel';
  }
  if (getCanonicalEventType(row) === 'training') {
    return 'Training';
  }
  return 'Termin';
}
