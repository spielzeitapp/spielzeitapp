import { supabase } from './supabaseClient';
import {
  fetchTournamentMatchSlots,
  pickNextPlannedTournamentSlot,
  type TournamentMatchSlotView,
} from './tournamentPlan';
import { eventNotesTitle } from '../components/schedule/scheduleEventViewUtils';

export type TournamentMatchNavigationContext = {
  tournamentEventId: string;
  tournamentTitle: string;
  nextSlot: TournamentMatchSlotView | null;
};

export async function fetchTournamentMatchNavigationContext(
  matchId: string,
  options?: { afterCurrentMatch?: boolean },
): Promise<TournamentMatchNavigationContext | null> {
  const id = matchId.trim();
  if (!id) return null;

  const { data: link, error: linkError } = await supabase
    .from('tournament_matches')
    .select('tournament_event_id')
    .eq('match_id', id)
    .maybeSingle();

  if (linkError || !link?.tournament_event_id) return null;

  const tournamentEventId = String(link.tournament_event_id);
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('id, kind, opponent, notes')
    .eq('id', tournamentEventId)
    .maybeSingle();

  if (eventError || !eventRow || (eventRow.kind ?? '') !== 'tournament') return null;

  const slotsRes = await fetchTournamentMatchSlots(tournamentEventId);
  if (slotsRes.error) return null;

  const tournamentTitle =
    (eventNotesTitle(eventRow.notes as string | null) ?? (eventRow.opponent as string | null) ?? 'Turnier').trim() ||
    'Turnier';

  const nextSlot = pickNextPlannedTournamentSlot(slotsRes.data ?? [], {
    afterMatchId: options?.afterCurrentMatch ? id : null,
  });

  return {
    tournamentEventId,
    tournamentTitle,
    nextSlot,
  };
}

export function tournamentCenterPath(tournamentEventId: string): string {
  return `/app/events/${encodeURIComponent(tournamentEventId.trim())}`;
}
