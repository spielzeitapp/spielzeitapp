import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import { supabase } from '../../lib/supabaseClient';
import { isInternalChampionshipFixture } from '../../lib/championshipVisibility';
import { normalizeEventKind, normalizeEventTypeField } from '../../lib/eventTypeUtils';
import type { EventRow } from '../../hooks/useEvents';

type EventDbRow = Pick<
  EventRow,
  | 'id'
  | 'team_season_id'
  | 'opponent'
  | 'is_home'
  | 'location'
  | 'starts_at'
  | 'notes'
> & {
  kind: string;
  type?: string | null;
  status?: string | null;
  fixture_status?: string | null;
};

export type ManagerMobileEvent = EventRow & {
  teamLabel: string;
};

function teamLabel(teamSeason: SessionTeamSeasonItem | undefined): string {
  return (
    teamSeason?.display_name?.trim() ||
    teamSeason?.age_group?.trim() ||
    teamSeason?.team?.name?.trim() ||
    'Mannschaft'
  );
}

function mapRow(row: EventDbRow, teams: Map<string, SessionTeamSeasonItem>): ManagerMobileEvent {
  const status = row.status === 'live' || row.status === 'finished' || row.status === 'canceled'
    ? row.status
    : 'upcoming';
  return {
    id: row.id,
    team_season_id: row.team_season_id,
    kind: normalizeEventKind(row.kind),
    type: normalizeEventTypeField(row.kind, row.type) as EventRow['type'],
    match_type: null,
    opponent: row.opponent ?? null,
    is_home: row.is_home ?? null,
    location: row.location ?? null,
    starts_at: row.starts_at,
    meeting_at: null,
    status,
    attendance_mode: 'opt_in',
    notes: row.notes ?? null,
    match_id: null,
    fixture_status:
      row.fixture_status === 'open' || row.fixture_status === 'agreed' || row.fixture_status === 'published'
        ? row.fixture_status
        : null,
    created_by: null,
    created_at: null,
    updated_at: null,
    teamLabel: teamLabel(teams.get(row.team_season_id)),
  };
}

export function useManagerMobileEvents(teamSeasons: SessionTeamSeasonItem[]) {
  const [events, setEvents] = useState<ManagerMobileEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useMemo(() => teamSeasons.map((team) => team.id).filter(Boolean), [teamSeasons]);
  const idsKey = ids.join(',');

  const load = useCallback(async () => {
    if (ids.length === 0) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('events')
      .select('id, team_season_id, kind, type, opponent, is_home, location, starts_at, status, notes, fixture_status')
      .in('team_season_id', ids)
      .order('starts_at', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setEvents([]);
      setLoading(false);
      return;
    }

    const teams = new Map(teamSeasons.map((team) => [team.id, team]));
    setEvents(
      ((data ?? []) as unknown as EventDbRow[])
        .filter((row) => !isInternalChampionshipFixture(row.fixture_status))
        .map((row) => mapRow(row, teams)),
    );
    setLoading(false);
  }, [idsKey, teamSeasons]);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, error, refetch: load };
}
