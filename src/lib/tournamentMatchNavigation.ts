import { supabase } from './supabaseClient';
import {
  fetchTournamentMatchSlots,
  pickNextPlannedTournamentSlot,
  type TournamentMatchSlotView,
} from './tournamentPlan';
import { eventNotesTitle } from '../components/schedule/scheduleEventViewUtils';
import { safeOptionalText, safeText } from './safeText';
import {
  DEMO_TOURNAMENT_EVENT_ID,
  getDemoTournamentEventIdForMatch,
  isDemoTournamentEventId,
} from '../demo/demoTournamentState';
import { demoFixtures } from '../demo/demoFixtures';

export type TournamentMatchNavigationContext = {
  tournamentEventId: string;
  tournamentTitle: string;
  nextSlot: TournamentMatchSlotView | null;
};

export async function fetchTournamentMatchNavigationContext(
  matchId: string,
  options?: { afterCurrentMatch?: boolean },
): Promise<TournamentMatchNavigationContext | null> {
  const id = safeText(matchId);
  if (!id) return null;

  const demoTournamentEventId = getDemoTournamentEventIdForMatch(id);
  if (demoTournamentEventId) {
    const slotsRes = await fetchTournamentMatchSlots(demoTournamentEventId);
    const nextSlot = pickNextPlannedTournamentSlot(slotsRes.data ?? [], {
      afterMatchId: options?.afterCurrentMatch ? id : null,
    });
    return {
      tournamentEventId: demoTournamentEventId,
      tournamentTitle: demoFixtures.tournament.name,
      nextSlot,
    };
  }

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
    safeText(
      eventNotesTitle(eventRow.notes as string | null) ??
        safeOptionalText(eventRow.opponent) ??
        'Turnier',
    ) || 'Turnier';

  const nextSlot = pickNextPlannedTournamentSlot(slotsRes.data ?? [], {
    afterMatchId: options?.afterCurrentMatch ? id : null,
  });

  return {
    tournamentEventId,
    tournamentTitle,
    nextSlot,
  };
}

export function tournamentCenterPath(
  tournamentEventId: string,
  base: '/app' | '/demo' = '/app',
): string {
  const id = safeText(tournamentEventId);
  if (isDemoTournamentEventId(id) || id === DEMO_TOURNAMENT_EVENT_ID) {
    return `${base}/events/${encodeURIComponent(DEMO_TOURNAMENT_EVENT_ID)}`;
  }
  return `${base}/events/${encodeURIComponent(id)}`;
}
