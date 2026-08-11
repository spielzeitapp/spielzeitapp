import { listRoster, type RosterPlayer } from './rosterService';
import { supabase } from './supabaseClient';

function sortRoster(players: RosterPlayer[]): RosterPlayer[] {
  return [...players].sort((a, b) => {
    const ja = a.jersey_number;
    const jb = b.jersey_number;
    if (ja != null && jb != null && ja !== jb) return ja - jb;
    if (ja != null && jb == null) return -1;
    if (ja == null && jb != null) return 1;
    const ln = (a.last_name ?? '').localeCompare(b.last_name ?? '', 'de');
    if (ln !== 0) return ln;
    return (a.first_name ?? '').localeCompare(b.first_name ?? '', 'de');
  });
}

function mergeRosterById(base: RosterPlayer[], extra: RosterPlayer[]): RosterPlayer[] {
  const map = new Map<string, RosterPlayer>();
  for (const p of base) map.set(p.id, p);
  for (const p of extra) {
    if (!map.has(p.id)) map.set(p.id, p);
  }
  return sortRoster([...map.values()]);
}

/**
 * Player-IDs mit mindestens einer event_attendance-Zeile auf Trainings der Saison.
 * Keine Writes; Attendance wird nur gelesen.
 */
export async function fetchSeasonTrainingAttendancePlayerIds(
  teamSeasonId: string,
): Promise<{ ids: string[]; error: string | null }> {
  const sid = teamSeasonId.trim();
  if (!sid) return { ids: [], error: null };

  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id')
    .eq('team_season_id', sid)
    .eq('kind', 'training');
  if (evErr) return { ids: [], error: evErr.message };

  const eventIds = (events ?? [])
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean);
  if (eventIds.length === 0) return { ids: [], error: null };

  const { data: att, error: attErr } = await supabase
    .from('event_attendance')
    .select('player_id')
    .in('event_id', eventIds);
  if (attErr) return { ids: [], error: attErr.message };

  const ids = [
    ...new Set(
      (att ?? [])
        .map((r) => String((r as { player_id?: string }).player_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  return { ids, error: null };
}

/**
 * Player-IDs mit Attendance genau für dieses Event.
 */
export async function fetchEventAttendancePlayerIds(
  eventId: string,
): Promise<{ ids: string[]; error: string | null }> {
  const eid = eventId.trim();
  if (!eid) return { ids: [], error: null };

  const { data, error } = await supabase
    .from('event_attendance')
    .select('player_id')
    .eq('event_id', eid);
  if (error) return { ids: [], error: error.message };

  const ids = [
    ...new Set(
      (data ?? [])
        .map((r) => String((r as { player_id?: string }).player_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  return { ids, error: null };
}

function pickPlayersByIds(all: RosterPlayer[], ids: string[]): RosterPlayer[] {
  const want = new Set(ids.map((id) => id.toLowerCase()));
  return all.filter((p) => want.has(p.id.toLowerCase()));
}

/**
 * Historischer Saison-Trainingskader (Archiv):
 * aktive Join-Spieler ∪ Spieler mit echter Trainings-Attendance in der Saison.
 * Pausierte ohne Trainings-Attendance bleiben draußen (kein Quote-Nenner).
 */
export async function listHistoricalSeasonTrainingRoster(
  teamSeasonId: string,
): Promise<{ data: RosterPlayer[]; error: string | null }> {
  const sid = teamSeasonId.trim();
  if (!sid) return { data: [], error: null };

  const [activeRes, allRes, attendeeRes] = await Promise.all([
    listRoster(sid, 'active'),
    listRoster(sid, 'all'),
    fetchSeasonTrainingAttendancePlayerIds(sid),
  ]);

  if (activeRes.error) return { data: [], error: activeRes.error };
  if (allRes.error) return { data: [], error: allRes.error };
  if (attendeeRes.error) return { data: [], error: attendeeRes.error };

  const fromAttendance = pickPlayersByIds(allRes.data, attendeeRes.ids);
  return { data: mergeRosterById(activeRes.data, fromAttendance), error: null };
}

/**
 * Historischer Event-Trainingskader (einzelnes Training im Archiv):
 * Nur status=active — pausierte Spieler mit historischer Attendance bleiben in der DB,
 * fließen aber nicht in Teilnehmerliste/Berechnung ein.
 */
export async function listHistoricalEventTrainingRoster(
  teamSeasonId: string,
  _eventId: string,
): Promise<{ data: RosterPlayer[]; error: string | null }> {
  const sid = teamSeasonId.trim();
  if (!sid) return { data: [], error: null };

  const activeRes = await listRoster(sid, 'active');
  if (activeRes.error) return { data: [], error: activeRes.error };
  return { data: sortRoster(activeRes.data), error: null };
}
