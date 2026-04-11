import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { useAvailabilityPermissions } from '../hooks/useAvailabilityPermissions';
import { normalizeRole, canSeeMeetup } from '../lib/roles';
import { getOurTeamDisplayName } from '../lib/teamLogos';
import { MatchCardLigaportal } from '../app/components/MatchCardLigaportal';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import type { EventRow, EventKind, EventStatus } from '../hooks/useEvents';
import type { PlayerItem } from '../hooks/usePlayers';
import { downloadEventIcs } from '../lib/ics';
import { isTrainingAbsenceDeadlinePassed } from '../lib/trainingAbsence';
import { upsertEventAttendanceMinimal } from '../lib/rsvp/writeEventAttendance';
import { LIVE_FIELD_SLOT_ORDER, replaceMatchLineupAndBench } from '../lib/liveMatchService';
import type { FieldSlotId } from '../types/match';

type EventDbRow = {
  id: string;
  team_season_id: string;
  kind: string;
  type?: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  starts_at: string;
  meeting_at: string | null;
  status: string | null;
  attendance_mode: string | null;
  notes: string | null;
  match_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const EVENTS_SELECT =
  'id, team_season_id, kind, type, opponent, is_home, location, starts_at, meeting_at, status, attendance_mode, notes, match_id, created_by, created_at, updated_at';

function getDomainEventLabel(event: EventRow): string {
  const t = (event.type ?? '').trim().toLowerCase();
  if (event.kind === 'match') {
    if (!t || t === 'game') return 'Meisterschaftsspiel';
    if (t === 'friendly') return 'Freundschaftsspiel';
    if (t === 'cup') return 'Pokal';
    if (t === 'tournament') return 'Turnier';
    if (t === 'test') return 'Testspiel';
    return 'Spiel';
  }
  if (t === 'training' || event.kind === 'training') return 'Training';
  if (t === 'event' || event.kind === 'event') return 'Event';
  return 'Termin';
}

function formatEventDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Vienna',
  }).format(d);
}

function normalizeEventStatus(s: string | null): EventStatus {
  const v = (s ?? '').trim().toLowerCase();
  if (v === 'live') return 'live';
  if (v === 'finished') return 'finished';
  if (v === 'canceled') return 'canceled';
  return 'upcoming';
}

