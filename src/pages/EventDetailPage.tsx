import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
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
import { MatchPlayerRow } from '../components/match/MatchPlayerRow';
import { AppButton } from '../components/ui/AppButton';
import type { EventRow, EventKind, EventStatus } from '../hooks/useEvents';
import type { PlayerItem } from '../hooks/usePlayers';
import { generateEventIcs } from '../lib/ics';
import { isTrainingAbsenceDeadlinePassed } from '../lib/trainingAbsence';
import { upsertEventAttendanceMinimal } from '../lib/rsvp/writeEventAttendance';
import { upsertMatchForSetup } from '../lib/liveMatchService';
import {
  MATCH_FEED_TEMPLATE_KEYS,
  MATCH_FEED_TEMPLATE_LABELS,
  normalizeMatchFeedTemplateKey,
  type MatchFeedTemplateKey,
} from '../features/home/feedTemplates';
import { combineLocationParts, splitCombinedLocation } from '../lib/eventLocation';
import {
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  utcIsoToViennaDateTimeLocal,
  utcIsoToViennaTimeHHmm,
} from '../lib/viennaTime';

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type EventDbRow = {
  id: string;
  team_season_id: string;
  kind: string;
  type?: string | null;
  match_type?: string | null;
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
  'id, team_season_id, kind, type, match_type, opponent, is_home, location, starts_at, meeting_at, status, attendance_mode, notes, match_id, created_by, created_at, updated_at';

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
    match_type: (() => {
      const s = String(r.match_type ?? '').trim();
      return s === '' ? null : s;
    })(),
    opponent: r.opponent ?? null,
    is_home: r.is_home ?? null,
    location: r.location ?? null,
    starts_at: r.starts_at,
    meeting_at: r.meeting_at ?? null,
    status: normalizeEventStatus(r.status),
    attendance_mode: (r.attendance_mode === 'opt_out' ? 'opt_out' : 'opt_in') as 'opt_in' | 'opt_out',
    notes: r.notes ?? null,
    match_id: r.match_id ?? null,
    training_absence_deadline_disabled: null,
    created_by: r.created_by ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

/** Sortierung für Trainerliste: Dabei/Zugesagt → Offen → Abgesagt/Abwesend, danach alphabetisch. */
function sortPlayersByAttendanceStatus(
  players: PlayerItem[],
  getStatus: (playerId: string) => 'yes' | 'no' | null,
): PlayerItem[] {
  const rank = (s: 'yes' | 'no' | 'open') => (s === 'yes' ? 0 : s === 'open' ? 1 : 2);
  const nameOf = (p: PlayerItem) => (p.display_name ?? p.name ?? '').trim().toLocaleLowerCase('de-AT');
  return [...players].sort((a, b) => {
    const sa = getStatus(a.id) ?? 'open';
    const sb = getStatus(b.id) ?? 'open';
    const byStatus = rank(sa) - rank(sb);
    if (byStatus !== 0) return byStatus;
    return nameOf(a).localeCompare(nameOf(b), 'de-AT');
  });
}

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRow | null>(null);
  const [editOpponent, setEditOpponent] = useState('');
  const [editDateTime, setEditDateTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLocationAddress, setEditLocationAddress] = useState('');
  const [editMeetupAt, setEditMeetupAt] = useState('');
  const [editTrainingDeadlineDisabled, setEditTrainingDeadlineDisabled] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [calendarActionError, setCalendarActionError] = useState<string | null>(null);

  const [rsvpStatus, setRsvpStatus] = useState<'yes' | 'no' | null>(null);
  const [loadingRsvp, setLoadingRsvp] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  /** Für Trainer: alle Zu-/Absagen dieses Events aus event_attendance. */
  const [eventAttendanceByPlayerId, setEventAttendanceByPlayerId] = useState<Record<string, 'yes' | 'no'>>({});
  const [eventAttendanceReasonByPlayerId, setEventAttendanceReasonByPlayerId] = useState<Record<string, string | null>>({});
  const [loadingEventAttendance, setLoadingEventAttendance] = useState(false);
  /** Spiel-Termine ohne events.match_id: einmalig Match-Zeile anlegen und verknüpfen (RLS: matches_insert). */
  const [matchLinkBusy, setMatchLinkBusy] = useState(false);
  const [matchLinkError, setMatchLinkError] = useState<string | null>(null);

  const [feedLoading, setFeedLoading] = useState(false);
  const [feedSaving, setFeedSaving] = useState(false);
  const [showInFeed, setShowInFeed] = useState(false);
  const [template, setTemplate] = useState<MatchFeedTemplateKey>('spieltag_clean');
  const [playerImage, setPlayerImage] = useState('');
  const [opponentLogo, setOpponentLogo] = useState('');
  const [title, setTitle] = useState('');
  const [subline, setSubline] = useState('');
  const [feedSectionExpanded, setFeedSectionExpanded] = useState(false);

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

  const handleAddSingleEventToCalendar = useCallback(async () => {
    if (!event) return;

    try {
      const ics = generateEventIcs(event as any, { appBaseUrl: window.location.origin });
      downloadTextFile('spielzeitapp-termin.ics', ics, 'text/calendar;charset=utf-8');
    } catch (err) {
      console.error('[EventDetail] single event ICS failed', err);
      alert(
        'Kalender-Fehler: ' +
          ((err as { message?: string })?.message ?? String(err)),
      );
      setCalendarActionError('Kalenderdatei konnte nicht erstellt werden.');
    }
  }, [event]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const loadFeedFromEvent = useCallback(async () => {
    if (!eventId) return;
    setFeedLoading(true);
    const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
    setFeedLoading(false);
    if (error) {
      console.error('[EventDetailPage] feed load events', error);
      return;
    }
    if (!data) return;
    const d = data as Record<string, unknown>;
    setShowInFeed(Boolean(d.show_in_feed));
    setTemplate(normalizeMatchFeedTemplateKey(String(d.feed_template ?? '')));
    setPlayerImage(d.player_image_url != null ? String(d.player_image_url) : '');
    setOpponentLogo(d.opponent_logo_url != null ? String(d.opponent_logo_url) : '');
    setTitle(d.feed_title != null ? String(d.feed_title) : '');
    setSubline(d.feed_subline != null ? String(d.feed_subline) : '');
  }, [eventId]);

  useEffect(() => {
    if (!eventId || event?.kind !== 'match') return;
    void loadFeedFromEvent();
  }, [eventId, event?.kind, loadFeedFromEvent]);

  useEffect(() => {
    if (!event || event.kind !== 'match' || !isTrainerOrAdmin || event.match_id) {
      setMatchLinkBusy(false);
      setMatchLinkError(null);
      return;
    }
    const ts = event.team_season_id;
    if (!ts) return;

    let cancelled = false;
    setMatchLinkBusy(true);
    setMatchLinkError(null);

    const evId = event.id;
    (async () => {
      const starts = new Date(event.starts_at);
      if (Number.isNaN(starts.getTime())) {
        if (!cancelled) {
          setMatchLinkError('Ungültiges Spiel-Datum.');
          setMatchLinkBusy(false);
        }
        return;
      }
      const y = starts.getFullYear();
      const mo = String(starts.getMonth() + 1).padStart(2, '0');
      const da = String(starts.getDate()).padStart(2, '0');
      const matchDate = `${y}-${mo}-${da}`;
      const hh = String(starts.getHours()).padStart(2, '0');
      const mi = String(starts.getMinutes()).padStart(2, '0');
      const matchTime = `${hh}:${mi}`;

      const { matchId, error: createErr } = await upsertMatchForSetup({
        matchId: null,
        teamSeasonId: ts,
        opponent: event.opponent ?? '',
        matchDate,
        matchTime,
        locationNote: event.location ?? '',
      });
      if (cancelled) return;
      if (createErr || !matchId) {
        setMatchLinkError(createErr ?? 'Spiel konnte nicht angelegt werden.');
        setMatchLinkBusy(false);
        return;
      }
      const { error: linkErr } = await supabase.from('events').update({ match_id: matchId }).eq('id', evId);
      if (cancelled) return;
      if (linkErr) {
        setMatchLinkError(linkErr.message);
        setMatchLinkBusy(false);
        return;
      }
      setEvent((prev) => (prev && prev.id === evId ? { ...prev, match_id: matchId } : prev));
      setMatchLinkBusy(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    event?.id,
    event?.kind,
    event?.match_id,
    event?.team_season_id,
    event?.starts_at,
    event?.opponent,
    event?.location,
    isTrainerOrAdmin,
  ]);

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

  const saveFeedSettings = useCallback(async () => {
    if (!eventId || !isTrainerOrAdmin || event?.kind !== 'match') return;
    setFeedSaving(true);
    const { error } = await supabase
      .from('events')
      .update({
        show_in_feed: showInFeed,
        feed_template: template,
        player_image_url: playerImage.trim() === '' ? null : playerImage.trim(),
        opponent_logo_url: opponentLogo.trim() === '' ? null : opponentLogo.trim(),
        feed_title: title.trim() === '' ? null : title.trim(),
        feed_subline: subline.trim() === '' ? null : subline.trim(),
      })
      .eq('id', eventId);
    setFeedSaving(false);
    if (error) {
      console.error('[EventDetailPage] feed save events', error);
      return;
    }
    await loadFeedFromEvent();
  }, [
    eventId,
    event?.kind,
    isTrainerOrAdmin,
    showInFeed,
    template,
    playerImage,
    opponentLogo,
    title,
    subline,
    loadFeedFromEvent,
  ]);

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

      if (event?.kind === 'training' && status === 'yes') {
        const del = await supabase
          .from('event_attendance')
          .delete()
          .eq('event_id', eventId)
          .eq('player_id', resolvedPlayerId);
        if (del.error) return;
        setRsvpStatus('yes');
        setEventAttendanceByPlayerId((prev) => {
          const next = { ...prev };
          delete next[(resolvedPlayerId ?? '').toLowerCase()];
          return next;
        });
        setAttendanceModalOpen(false);
        setCancelReason('');
        await loadEventAttendance();
        return;
      }

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

  const openEditModal = useCallback((e: EventRow) => {
    const parsedLocation = splitCombinedLocation(e.location ?? '');
    setEditEvent(e);
    setEditOpponent(e.opponent ?? '');
    setEditDateTime(utcIsoToViennaDateTimeLocal(e.starts_at));
    setEditLocation(parsedLocation.place);
    setEditLocationAddress(parsedLocation.address);
    setEditMeetupAt(utcIsoToViennaTimeHHmm(e.meeting_at ?? ''));
    setEditTrainingDeadlineDisabled(e.training_absence_deadline_disabled ?? false);
    setEditError(null);
    setEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditEvent(null);
    setEditOpponent('');
    setEditDateTime('');
    setEditLocation('');
    setEditLocationAddress('');
    setEditMeetupAt('');
    setEditError(null);
  }, []);

  const handleEditSubmit = useCallback(async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editEvent) return;
    const startsAt = parseViennaDateTimeLocalToUtcIso((editDateTime ?? '').trim());
    if (!startsAt) {
      setEditError('Ungültiges Datumsformat.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    const locationVal = combineLocationParts(editLocation, editLocationAddress);
    const meetupRaw = (editMeetupAt ?? '').trim();
    const meetingAt = meetupRaw ? meetupUtcIsoOnViennaEventDay(startsAt, meetupRaw) : null;

    const payload: Record<string, unknown> = {
      starts_at: startsAt,
      meeting_at: meetingAt,
      location: locationVal,
      opponent: (editOpponent ?? '').trim() || null,
    };
    if (editEvent.kind === 'training') {
      payload.training_absence_deadline_disabled = editTrainingDeadlineDisabled;
    }
    let error: { message?: string } | null = null;
    const firstTry = await supabase.from('events').update(payload).eq('id', editEvent.id);
    error = firstTry.error;

    // Fallback: Manche Deployments haben die Spalte noch nicht im Schema-Cache.
    // Dann speichern wir ohne dieses Feld, statt den gesamten Save zu blockieren.
    if (
      error &&
      editEvent.kind === 'training' &&
      String(error.message ?? '').includes('training_absence_deadline_disabled')
    ) {
      const { training_absence_deadline_disabled: _ignored, ...payloadWithoutTrainingFlag } = payload as Record<
        string,
        unknown
      >;
      const retry = await supabase.from('events').update(payloadWithoutTrainingFlag).eq('id', editEvent.id);
      error = retry.error;
    }

    if (error) {
      setEditError(error.message ?? 'Speichern fehlgeschlagen.');
      setSavingEdit(false);
      return;
    }
    setSavingEdit(false);
    closeEditModal();
    await loadEvent();
  }, [editEvent, editDateTime, editLocation, editLocationAddress, editMeetupAt, editOpponent, editTrainingDeadlineDisabled, closeEditModal, loadEvent]);

  const handleDeleteEvent = useCallback(async () => {
    if (!eventId || !isTrainerOrAdmin || !event) return;
    setDeletingEvent(true);
    const matchIds = event.match_id ? [event.match_id] : [];
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      alert(error.message);
      setDeletingEvent(false);
      return;
    }
    for (const matchId of matchIds) {
      const { data: refs, error: refsErr } = await supabase
        .from('events')
        .select('id')
        .eq('match_id', matchId)
        .limit(1);
      if (refsErr) {
        alert(refsErr.message);
        setDeletingEvent(false);
        return;
      }
      if ((refs ?? []).length === 0) {
        const { error: delMatchErr } = await supabase.from('matches').delete().eq('id', matchId);
        if (delMatchErr) {
          alert(delMatchErr.message);
          setDeletingEvent(false);
          return;
        }
      }
    }
    setDeletingEvent(false);
    setDeleteConfirmOpen(false);
    navigate('/app/termine');
  }, [eventId, event, isTrainerOrAdmin, navigate]);

  if (!eventId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-4 pb-12 sm:px-4">
          <p>Keine Event-ID angegeben.</p>
          <Link to="/app/termine" className="text-[14px] text-white/90 hover:text-white">
            ← Zurück zum Spielplan
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-4 pb-12 sm:px-4">
          <p>Lade Termin…</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-4 pb-12 sm:px-4">
          <p>{error ?? 'Termin nicht gefunden.'}</p>
          <Link to="/app/termine" className="text-[14px] text-white/90 hover:text-white">
            ← Zurück zum Spielplan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-4 pb-28 sm:px-4">
        <div className="flex flex-col gap-3">
          <Link to="/app/termine" className="text-[14px] text-white/90 hover:text-white">
            ← Zurück zum Spielplan
          </Link>
          <AppButton
            variant="secondary"
            size="sm"
            className="w-full px-3 py-2 text-[13px] sm:w-auto sm:self-end"
            onClick={() => void handleAddSingleEventToCalendar()}
          >
            Zum Kalender hinzufügen
          </AppButton>
          {isTrainerOrAdmin ? (
            <div className="grid w-full grid-cols-2 gap-3">
              <AppButton
                variant="secondary"
                size="sm"
                className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[13px]"
                onClick={() => openEditModal(event)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Bearbeiten
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[13px]"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Löschen
              </AppButton>
            </div>
          ) : null}
        </div>

        <div className="-mx-3 flex w-[calc(100%+1.5rem)] min-w-0 max-w-none flex-col sm:mx-0 sm:w-full sm:max-w-full">
          <MatchCardLigaportal
            className="!overflow-visible w-full max-w-full rounded-2xl"
            compactDetailGame
            ourTeamName={ourTeamName}
            opponent={event.opponent}
            isHome={event.is_home}
            startsAt={event.starts_at}
            status={event.status}
            kind={event.kind}
            eventType={(event as any).type ?? undefined}
            matchType={
              event.kind === 'match'
                ? (event.match_type ??
                    (!event.type || event.type === 'game' ? 'league' : event.type))
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

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/80">
          <div className="grid gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Datum & Uhrzeit</p>
              <p className="mt-0.5 text-[14px] font-medium text-white/90">{formatEventDateTimeLabel(event.starts_at)}</p>
            </div>
            {(() => {
              const parsedLoc = splitCombinedLocation(event.location ?? '');
              const place = (parsedLoc.place ?? '').trim();
              const address = (parsedLoc.address ?? '').trim();
              return (
                <>
                  {place ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Spielort / Platzname</p>
                      <p className="mt-0.5 text-[14px] font-medium text-white/90 break-words">{place}</p>
                    </div>
                  ) : null}
                  {address ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Adresse / PLZ / Ort</p>
                      <p className="mt-0.5 text-[14px] font-medium text-white/90 break-words">{address}</p>
                    </div>
                  ) : null}
                </>
              );
            })()}
            {event.meeting_at ? (
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Treffpunkt</p>
                <p className="mt-0.5 text-[14px] font-medium text-white/90">
                  {utcIsoToViennaTimeHHmm(event.meeting_at)} Uhr
                </p>
              </div>
            ) : null}
          </div>
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
                    <span className="rounded-full px-3 py-1 text-sm font-semibold bg-white/10 text-white/70 border border-white/25">
                      Offen: {Math.max(0, players.length - Object.keys(eventAttendanceByPlayerId).length)}
                    </span>
                  </div>
                )}
                {event.kind === 'match' && event.match_id ? (
                  <Button
                    type="button"
                    variant="primary"
                    className="mb-4 w-full py-3"
                    onClick={() => navigate(`/app/match-preparation?matchId=${encodeURIComponent(event.match_id)}`)}
                  >
                    Match vorbereiten
                  </Button>
                ) : null}
                <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                  {(playersLoading || loadingEventAttendance) && (
                    <p className="text-[14px] text-white/70">Lade…</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length === 0 && (
                    <p className="text-[14px] text-white/70">Keine Spieler im Kader.</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length > 0 && (
                    <ul className="flex flex-col gap-0 space-y-4">
                      {sortPlayersByAttendanceStatus(players, getAttendanceStatus).map((player, idx, arr) => {
                        const status = getAttendanceStatus(player.id);
                        const groupTitle = status === 'yes' ? 'Dabei' : status === 'no' ? 'Abgesagt' : 'Offen';
                        const prev = idx > 0 ? getAttendanceStatus(arr[idx - 1].id) : null;
                        const prevGroupTitle = prev === 'yes' ? 'Dabei' : prev === 'no' ? 'Abgesagt' : 'Offen';
                        const showGroupHeading = idx === 0 || groupTitle !== prevGroupTitle;
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
                          <li key={player.id} className="flex flex-col gap-2 py-1">
                            {showGroupHeading ? (
                              <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/60">
                                {groupTitle}
                              </p>
                            ) : null}
                            <MatchPlayerRow
                              player={player}
                              status={status ?? "open"}
                              rightLabel={chipLabel}
                            />
                            <div className="mt-2 min-w-0 pl-1">
                            <div className="flex flex-wrap items-center gap-2">
                                {isTraining ? (
                                  <>
                                    <AppButton
                                      type="button"
                                      size="sm"
                                      variant={!trainingCancellationAllowed || status === 'no' ? 'secondary' : 'danger'}
                                      disabled={!trainingCancellationAllowed || status === 'no'}
                                      onClick={() => handleTrainerRsvp(player.id, 'no')}
                                      className="px-3 py-1.5 text-[13px]"
                                    >
                                      {status === 'no' ? 'Abwesend' : !trainingCancellationAllowed ? 'Zu spät' : 'Absagen'}
                                    </AppButton>
                                    <AppButton
                                      type="button"
                                      size="sm"
                                      variant="success"
                                      disabled={status !== 'no'}
                                      onClick={() => handleTrainerRsvp(player.id, 'yes')}
                                      className="px-3 py-1.5 text-[13px]"
                                    >
                                      Dabei
                                    </AppButton>
                                  </>
                                ) : (
                                  <div className="flex gap-2">
                                    <AppButton
                                      type="button"
                                      size="sm"
                                      variant="success"
                                      onClick={() => handleTrainerRsvp(player.id, 'yes')}
                                      className="px-3 py-1.5 text-[13px]"
                                    >
                                      Dabei
                                    </AppButton>
                                    <AppButton
                                      type="button"
                                      size="sm"
                                      variant="danger"
                                      onClick={() => handleTrainerRsvp(player.id, 'no')}
                                      className="px-3 py-1.5 text-[13px]"
                                    >
                                      Abwesend
                                    </AppButton>
                                  </div>
                                )}
                              </div>
                              {isTraining && status === 'no' && eventAttendanceReasonByPlayerId[(player.id ?? '').toLowerCase()] ? (
                                <span className="mt-1 block text-[12px] text-white/70">
                                  Grund: {eventAttendanceReasonByPlayerId[(player.id ?? '').toLowerCase()]}
                                </span>
                              ) : null}
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
                <p className="text-[14px] text-white/70">Dein Teilnahme-Status für diesen Termin.</p>
                {!playerId ? (
                  <p className="text-[14px] text-white/90">Kein Spieler zugeordnet. Bitte beim Trainer melden.</p>
                ) : loadingRsvp ? (
                  <p className="text-[14px] text-white/70">Lade Status…</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {isTraining ? (
                      <>
                        <p className="text-[14px] font-medium text-white/90">Status: {rsvpStatus === 'no' ? 'Abwesend' : 'Dabei'}</p>
                        <p className="mt-1 text-[12px] text-white/70">
                          {event.training_absence_deadline_disabled
                            ? 'Absage jederzeit möglich.'
                            : 'Absage bis 12:00 Uhr am Trainingstag möglich (Europe/Vienna).'}
                        </p>
                        {!trainingCancellationAllowed && rsvpStatus !== 'no' ? (
                          <p className="mt-1 text-[12px] text-amber-200/90">Absagefrist ist vorbei – Teilnahme gilt als „Dabei“.</p>
                        ) : null}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <AppButton
                            type="button"
                            variant="success"
                            size="sm"
                            className={`h-11 w-full gap-2 ${
                              rsvpStatus !== 'no'
                                ? 'border border-emerald-400/45 shadow-[0_0_16px_rgba(16,185,129,0.32)]'
                                : 'border border-white/10'
                            }`}
                            onClick={() => void handleRsvp('yes')}
                          >
                            <ThumbsUp className="h-4 w-4" aria-hidden />
                            Dabei
                          </AppButton>
                          <AppButton
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={!trainingCancellationAllowed && rsvpStatus !== 'no'}
                            className={`h-11 w-full gap-2 ${
                              rsvpStatus === 'no'
                                ? 'border border-red-400/45 shadow-[0_0_16px_rgba(239,68,68,0.28)]'
                                : 'border border-white/10'
                            } ${!trainingCancellationAllowed && rsvpStatus !== 'no' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            onClick={() => {
                              if (!trainingCancellationAllowed && rsvpStatus !== 'no') return;
                              void handleRsvp('no');
                            }}
                          >
                            <ThumbsDown className="h-4 w-4" aria-hidden />
                            Absagen
                          </AppButton>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-[14px] text-white/90">
                          Status: {rsvpStatus === 'yes' ? 'Zugesagt' : rsvpStatus === 'no' ? 'Abgesagt' : 'Offen'}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <AppButton
                            type="button"
                            variant="success"
                            size="sm"
                            className={`h-11 w-full gap-2 ${
                              rsvpStatus === 'yes'
                                ? 'border border-emerald-400/45 shadow-[0_0_16px_rgba(16,185,129,0.32)]'
                                : 'border border-white/10'
                            }`}
                            onClick={() => void handleRsvp('yes')}
                          >
                            <ThumbsUp className="h-4 w-4" aria-hidden />
                            Zusage
                          </AppButton>
                          <AppButton
                            type="button"
                            variant="danger"
                            size="sm"
                            className={`h-11 w-full gap-2 ${
                              rsvpStatus === 'no'
                                ? 'border border-red-400/45 shadow-[0_0_16px_rgba(239,68,68,0.28)]'
                                : 'border border-white/10'
                            }`}
                            onClick={() => void handleRsvp('no')}
                          >
                            <ThumbsDown className="h-4 w-4" aria-hidden />
                            Absage
                          </AppButton>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        )}

        {event.kind === 'match' && event.status === 'live' && event.match_id ? (
          <Card className="flex flex-col gap-3">
            <CardTitle>Liveticker</CardTitle>
            <p className="text-[14px] text-white/75">
              Aufstellung, Spielstand und Ereignisse findest du im zentralen Liveticker unter „Live“.
            </p>
            <Link
              to={`/app/live?matchId=${encodeURIComponent(event.match_id)}`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-red-600 px-4 text-center text-sm font-bold text-white hover:bg-red-500"
            >
              Zum Liveticker
            </Link>
          </Card>
        ) : null}

        {event.kind === 'match' && isTrainerOrAdmin && (
          <Card className="mt-6 flex flex-col gap-2 overflow-hidden">
            <button
              type="button"
              onClick={() => setFeedSectionExpanded((v) => !v)}
              aria-expanded={feedSectionExpanded}
              className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07] active:bg-white/[0.05]"
            >
              <span className="text-[17px] font-semibold text-white">Feed / Spieltag (optional)</span>
              <span className="shrink-0 text-[14px] text-white/60" aria-hidden>
                {feedSectionExpanded ? '▾' : '▸'}
              </span>
            </button>
            {feedSectionExpanded ? (
              <div className="flex flex-col gap-3 pt-1">
                <p className="text-[14px] leading-snug text-white/75">
                  Wenn dieses Spiel auf der Startseite als nächstes Match erscheint, kann die große Hero-Karte hier
                  vorbereitet werden (nur URL-Eingaben, kein Upload).
                </p>
                {feedLoading ? <p className="text-[14px] text-white/70">Lade Feed-Einstellungen…</p> : null}
                <label className="flex cursor-pointer items-center gap-2 text-[14px] text-white/90">
                  <input
                    type="checkbox"
                    checked={showInFeed}
                    onChange={(e) => setShowInFeed(e.target.checked)}
                    className="h-4 w-4 rounded border border-white/25 bg-black/30"
                  />
                  Im Home Feed anzeigen
                </label>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-white/60">Template</label>
                  <select
                    value={template}
                    onChange={(e) => setTemplate(normalizeMatchFeedTemplateKey(e.target.value))}
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                  >
                    {MATCH_FEED_TEMPLATE_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {MATCH_FEED_TEMPLATE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-white/60">Spielerbild URL (optional)</label>
                  <input
                    type="url"
                    value={playerImage}
                    onChange={(e) => setPlayerImage(e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-white/60">Gegnerlogo URL (optional)</label>
                  <input
                    type="url"
                    value={opponentLogo}
                    onChange={(e) => setOpponentLogo(e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-sub)]">Überschrift (optional)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Leer = Standard (z. B. SPIELTAG)"
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-white/60">Subline (optional)</label>
                  <input
                    type="text"
                    value={subline}
                    onChange={(e) => setSubline(e.target.value)}
                    placeholder="Leer = z. B. Gegen …"
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                  />
                </div>
                <Button variant="primary" size="sm" onClick={() => void saveFeedSettings()}>
                  {feedSaving ? 'Speichern…' : 'Feed-Einstellungen speichern'}
                </Button>
              </div>
            ) : null}
          </Card>
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
              variant="soft"
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
              <p className="mb-4 text-[14px] text-white/75">
                Standard ist „Dabei“. Nur Absagen werden gespeichert.{' '}
                {event?.training_absence_deadline_disabled
                  ? 'Absage jederzeit möglich.'
                  : 'Absage bis 12:00 Uhr am Trainingstag möglich (Europe/Vienna).'}
              </p>
              <div>
                <label className="mb-1 block text-[14px] font-medium text-white/90">
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
                  variant="negative"
                  disabled={!trainingCancellationAllowed || rsvpStatus === 'no'}
                  onClick={() => handleRsvp('no', cancelReason)}
                >
                  Absagen
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-[14px] text-white/75">
                Standard ist „Offen“, bis du zusagst oder absagst.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="positive"
                  onClick={() => {
                    console.log('[ATTENDANCE BUTTON CLICKED]', 'yes');
                    handleRsvp('yes');
                  }}
                >
                  Zusage
                </Button>
                <Button
                  variant="negative"
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
        <Modal
          isOpen={Boolean(calendarActionError)}
          title="Kalenderaktion"
          onClose={() => setCalendarActionError(null)}
          footer={
            <Button variant="soft" onClick={() => setCalendarActionError(null)}>
              OK
            </Button>
          }
        >
          <p className="text-[14px] text-white/75">{calendarActionError}</p>
        </Modal>
        <Modal
          isOpen={deleteConfirmOpen}
          title="Termin löschen?"
          onClose={() => {
            if (!deletingEvent) setDeleteConfirmOpen(false);
          }}
          footer={
            <div className="flex justify-end gap-2">
              <AppButton
                variant="secondary"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deletingEvent}
              >
                Abbrechen
              </AppButton>
              <AppButton
                variant="danger"
                onClick={() => void handleDeleteEvent()}
                disabled={deletingEvent}
              >
                Termin löschen
              </AppButton>
            </div>
          }
        >
          <p className="text-[14px] text-white/75">
            Dieser Termin wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
        </Modal>
        <Modal
          isOpen={editModalOpen}
          title="Termin bearbeiten"
          onClose={closeEditModal}
          footer={
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={closeEditModal}>
                Abbrechen
              </AppButton>
              <AppButton type="submit" form="event-detail-edit-form" variant="primary" disabled={savingEdit}>
                {savingEdit ? 'Speichern…' : 'Speichern'}
              </AppButton>
            </div>
          }
        >
          <form id="event-detail-edit-form" onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label htmlFor="event-detail-edit-opponent" className="mb-1 block text-sm font-medium text-[var(--text-main)]">
                Gegner / Bezeichnung
              </label>
              <input
                id="event-detail-edit-opponent"
                type="text"
                value={editOpponent}
                onChange={(e) => setEditOpponent(e.target.value)}
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[var(--text-main)]"
              />
            </div>
            <div>
              <label htmlFor="event-detail-edit-datetime" className="mb-1 block text-sm font-medium text-[var(--text-main)]">
                Beginn *
              </label>
              <input
                id="event-detail-edit-datetime"
                type="datetime-local"
                required
                value={editDateTime}
                onChange={(e) => setEditDateTime(e.target.value)}
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[var(--text-main)]"
              />
            </div>
            <div>
              <label htmlFor="event-detail-edit-location" className="mb-1 block text-sm font-medium text-[var(--text-main)]">
                Platzname / Ort (optional)
              </label>
              <input
                id="event-detail-edit-location"
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[var(--text-main)]"
                placeholder="z. B. Sportplatz Rohrbach"
              />
            </div>
            <div>
              <label htmlFor="event-detail-edit-location-address" className="mb-1 block text-sm font-medium text-[var(--text-main)]">
                Adresse / PLZ / Ort (optional)
              </label>
              <input
                id="event-detail-edit-location-address"
                type="text"
                value={editLocationAddress}
                onChange={(e) => setEditLocationAddress(e.target.value)}
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[var(--text-main)]"
              />
            </div>
            <div>
              <label htmlFor="event-detail-edit-meetup" className="mb-1 block text-sm font-medium text-[var(--text-main)]">
                Treffpunkt (optional)
              </label>
              <input
                id="event-detail-edit-meetup"
                type="time"
                value={editMeetupAt}
                onChange={(e) => setEditMeetupAt(e.target.value)}
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[var(--text-main)]"
              />
            </div>
            {editEvent?.kind === 'training' ? (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--text-main)]">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-[var(--glass-border)]"
                  checked={editTrainingDeadlineDisabled}
                  onChange={(e) => setEditTrainingDeadlineDisabled(e.target.checked)}
                />
                <span>
                  Keine Absagefrist (Absage jederzeit möglich). Wenn nicht angehakt: Absage bis 12:00 Uhr am Trainingstag (Europe/Vienna).
                </span>
              </label>
            ) : null}
            {editError ? (
              <p className="text-sm text-red-600" role="alert">
                {editError}
              </p>
            ) : null}
          </form>
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
