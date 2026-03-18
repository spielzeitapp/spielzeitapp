import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { useAvailabilityPermissions } from '../hooks/useAvailabilityPermissions';
import { useSession } from '../auth/useSession';
import { normalizeRole, canSeeMeetup } from '../lib/roles';
import { getOurTeamDisplayName } from '../lib/teamLogos';
import { MatchCardLigaportal } from '../app/components/MatchCardLigaportal';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import type { EventRow, EventKind, EventStatus } from '../hooks/useEvents';
import type { PlayerItem } from '../hooks/usePlayers';
import { downloadEventIcs } from '../lib/ics';

type EventDbRow = {
  id: string;
  team_season_id: string;
  kind: string;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  starts_at: string;
  meetup_at: string | null;
  status: string | null;
  participation_mode: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const EVENTS_SELECT =
  'id, team_season_id, kind, opponent, is_home, location, starts_at, meetup_at, status, participation_mode, notes, created_by, created_at, updated_at';

function normalizeEventStatus(s: string | null): EventStatus {
  const v = (s ?? '').trim().toLowerCase();
  if (v === 'live') return 'live';
  if (v === 'finished') return 'finished';
  if (v === 'canceled') return 'canceled';
  return 'upcoming';
}

function mapRowToEventRow(r: EventDbRow): EventRow {
  return {
    id: r.id,
    team_season_id: r.team_season_id,
    kind: (r.kind === 'match' || r.kind === 'training' || r.kind === 'event' ? r.kind : 'event') as EventKind,
    match_type: null,
    opponent: r.opponent ?? null,
    is_home: r.is_home ?? null,
    location: r.location ?? null,
    starts_at: r.starts_at,
    meetup_at: r.meetup_at ?? null,
    status: normalizeEventStatus(r.status),
    participation_mode: (r.participation_mode === 'opt_out' ? 'opt_out' : 'opt_in') as 'opt_in' | 'opt_out',
    notes: r.notes ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

/** Sortierung: Offen zuerst, dann Abgesagt, dann Zugesagt. */
function sortPlayersByAttendanceStatus(
  players: PlayerItem[],
  getStatus: (playerId: string) => 'yes' | 'no' | null
): PlayerItem[] {
  const order = (a: PlayerItem, b: PlayerItem) => {
    const sa = getStatus(a.id) ?? 'open';
    const sb = getStatus(b.id) ?? 'open';
    const rank = (s: string) => (s === 'open' ? 0 : s === 'no' ? 1 : 2);
    return rank(sa) - rank(sb);
  };
  return [...players].sort(order);
}

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  const [rsvpStatus, setRsvpStatus] = useState<'yes' | 'no' | null>(null);
  const [loadingRsvp, setLoadingRsvp] = useState(true);
  /** Für Trainer: alle Zu-/Absagen dieses Events aus event_attendance. */
  const [eventAttendanceByPlayerId, setEventAttendanceByPlayerId] = useState<Record<string, 'yes' | 'no'>>({});
  const [loadingEventAttendance, setLoadingEventAttendance] = useState(false);

  const { teamLabel, role: roleFromHook } = useActiveTeamSeason();
  const { previewRole } = useSession();
  const effectiveRole = normalizeRole(previewRole ?? roleFromHook);
  const showMeetup = canSeeMeetup(effectiveRole);
  const isFan = effectiveRole === 'fan';
  const isTrainerOrAdmin = effectiveRole === 'trainer' || effectiveRole === 'admin';
  const ourTeamName = teamLabel ?? getOurTeamDisplayName();

  const teamSeasonId = event?.team_season_id ?? null;
  const { players, loading: playersLoading } = usePlayers(teamSeasonId);
  const { myAttendancePlayerIds } = useAvailabilityPermissions({
    role: effectiveRole,
    teamSeasonId,
  });
  const playerId = myAttendancePlayerIds[0] ?? null;

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('events')
      .select(EVENTS_SELECT)
      .eq('id', eventId)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setEvent(null);
    } else {
      setEvent(data ? mapRowToEventRow(data as EventDbRow) : null);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    const loadRsvp = async () => {
      if (!eventId || !playerId) {
        setRsvpStatus(null);
        setLoadingRsvp(false);
        return;
      }
      setLoadingRsvp(true);
      const { data, error: err } = await supabase
        .from('event_attendance')
        .select('status')
        .eq('event_id', eventId)
        .eq('player_id', playerId)
        .maybeSingle();

      if (!err && data && (data.status === 'yes' || data.status === 'no')) {
        setRsvpStatus(data.status as 'yes' | 'no');
      } else {
        setRsvpStatus(null);
      }
      setLoadingRsvp(false);
    };
    loadRsvp();
  }, [eventId, playerId]);

  const loadEventAttendance = useCallback(async () => {
    if (!eventId) return;
    setLoadingEventAttendance(true);
    const { data, error: err } = await supabase
      .from('event_attendance')
      .select('player_id, status')
      .eq('event_id', eventId);
    if (!err && data) {
        const byPlayer: Record<string, 'yes' | 'no'> = {};
        for (const row of data as { player_id: string; status: string }[]) {
          const pid = (row.player_id ?? '').toLowerCase();
          if (row.status === 'yes' || row.status === 'no') byPlayer[pid] = row.status as 'yes' | 'no';
        }
        setEventAttendanceByPlayerId(byPlayer);
      } else {
        setEventAttendanceByPlayerId({});
      }
    setLoadingEventAttendance(false);
  }, [eventId]);

  useEffect(() => {
    loadEventAttendance();
  }, [loadEventAttendance]);

  const handleRsvp = useCallback(
    async (status: 'yes' | 'no') => {
      let resolvedPlayerId = playerId ?? null;
      if (!eventId) return;
      if (!resolvedPlayerId) {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        if (uid) {
          const byGuardian = await supabase.from('player_guardians').select('player_id').eq('user_id', uid);
          if (!byGuardian.error && byGuardian.data?.length) resolvedPlayerId = byGuardian.data[0].player_id;
          if (!resolvedPlayerId) {
            const byPlayer = await supabase.from('player_users').select('player_id').eq('user_id', uid);
            if (!byPlayer.error && byPlayer.data?.length) resolvedPlayerId = byPlayer.data[0].player_id;
          }
        }
      }
      if (!resolvedPlayerId) return;

      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id ?? null;
      const sourceRole = (effectiveRole === 'parent' || effectiveRole === 'player') ? effectiveRole : null;
      const payload = {
        event_id: eventId,
        player_id: resolvedPlayerId,
        status,
        ...(userId && { updated_by: userId }),
        ...(sourceRole && { source_role: sourceRole }),
      };
      const result = await supabase
        .from('event_attendance')
        .upsert(payload, { onConflict: 'event_id,player_id' })
        .select('event_id, player_id, status');

      if (result.error) return;
      setRsvpStatus(status);
      setEventAttendanceByPlayerId((prev) => ({ ...prev, [resolvedPlayerId!]: status }));
      setAttendanceModalOpen(false);
      await loadEventAttendance();
    },
    [eventId, playerId, effectiveRole, loadEventAttendance]
  );

  /** Trainer/Admin: RSVP für einen beliebigen Spieler des Teams setzen. */
  const handleTrainerRsvp = useCallback(
    async (targetPlayerId: string, status: 'yes' | 'no') => {
      if (!eventId || !isTrainerOrAdmin) return;
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id ?? null;
      const payload = {
        event_id: eventId,
        player_id: targetPlayerId,
        status,
        ...(userId && { updated_by: userId }),
        source_role: 'trainer',
      };
      const result = await supabase
        .from('event_attendance')
        .upsert(payload, { onConflict: 'event_id,player_id' })
        .select('event_id, player_id, status');
      if (result.error) return;
      setEventAttendanceByPlayerId((prev) => ({ ...prev, [targetPlayerId]: status }));
      await loadEventAttendance();
    },
    [eventId, isTrainerOrAdmin, loadEventAttendance]
  );

  const getAttendanceStatus = useCallback(
    (pid: string): 'yes' | 'no' | null => eventAttendanceByPlayerId[(pid ?? '').toLowerCase()] ?? null,
    [eventAttendanceByPlayerId]
  );

  if (!eventId) {
    return (
      <div className="page pb-4">
        <p>Keine Event-ID angegeben.</p>
        <Link to="/app/schedule" className="mt-2 inline-block text-sm text-white/80 hover:text-white">
          ← Zurück zum Spielplan
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page pb-4">
        <p>Lade Termin…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="page pb-4 space-y-3">
        <p>{error ?? 'Termin nicht gefunden.'}</p>
        <Link to="/app/schedule" className="text-sm text-white/80 hover:text-white">
          ← Zurück zum Spielplan
        </Link>
      </div>
    );
  }

  return (
    <div className="page pb-4">
      <div className="mx-auto max-w-[720px] space-y-4 px-4">
        <Link
          to="/app/schedule"
          className="inline-block text-sm text-white/80 hover:text-white"
        >
          ← Zurück zum Spielplan
        </Link>

        <div className="flex justify-end">
          <Button
            variant="soft"
            size="sm"
            className="rounded-xl"
            onClick={() =>
              downloadEventIcs(event as any, {
                appBaseUrl: window.location.origin,
              })
            }
          >
            Zum Kalender hinzufügen
          </Button>
        </div>

        <div className="w-full">
          <MatchCardLigaportal
            ourTeamName={ourTeamName}
            opponent={event.opponent}
            isHome={event.is_home}
            startsAt={event.starts_at}
            status={event.status}
            kind={event.kind}
            eventType={(event as any).event_type ?? undefined}
            notes={event.notes}
            location={event.location}
            meetupAt={event.meetup_at}
            showMeetup={showMeetup}
            isPublicView={true}
          />
        </div>

        {!isFan && (
          <Card>
            <CardTitle>Zu-/Absagen</CardTitle>

            {isTrainerOrAdmin && (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full px-3 py-1 text-sm font-semibold bg-green-600/20 text-green-400 border border-green-500/40">
                    Zugesagt: {Object.values(eventAttendanceByPlayerId).filter((s) => s === 'yes').length}
                  </span>
                  <span className="rounded-full px-3 py-1 text-sm font-semibold bg-red-600/20 text-red-400 border border-red-500/40">
                    Abgesagt: {Object.values(eventAttendanceByPlayerId).filter((s) => s === 'no').length}
                  </span>
                  <span className="rounded-full px-3 py-1 text-sm font-semibold bg-gray-600/20 text-gray-400 border border-gray-500/30">
                    Offen: {Math.max(0, players.length - Object.keys(eventAttendanceByPlayerId).length)}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {(playersLoading || loadingEventAttendance) && (
                    <p className="text-sm text-[var(--text-sub)]">Lade…</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length === 0 && (
                    <p className="text-sm text-[var(--text-sub)]">Keine Spieler im Kader.</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length > 0 && (
                    <ul className="space-y-2">
                      {sortPlayersByAttendanceStatus(players, getAttendanceStatus).map((player) => {
                        const status = getAttendanceStatus(player.id);
                        const chipClass =
                          status === 'yes'
                            ? 'rounded-full px-3 py-1 text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/40'
                            : status === 'no'
                              ? 'rounded-full px-3 py-1 text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/40'
                              : 'rounded-full px-3 py-1 text-xs font-semibold bg-gray-600/20 text-gray-400 border border-gray-500/30';
                        const chipLabel = status === 'yes' ? 'DABEI' : status === 'no' ? 'ABWESEND' : 'OFFEN';
                        return (
                          <li
                            key={player.id}
                            className="flex items-center justify-between gap-2 py-2 border-b border-white/10 last:border-0"
                          >
                            <span className="text-[var(--text-main)] font-medium truncate min-w-0">{player.display_name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={chipClass}>{chipLabel}</span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleTrainerRsvp(player.id, 'yes')}
                                  className="rounded px-2 py-1 text-xs font-medium bg-green-600/80 text-white hover:bg-green-500"
                                >
                                  Dabei
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTrainerRsvp(player.id, 'no')}
                                  className="rounded px-2 py-1 text-xs font-medium bg-red-600/80 text-white hover:bg-red-500"
                                >
                                  Abwesend
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}

            {!isTrainerOrAdmin && (effectiveRole === 'player' || effectiveRole === 'parent') && (
              <>
                <p className="mt-2 text-sm text-[var(--text-sub)]">Dein Teilnahme-Status für diesen Termin.</p>
                {!playerId ? (
                  <p className="mt-2 text-sm text-[var(--text-main)]">Kein Spieler zugeordnet. Bitte beim Trainer melden.</p>
                ) : loadingRsvp ? (
                  <p className="mt-2 text-sm text-[var(--text-sub)]">Lade Status…</p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-[var(--text-main)]">
                      Status: {rsvpStatus === 'yes' ? 'Zugesagt' : rsvpStatus === 'no' ? 'Abgesagt' : 'Offen'}
                    </p>
                    <Button
                      variant={rsvpStatus === 'yes' || rsvpStatus === 'no' ? 'primary' : 'secondary'}
                      size="sm"
                      className={`mt-3 ${rsvpStatus === 'yes' ? 'bg-green-600 hover:bg-green-500' : rsvpStatus === 'no' ? 'bg-red-600 hover:bg-red-500' : ''}`}
                      onClick={() => setAttendanceModalOpen(true)}
                    >
                      {rsvpStatus === 'yes' ? 'Zugesagt' : rsvpStatus === 'no' ? 'Abgesagt' : 'Zu-/Absage'}
                    </Button>
                  </>
                )}
              </>
            )}
          </Card>
        )}

        <Modal
          isOpen={attendanceModalOpen}
          title="Zu-/Absage"
          onClose={() => setAttendanceModalOpen(false)}
          footer={
            <Button variant="ghost" onClick={() => setAttendanceModalOpen(false)}>
              Schließen
            </Button>
          }
        >
          <p className="text-sm text-[var(--text-sub)] mb-4">Bitte gib deine Verfügbarkeit an.</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              className="bg-green-600 hover:bg-green-500"
              onClick={() => {
                console.log('[ATTENDANCE BUTTON CLICKED]', 'yes');
                handleRsvp('yes');
              }}
            >
              Dabei
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-500"
              onClick={() => {
                console.log('[ATTENDANCE BUTTON CLICKED]', 'no');
                handleRsvp('no');
              }}
            >
              Abwesend
            </Button>
          </div>
        </Modal>

        {isFan && (
          <p className="text-center text-sm text-white/70">
            Nur Matchinformationen. Zu-/Absage steht nur Spielern, Eltern und Trainern zur Verfügung.
          </p>
        )}
      </div>
    </div>
  );
};