function mapRowToEventRow(r: EventDbRow): EventRow {
  const etRaw = (r.type ?? '').trim().toLowerCase();
  const type: EventRow['type'] =
    etRaw === 'game' || etRaw === 'training' || etRaw === 'event' || etRaw === 'other'
      ? etRaw
      : r.kind === 'match'
        ? 'game'
        : r.kind === 'training'
          ? 'training'
          : 'event';
  return {
    id: r.id,
    team_season_id: r.team_season_id,
    kind: (r.kind === 'match' || r.kind === 'training' || r.kind === 'event' ? r.kind : 'event') as EventKind,
    type,
    opponent: r.opponent ?? null,
    is_home: r.is_home ?? null,
    location: r.location ?? null,
    starts_at: r.starts_at,
    meeting_at: r.meeting_at ?? null,
    status: normalizeEventStatus(r.status),
    attendance_mode: (r.attendance_mode === 'opt_out' ? 'opt_out' : 'opt_in') as 'opt_in' | 'opt_out',
    notes: r.notes ?? null,
    match_id: r.match_id ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

/** Sortierung: Match: Offen → Abwesend → Dabei. Training: Abwesend → Dabei (Default). */
function sortPlayersByAttendanceStatus(
  players: PlayerItem[],
  getStatus: (playerId: string) => 'yes' | 'no' | null,
  isTrainingList: boolean,
): PlayerItem[] {
  const order = (a: PlayerItem, b: PlayerItem) => {
    const sa = getStatus(a.id) ?? 'open';
    const sb = getStatus(b.id) ?? 'open';
    if (isTrainingList) {
      const rankTr = (s: string) => (s === 'no' ? 0 : 1);
      return rankTr(sa) - rankTr(sb);
    }
    const rank = (s: string) => (s === 'open' ? 0 : s === 'no' ? 1 : 2);
    return rank(sa) - rank(sb);
  };
  return [...players].sort(order);
}

const MATCH_SETUP_STARTERS_MAX = 7;

function emptyMatchSetupStarters(): Record<FieldSlotId, string | null> {
  const o = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) o[s] = null;
  return o;
}

/** Trainer: Kader + Startelf, Speichern beim Klick auf Live starten (nur diese Datei, kein Layout-Change oben). */
function EventMatchSetupBlock({ matchId, players }: { matchId: string; players: PlayerItem[] }) {
  const navigate = useNavigate();
  const sortedPlayers = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) ||
          a.display_name.localeCompare(b.display_name, 'de'),
      ),
    [players],
  );

  const [squad, setSquad] = useState<Set<string>>(() => new Set());
  const [startersBySlot, setStartersBySlot] = useState<Record<FieldSlotId, string | null>>(emptyMatchSetupStarters);
  const [loadingLineup, setLoadingLineup] = useState(true);
  const [savingLive, setSavingLive] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const validPlayerIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLineup(true);
      setSetupError(null);
      const [lineupRes, benchRes] = await Promise.all([
        supabase.from('match_lineup').select('slot, player_id').eq('match_id', matchId),
        supabase.from('match_bench').select('player_id').eq('match_id', matchId),
      ]);
      if (cancelled) return;
      if (lineupRes.error || benchRes.error) {
        setSetupError(lineupRes.error?.message ?? benchRes.error?.message ?? 'Aufstellung laden fehlgeschlagen.');
        setLoadingLineup(false);
        return;
      }
      const nextStarters = emptyMatchSetupStarters();
      for (const r of (lineupRes.data ?? []) as { slot: FieldSlotId; player_id: string | null }[]) {
        if (LIVE_FIELD_SLOT_ORDER.includes(r.slot) && r.player_id) {
          nextStarters[r.slot] = r.player_id;
        }
      }
      const nextSquad = new Set<string>();
      for (const row of (benchRes.data ?? []) as { player_id: string }[]) {
        if (row.player_id) nextSquad.add(row.player_id);
      }
      for (const slot of LIVE_FIELD_SLOT_ORDER) {
        const pid = nextStarters[slot];
        if (pid) nextSquad.add(pid);
      }
      setStartersBySlot(nextStarters);
      setSquad(nextSquad);
      setLoadingLineup(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (validPlayerIds.size === 0) return;
    setSquad((prev) => new Set([...prev].filter((id) => validPlayerIds.has(id))));
    setStartersBySlot((prev) => {
      const next = { ...prev };
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        const pid = next[s];
        if (pid && !validPlayerIds.has(pid)) next[s] = null;
      }
      return next;
    });
  }, [players, validPlayerIds]);

  const starterCount = useMemo(
    () => LIVE_FIELD_SLOT_ORDER.filter((s) => startersBySlot[s] != null).length,
    [startersBySlot],
  );

  const starterIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of LIVE_FIELD_SLOT_ORDER) {
      const pid = startersBySlot[s];
      if (pid) set.add(pid);
    }
    return set;
  }, [startersBySlot]);

  const toggleSquad = (playerId: string) => {
    setSquad((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
        setStartersBySlot((st) => {
          const o = { ...st };
          for (const s of LIVE_FIELD_SLOT_ORDER) {
            if (o[s] === playerId) o[s] = null;
          }
          return o;
        });
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const toggleStarter = (playerId: string) => {
    if (!squad.has(playerId)) return;
    setStartersBySlot((prev) => {
      const next = { ...prev };
      let isStarter = false;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] === playerId) isStarter = true;
      }
      if (isStarter) {
        for (const s of LIVE_FIELD_SLOT_ORDER) {
          if (next[s] === playerId) next[s] = null;
        }
        return next;
      }
      const count = LIVE_FIELD_SLOT_ORDER.filter((s) => next[s] != null).length;
      if (count >= MATCH_SETUP_STARTERS_MAX) return prev;
      const emptySlot = LIVE_FIELD_SLOT_ORDER.find((s) => next[s] == null);
      if (!emptySlot) return prev;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] === playerId) next[s] = null;
      }
      next[emptySlot] = playerId;
      return next;
    });
  };

  const squadPlayersSorted = useMemo(
    () => sortedPlayers.filter((p) => squad.has(p.id)),
    [sortedPlayers, squad],
  );

  const onLiveStart = async () => {
    if (starterCount !== MATCH_SETUP_STARTERS_MAX) return;
    setSavingLive(true);
    setSetupError(null);
    const ordered = LIVE_FIELD_SLOT_ORDER.map((s) => startersBySlot[s] ?? null);
    const squadArr = [...squad].filter((pid) => validPlayerIds.has(pid));
    const { error } = await replaceMatchLineupAndBench(matchId, ordered, squadArr);
    setSavingLive(false);
    if (error) {
      setSetupError(error);
      return;
    }
    navigate(`/live?matchId=${matchId}`);
  };

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Match Setup</CardTitle>

      {loadingLineup && <p className="text-sm text-[var(--text-sub)]">Lade Kader…</p>}
      {setupError && (
        <p className="mt-2 text-sm text-red-500" role="alert">
          {setupError}
        </p>
      )}

      {!loadingLineup && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-[var(--text-main)]">Matchkader</p>
          <ul className="flex flex-col divide-y divide-white/10 border border-white/10 rounded-lg">
            {sortedPlayers.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={squad.has(p.id)}
                  onChange={() => toggleSquad(p.id)}
                  className="h-4 w-4 shrink-0 rounded border-white/30"
                />
                <span className="min-w-0 flex-1 text-sm text-[var(--text-main)]">
                  {p.jersey_number != null ? `${p.jersey_number} · ` : ''}
                  {p.display_name}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-sm font-semibold text-[var(--text-main)]">
            Startelf ({starterCount}/{MATCH_SETUP_STARTERS_MAX})
          </p>
          {squadPlayersSorted.length === 0 ? (
            <p className="text-sm text-[var(--text-sub)]">Zuerst Spieler im Matchkader auswählen.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/10 border border-white/10 rounded-lg">
              {squadPlayersSorted.map((p) => {
                const isSt = starterIdSet.has(p.id);
                const blockMore = !isSt && starterCount >= MATCH_SETUP_STARTERS_MAX;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSt}
                      disabled={blockMore}
                      onChange={() => toggleStarter(p.id)}
                      className="h-4 w-4 shrink-0 rounded border-white/30 disabled:opacity-40"
                    />
                    <span className="min-w-0 flex-1 text-sm text-[var(--text-main)]">
                      {p.jersey_number != null ? `${p.jersey_number} · ` : ''}
                      {p.display_name}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            type="button"
            variant="primary"
            className="w-full"
            disabled={savingLive || starterCount !== MATCH_SETUP_STARTERS_MAX}
            onClick={() => void onLiveStart()}
          >
            {savingLive ? 'Speichern…' : 'Live starten'}
          </Button>
        </div>
      )}
    </Card>
  );
}

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);

  const [rsvpStatus, setRsvpStatus] = useState<'yes' | 'no' | null>(null);
  const [loadingRsvp, setLoadingRsvp] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  /** Für Trainer: alle Zu-/Absagen dieses Events aus event_attendance. */
  const [eventAttendanceByPlayerId, setEventAttendanceByPlayerId] = useState<Record<string, 'yes' | 'no'>>({});
  const [eventAttendanceReasonByPlayerId, setEventAttendanceReasonByPlayerId] = useState<Record<string, string | null>>({});
  const [loadingEventAttendance, setLoadingEventAttendance] = useState(false);

  const { teamLabel, role: roleFromHook } = useActiveTeamSeason();
  const effectiveRole = normalizeRole(roleFromHook);
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

  const isTraining = event?.kind === 'training';
  const trainingCancelCutoffPassed =
    event?.kind === 'training'
      ? isTrainingAbsenceDeadlinePassed(event.starts_at, event.training_absence_deadline_disabled)
      : false;
  const trainingCancellationAllowed = event?.kind === 'training' ? !trainingCancelCutoffPassed : false;

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
        setEventAttendanceReasonByPlayerId({});
      } else {
        setEventAttendanceByPlayerId({});
        setEventAttendanceReasonByPlayerId({});
      }
    setLoadingEventAttendance(false);
  }, [eventId]);

  useEffect(() => {
    loadEventAttendance();
  }, [loadEventAttendance]);

  const handleRsvp = useCallback(
    async (status: 'yes' | 'no', _reason?: string) => {
      console.log('[ATTENDANCE FLOW] handleRsvp invoked', {
        caller: 'EventDetailPage.handleRsvp',
        table: 'event_attendance',
        eventId,
        status,
        effectiveRole,
      });
      if (event?.kind === 'training' && status === 'yes') return;
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

      const payload = {
        event_id: eventId,
        player_id: resolvedPlayerId,
        status,
      };
      console.log('[ATTENDANCE FLOW] upsert request', {
        table: 'event_attendance',
        onConflict: 'event_id,player_id',
        payload,
        payloadKeys: Object.keys(payload),
      });
      const result = await upsertEventAttendanceMinimal(supabase, payload);

      if (result.error) return;
      setRsvpStatus(status);
      setEventAttendanceByPlayerId((prev) => ({ ...prev, [(resolvedPlayerId ?? '').toLowerCase()]: status }));
      setAttendanceModalOpen(false);
      setCancelReason('');
      await loadEventAttendance();
    },
    [eventId, playerId, effectiveRole, loadEventAttendance, event?.kind]
  );

  /** Trainer/Admin: RSVP für einen beliebigen Spieler des Teams setzen. Training: „Dabei“ = Eintrag löschen (nur Absagen speichern). */
  const handleTrainerRsvp = useCallback(
    async (targetPlayerId: string, status: 'yes' | 'no') => {
      console.log('[ATTENDANCE FLOW] handleTrainerRsvp invoked', {
        caller: 'EventDetailPage.handleTrainerRsvp',
        table: 'event_attendance',
        eventId,
        targetPlayerId,
        status,
      });
      if (!eventId || !isTrainerOrAdmin) return;
      if (event?.kind === 'training' && status === 'yes') {
        console.log('[ATTENDANCE FLOW] trainer delete request', {
          table: 'event_attendance',
          where: { event_id: eventId, player_id: targetPlayerId },
        });
        const del = await supabase
          .from('event_attendance')
          .delete()
          .eq('event_id', eventId)
          .eq('player_id', targetPlayerId);
        if (del.error) return;
        setEventAttendanceByPlayerId((prev) => {
          const next = { ...prev };
          delete next[(targetPlayerId ?? '').toLowerCase()];
          return next;
        });
        await loadEventAttendance();
        return;
      }
      const payload = {
        event_id: eventId,
        player_id: targetPlayerId,
        status,
      };
      console.log('[ATTENDANCE FLOW] trainer upsert request', {
        table: 'event_attendance',
        onConflict: 'event_id,player_id',
        payload,
        payloadKeys: Object.keys(payload),
      });
      const result = await upsertEventAttendanceMinimal(supabase, payload);
      if (result.error) return;
      setEventAttendanceByPlayerId((prev) => ({ ...prev, [(targetPlayerId ?? '').toLowerCase()]: status }));
      await loadEventAttendance();
    },
    [eventId, event?.kind, isTrainerOrAdmin, loadEventAttendance]
  );

  const getAttendanceStatus = useCallback(
    (pid: string): 'yes' | 'no' | null => eventAttendanceByPlayerId[(pid ?? '').toLowerCase()] ?? null,
    [eventAttendanceByPlayerId]
  );

  if (!eventId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
          <p>Keine Event-ID angegeben.</p>
          <Link to="/app/termine" className="text-sm text-white/80 hover:text-white">
            ← Zurück zum Spielplan
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
          <p>Lade Termin…</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
          <p>{error ?? 'Termin nicht gefunden.'}</p>
          <Link to="/app/termine" className="text-sm text-white/80 hover:text-white">
            ← Zurück zum Spielplan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <Link to="/app/termine" className="text-sm text-white/80 hover:text-white">
            ← Zurück zum Spielplan
          </Link>
          <Button
            variant="soft"
            size="sm"
            className="w-full rounded-xl sm:w-auto sm:self-end"
            onClick={() =>
              downloadEventIcs(event as any, {
                appBaseUrl: window.location.origin,
              })
            }
          >
            Zum Kalender hinzufügen
          </Button>
        </div>

        <div className="flex w-full min-w-0 flex-col">
          <MatchCardLigaportal
            className="!overflow-visible w-full max-w-none rounded-2xl"
            ourTeamName={ourTeamName}
            opponent={event.opponent}
            isHome={event.is_home}
            startsAt={event.starts_at}
            status={event.status}
            kind={event.kind}
            eventType={(event as any).type ?? undefined}
            matchType={
              event.kind === 'match'
                ? (!event.type || event.type === 'game' ? 'league' : event.type)
                : null
            }
            notes={event.notes}
            location={event.location}
            address={event.location}
            meetupAt={event.meeting_at}
            showMeetup={showMeetup}
            isPublicView={true}
          />
        </div>

        <div className="flex flex-col rounded-xl border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-white/60">{getDomainEventLabel(event)}</p>
          <p className="text-sm font-medium text-white">{formatEventDateTimeLabel(event.starts_at)}</p>
          {event.location ? <p className="text-xs text-white/70">{event.location}</p> : null}
        </div>

        {!isFan && (
          <Card className="flex flex-col gap-3">
            <CardTitle>{isTraining ? 'Training-Teilnahme' : 'Zu-/Absagen'}</CardTitle>

            {isTrainerOrAdmin ? (
              <div className="flex flex-col gap-3">
                {isTraining ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full px-3 py-1 text-sm font-semibold bg-green-600/20 text-green-400 border border-green-500/40">
                      Dabei: {Math.max(0, players.length - Object.values(eventAttendanceByPlayerId).filter((s) => s === 'no').length)}
                    </span>
                    <span className="rounded-full px-3 py-1 text-sm font-semibold bg-red-600/20 text-red-400 border border-red-500/40">
                      Abwesend: {Object.values(eventAttendanceByPlayerId).filter((s) => s === 'no').length}
                    </span>
                  </div>
                ) : (
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
                )}
                <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                  {(playersLoading || loadingEventAttendance) && (
                    <p className="text-sm text-[var(--text-sub)]">Lade…</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length === 0 && (
                    <p className="text-sm text-[var(--text-sub)]">Keine Spieler im Kader.</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length > 0 && (
                    <ul className="flex flex-col gap-0">
                      {sortPlayersByAttendanceStatus(players, getAttendanceStatus, isTraining).map((player) => {
                        const status = getAttendanceStatus(player.id);
                        const chipClass = isTraining
                          ? status === 'no'
                            ? 'rounded-full px-3 py-1 text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/40'
                            : 'rounded-full px-3 py-1 text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/40'
                          : status === 'yes'
                            ? 'rounded-full px-3 py-1 text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/40'
                            : status === 'no'
                              ? 'rounded-full px-3 py-1 text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/40'
                              : 'rounded-full px-3 py-1 text-xs font-semibold bg-gray-600/20 text-gray-400 border border-gray-500/30';

                        const chipLabel = isTraining
                          ? status === 'no'
                            ? 'ABWESEND'
                            : 'DABEI'
                          : status === 'yes'
                            ? 'DABEI'
                            : status === 'no'
                              ? 'ABWESEND'
                              : 'OFFEN';
                        return (
                          <li
                            key={player.id}
                            className="flex flex-col gap-2 border-b border-white/10 py-3 last:border-b-0"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="block font-medium text-[var(--text-main)]">{player.display_name}</span>
                              {isTraining && status === 'no' && eventAttendanceReasonByPlayerId[(player.id ?? '').toLowerCase()] ? (
                                <span className="text-xs text-[var(--text-sub)]">
                                  Grund: {eventAttendanceReasonByPlayerId[(player.id ?? '').toLowerCase()]}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={chipClass}>{chipLabel}</span>
                              {isTraining ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={!trainingCancellationAllowed || status === 'no'}
                                    onClick={() => handleTrainerRsvp(player.id, 'no')}
                                    className={`rounded px-2 py-1 text-xs font-medium ${
                                      !trainingCancellationAllowed || status === 'no'
                                        ? 'bg-gray-600/40 text-gray-300 cursor-not-allowed'
                                        : 'bg-red-600/80 text-white hover:bg-red-500'
                                    }`}
                                  >
                                    {status === 'no' ? 'Abwesend' : !trainingCancellationAllowed ? 'Zu spät' : 'Absagen'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={status !== 'no'}
                                    onClick={() => handleTrainerRsvp(player.id, 'yes')}
                                    className="rounded px-2 py-1 text-xs font-medium bg-green-600/80 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Dabei
                                  </button>
                                </>
                              ) : (
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
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : (effectiveRole === 'player' || effectiveRole === 'parent') ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-[var(--text-sub)]">Dein Teilnahme-Status für diesen Termin.</p>
                {!playerId ? (
                  <p className="text-sm text-[var(--text-main)]">Kein Spieler zugeordnet. Bitte beim Trainer melden.</p>
                ) : loadingRsvp ? (
                  <p className="text-sm text-[var(--text-sub)]">Lade Status…</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {isTraining ? (
                      <>
                        <p className="text-sm font-medium text-[var(--text-main)]">
                          Status: {rsvpStatus === 'no' ? 'Abwesend' : 'Dabei'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-sub)]">
                          {event.training_absence_deadline_disabled
                            ? 'Absage jederzeit möglich.'
                            : 'Absage bis 12:00 Uhr am Trainingstag möglich (Europe/Vienna).'}
                        </p>
                        {!trainingCancellationAllowed && rsvpStatus !== 'no' ? (
                          <p className="mt-1 text-xs text-amber-200/90">Absagefrist ist vorbei – Teilnahme gilt als „Dabei“.</p>
                        ) : null}
                        <Button
                          variant={rsvpStatus === 'no' ? 'secondary' : 'primary'}
                          size="sm"
                          disabled={rsvpStatus === 'no' || !trainingCancellationAllowed}
                          className={`mt-3 ${
                            rsvpStatus === 'no'
                              ? 'bg-red-600/40 text-white/80 hover:bg-red-600/40 cursor-not-allowed'
                              : !trainingCancellationAllowed
                                ? 'bg-gray-600/40 text-gray-300 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-500'
                          }`}
                          onClick={() => { setCancelReason(''); setAttendanceModalOpen(true); }}
                        >
                          {rsvpStatus === 'no' ? 'Abwesend' : trainingCancellationAllowed ? 'Absagen' : 'Zu spät'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-[var(--text-main)]">
                          Status: {rsvpStatus === 'yes' ? 'Zugesagt' : rsvpStatus === 'no' ? 'Abgesagt' : 'Offen'}
                        </p>
                        <Button
                          variant={rsvpStatus === 'yes' || rsvpStatus === 'no' ? 'primary' : 'secondary'}
                          size="sm"
                          className={`${
                            rsvpStatus === 'yes' ? 'bg-green-600 hover:bg-green-500' : rsvpStatus === 'no' ? 'bg-red-600 hover:bg-red-500' : ''
                          }`}
                          onClick={() => { setCancelReason(''); setAttendanceModalOpen(true); }}
                        >
                          {rsvpStatus === 'yes' ? 'Zugesagt' : rsvpStatus === 'no' ? 'Abgesagt' : 'Zu-/Absage'}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        )}

        {event.kind === 'match' && event.match_id && isTrainerOrAdmin && (
          <EventMatchSetupBlock matchId={event.match_id} players={players} />
        )}

        <Modal
          isOpen={attendanceModalOpen}
          title={isTraining ? 'Absage (Training)' : 'Zu-/Absage'}
          onClose={() => {
            setAttendanceModalOpen(false);
            setCancelReason('');
          }}
          footer={
            <Button
              variant="ghost"
              onClick={() => {
                setAttendanceModalOpen(false);
                setCancelReason('');
              }}
            >
              Schließen
            </Button>
          }
        >
          {isTraining ? (
            <>
              <p className="text-sm text-[var(--text-sub)] mb-4">
                Standard ist „Dabei“. Nur Absagen werden gespeichert.{' '}
                {event?.training_absence_deadline_disabled
                  ? 'Absage jederzeit möglich.'
                  : 'Absage bis 12:00 Uhr am Trainingstag möglich (Europe/Vienna).'}
              </p>
              <div>
                <label className="block text-sm font-medium text-[var(--text-main)] mb-1">
                  Grund (optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(ev) => setCancelReason(ev.target.value)}
                  className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
                  placeholder="z. B. Krankheit, keine Zeit, etc."
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  className="bg-red-600 hover:bg-red-500"
                  disabled={!trainingCancellationAllowed || rsvpStatus === 'no'}
                  onClick={() => handleRsvp('no', cancelReason)}
                >
                  Absagen
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--text-sub)] mb-4">
                Standard ist „Offen“, bis du zusagst oder absagst.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  className="bg-green-600 hover:bg-green-500"
                  onClick={() => {
                    console.log('[ATTENDANCE BUTTON CLICKED]', 'yes');
                    handleRsvp('yes');
                  }}
                >
                  Zusage
                </Button>
                <Button
                  variant="primary"
                  className="bg-red-600 hover:bg-red-500"
                  onClick={() => {
                    console.log('[ATTENDANCE BUTTON CLICKED]', 'no');
                    handleRsvp('no');
                  }}
                >
                  Absage
                </Button>
              </div>
            </>
          )}
        </Modal>

        {isFan && (
          <p className="text-center text-sm text-white/70">
            Nur Matchinformationen. Zu-/Absage steht nur Spielern, Eltern und Trainern zur Verfügung.
          </p>
        )}

        <div className="mb-24 mt-2 flex w-full flex-col rounded-2xl border border-red-500 bg-neutral-900 p-4 text-white">
          <div className="text-lg font-bold">MATCH SETUP DEBUG</div>
          <div className="mt-2 text-sm text-neutral-300">Dieser Block muss sichtbar sein.</div>
          <button type="button" className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white">
            Live starten
          </button>
        </div>
      </div>
    </div>
  );
};
