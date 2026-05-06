import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { CalendarDays, CalendarPlus, Pencil, Radio, Trash2 } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import { AppButton } from '../components/ui/AppButton';
import { CreateEventModal } from '../app/components/CreateEventModal';
import { AttendanceStatusPill, type AttendanceStatusKind } from '../components/schedule/AttendanceStatusPill';
import { CompactListParentAttendance } from '../components/schedule/CompactListParentAttendance';
import { CompactEventCard } from '../components/schedule/CompactEventCard';
import { MatchCardLigaportal } from '../app/components/MatchCardLigaportal';
import { EventHeroCard } from '../components/schedule/EventHeroCard';
import { AttendanceActionRow } from '../components/schedule/AttendanceActionRow';
import { ScheduleHeroEventCard } from '../components/schedule/ScheduleHeroEventCard';
import { TrainerStatsMini } from '../components/schedule/TrainerStatsMini';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePublicTeamSeason } from '../hooks/usePublicTeamSeason';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { useEventsAttendance } from '../hooks/useEventsAttendance';
import { usePlayers } from '../hooks/usePlayers';
import { useAvailabilityPermissions } from '../hooks/useAvailabilityPermissions';
import { useSession, getTeamNameFromMembership, getSeasonLabelFromMembership } from '../auth/useSession';
import { normalizeRole, canManageMatches, canSeeMeetup } from '../lib/roles';
import { getOurTeamDisplayName } from '../lib/teamLogos';
import { supabase } from '../lib/supabaseClient';
import { downloadCalendarIcs, downloadEventIcs } from '../lib/ics';
import { isTrainingAbsenceDeadlinePassed } from '../lib/trainingAbsence';
import type { SeriesEditScope } from '../lib/seriesEditScope';
import {
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  utcIsoToViennaDateTimeLocal,
  utcIsoToViennaTimeHHmm,
} from '../lib/viennaTime';
import { formatDateTimeDeVienna } from '../lib/notifications/format';
import { upsertEventAttendanceMinimal } from '../lib/rsvp/writeEventAttendance';
import { combineLocationParts, splitCombinedLocation } from '../lib/eventLocation';

type KindFilterId = 'all' | 'match' | 'training' | 'event';
type TimeFilterId = 'upcoming' | 'past';

function getEventTab(e: EventRow): 'upcoming' | 'live' | 'finished' {
  const s = e.status ?? 'upcoming';
  if (s === 'live') return 'live';
  if (s === 'finished' || s === 'canceled') return 'finished';
  return 'upcoming';
}

function getEffectiveEventType(e: EventRow): 'game' | 'training' | 'event' | 'other' {
  const raw = ((e as any).type as string | undefined) ?? '';
  const t = raw.trim().toLowerCase();
  if (t === 'game' || t === 'training' || t === 'event' || t === 'other') return t;
  if (e.kind === 'training') return 'training';
  if (e.kind === 'event') return 'event';
  return 'game';
}

function getTimeBucket(e: EventRow, now: Date): TimeFilterId {
  const status = e.status ?? 'upcoming';
  if (status === 'finished' || status === 'canceled') return 'past';
  const starts = e.starts_at ? new Date(e.starts_at) : null;
  if (starts && starts.getTime() < now.getTime()) return 'past';
  return 'upcoming';
}

function heroLabelForEffectiveType(et: 'game' | 'training' | 'event' | 'other'): string {
  if (et === 'game') return 'Nächstes Spiel';
  if (et === 'training') return 'Nächstes Training';
  return 'Nächster Termin';
}

function attendanceMergedToPillStatus(s: 'yes' | 'no' | null | undefined): AttendanceStatusKind {
  if (s === 'yes') return 'yes';
  if (s === 'no') return 'no';
  return 'open';
}

/** Titel-Zeile in notes (Training/Event) wie CreateEventModal: erster Teil vor „ · “. */
function mergeTitleIntoNotes(existingNotes: string | null | undefined, newTitle: string): string | null {
  const title = newTitle.trim();
  const raw = (existingNotes ?? '').trim();
  if (!raw) return title || null;
  const parts = raw.split(' · ');
  const rest = parts.slice(1).filter(Boolean);
  if (!title && rest.length === 0) return null;
  if (!title) return rest.join(' · ');
  return rest.length ? `${title} · ${rest.join(' · ')}` : title;
}

function ScheduleHeroToolbarAction({
  label,
  title,
  onClick,
  children,
  className = '',
  emphasis = 'secondary',
  compact = false,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  emphasis?: 'primary' | 'secondary' | 'danger';
  /** Nächstes-Spiel-Hero: niedrigere Toolbar-Höhe */
  compact?: boolean;
}) {
  const tone =
    emphasis === 'primary'
      ? 'border-red-500/50 bg-red-600/95 text-white shadow-lg shadow-red-950/40 backdrop-blur-sm hover:border-red-400/70 hover:bg-red-500'
      : emphasis === 'danger'
        ? 'border-red-500/35 bg-red-950/55 text-red-100 shadow-sm backdrop-blur-sm hover:border-red-400/45 hover:bg-red-900/65 hover:text-white'
        : 'border-white/12 bg-black/45 text-white/75 shadow-sm backdrop-blur-sm hover:border-white/22 hover:bg-white/[0.08] hover:text-white/90';
  const sizeClass = compact
    ? 'h-9 min-h-9 gap-1 px-2 text-[11px] sm:text-[11px]'
    : 'h-10 min-h-[2.5rem] gap-1.5 px-2 text-[10px] sm:text-[11px]';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`inline-flex w-full min-w-0 shrink-0 items-center justify-center rounded-xl border font-semibold transition ${sizeClass} ${tone} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className="flex shrink-0 items-center opacity-90">{children}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export const SchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { teamLabel, teamSeasonId, role: roleFromHook, loading: tsLoading, error: tsError } =
    useActiveTeamSeason();
  const { teamSeasonId: publicTeamId, teamLabel: publicLabel, loading: publicLoading } =
    usePublicTeamSeason();
  const { selectedMembership, user } = useSession();
  const userId = user?.id ?? null;
  const effectiveTeamSeasonId = teamSeasonId ?? publicTeamId;
  const { events, loading: eLoading, error: eError, refetch } = useEvents(effectiveTeamSeasonId);

  const loading = tsLoading || (!teamSeasonId && publicLoading);

  const teamSeasonSubtitle = (() => {
    if (selectedMembership) {
      const teamName = getTeamNameFromMembership(selectedMembership)?.trim();
      const season = getSeasonLabelFromMembership(selectedMembership)?.trim();
      if (teamName && (season && season !== '—')) return `${teamName} (${season})`;
      if (teamName) return teamName;
    }
    return publicLabel ?? teamLabel ?? 'Spielplan';
  })();

  // Public Mode: /schedule und /live = nur Anzeige, KEINE Navigation zu Event-Detail
  const { pathname } = useLocation();
  const forcePublicView =
    pathname === '/schedule' || pathname === '/live' || !pathname.startsWith('/app');
  const backendRole = normalizeRole(roleFromHook);
  const uiRoleRaw = forcePublicView ? null : (backendRole ?? null);
  const normalizedUiRole = normalizeRole(uiRoleRaw);
  const uiRole = normalizedUiRole === 'fan' ? null : normalizedUiRole;
  const canManage = forcePublicView ? false : canManageMatches(normalizedUiRole);
  const showMeetupForRole = forcePublicView ? true : canSeeMeetup(normalizedUiRole); // Öffentlich: Treffpunkt für alle
  const ourTeamName = teamLabel ?? publicLabel ?? getOurTeamDisplayName();

  const [kindFilter, setKindFilter] = useState<KindFilterId>(() =>
    normalizedUiRole === 'fan' ? 'match' : 'all',
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilterId>('upcoming');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);

  /** Zu-/Absage: Modal + Status. Gespeichertes Event = genau das angeklickte Spiel (ID-Konsistenz). */
  const [attendanceModalEvent, setAttendanceModalEvent] = useState<EventRow | null>(null);
  const [trainingRejoinModalEvent, setTrainingRejoinModalEvent] = useState<EventRow | null>(null);
  const [attendanceStatusByEventId, setAttendanceStatusByEventId] = useState<Record<string, 'yes' | 'no'>>({});
  const [trainingCancelReason, setTrainingCancelReason] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRow | null>(null);
  const [editOpponent, setEditOpponent] = useState('');
  const [editDateTime, setEditDateTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLocationAddress, setEditLocationAddress] = useState('');
  const [editMeetupAt, setEditMeetupAt] = useState('');
  const [editTrainingDeadlineDisabled, setEditTrainingDeadlineDisabled] = useState(false);
  const [editSeriesScope, setEditSeriesScope] = useState<SeriesEditScope>('single');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [matchScoreById, setMatchScoreById] = useState<Record<string, { scoreHome: number; scoreAway: number }>>({});

  useEffect(() => {
    const navState = (location.state as { openEditEventId?: string } | null) ?? null;
    const targetId = navState?.openEditEventId;
    if (!targetId || !canManage || events.length === 0) return;
    const targetEvent = events.find((e) => e.id === targetId);
    if (!targetEvent) return;
    openEditModal(targetEvent);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, canManage, events, navigate]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (pathname === '/live') setTimeFilter('upcoming');
  }, [pathname]);

  // Parent-Onboarding Redirect läuft zentral im InternalLayout (nach Login).

  const openEditModal = (e: EventRow) => {
    if (!canManage) {
      setToastMessage('Keine Berechtigung zum Bearbeiten.');
      return;
    }
    setEditEvent(e);
    setEditOpponent(e.opponent ?? '');
    setEditDateTime(utcIsoToViennaDateTimeLocal(e.starts_at));
    const parsedLocation = splitCombinedLocation(e.location ?? '');
    setEditLocation(parsedLocation.place);
    setEditLocationAddress(parsedLocation.address);
    setEditMeetupAt(utcIsoToViennaTimeHHmm(e.meeting_at ?? ''));
    setEditTrainingDeadlineDisabled(e.training_absence_deadline_disabled ?? false);
    setEditSeriesScope('single');
    setEditError(null);
    setEditModalOpen(true);
  };

  /**
   * Speichert Zusage/Absage in event_attendance (event_id, player_id, status, updated_by).
   * Parent: linked children (player_guardians). Player: self (player_users). Trainer: via EventDetailPage.
   */
  const setAttendance = async (eventId: string, status: 'yes' | 'no', _reason?: string) => {
    console.log('[ATTENDANCE FLOW] setAttendance invoked', {
      caller: 'SchedulePage.setAttendance',
      table: 'event_attendance',
      eventId,
      status,
      uiRole,
    });
    let playerId = myAttendancePlayerIds[0] ?? null;
    if (!playerId && userId) {
      const byGuardian = await supabase.from('player_guardians').select('player_id').eq('user_id', userId);
      if (!byGuardian.error && byGuardian.data?.length) playerId = byGuardian.data[0].player_id;
      if (!playerId) {
        const byPlayer = await supabase.from('player_users').select('player_id').eq('user_id', userId);
        if (!byPlayer.error && byPlayer.data?.length) playerId = byPlayer.data[0].player_id;
      }
    }

    if (!eventId || !playerId) {
      setToastMessage(!playerId ? 'Kein Spieler zugeordnet.' : 'Event fehlt.');
      setAttendanceModalEvent(null);
      setTrainingCancelReason('');
      return;
    }

    const evRow = events.find((x) => x.id === eventId);
    const isTrainingEv = evRow != null && getEffectiveEventType(evRow) === 'training';
    if (isTrainingEv && status === 'yes') {
      setToastMessage('Beim Training ist nur eine Absage möglich (Standard: dabei).');
      return;
    }

    // Toggle-Logik: Klick auf denselben Status → zurück auf neutral (Eintrag löschen).
    // Lokaler Override + DB-Status (sonst nach Reload kein erneutes „no“→Delete möglich).
    const myPidKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
    const fromDbRaw =
      myAttendancePlayerIds[0] && attendanceByEventId[eventId]
        ? attendanceByEventId[eventId].availabilityByPlayerId[myPidKey]
        : undefined;
    const fromDb: 'yes' | 'no' | null =
      fromDbRaw === 'yes' || fromDbRaw === 'no' ? fromDbRaw : null;
    const currentLocal = attendanceStatusByEventId[eventId] ?? fromDb ?? null;

    let result;
    if (currentLocal === status) {
      // Aktuell bereits dieser Status → löschen = neutral
      console.log('[ATTENDANCE FLOW] delete request', {
        table: 'event_attendance',
        where: { event_id: eventId, player_id: playerId },
      });
      result = await supabase
        .from('event_attendance')
        .delete()
        .eq('event_id', eventId)
        .eq('player_id', playerId);

      console.log('[ATTENDANCE DELETE RESULT]', { error: result.error });

      if (result.error) {
        console.error('[ATTENDANCE DELETE ERROR]', result.error);
        setToastMessage(result.error.message ?? 'Speichern fehlgeschlagen.');
        setAttendanceModalEvent(null);
        setTrainingCancelReason('');
        return;
      }

      setAttendanceStatusByEventId((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    } else {
      const payload = {
        event_id: eventId,
        player_id: playerId,
        status,
      };
      console.log('[ATTENDANCE FLOW] upsert request', {
        table: 'event_attendance',
        onConflict: 'event_id,player_id',
        payload,
        payloadKeys: Object.keys(payload),
      });

      const result = await upsertEventAttendanceMinimal(supabase, payload);
      console.log('[ATTENDANCE SAVE RESULT]', { data: result.data, error: result.error });

      if (result.error) {
        console.error('[ATTENDANCE SAVE ERROR]', {
          message: result.error.message,
          details: (result.error as any).details,
          hint: (result.error as any).hint,
          code: (result.error as any).code,
          raw: result.error,
        });
        setToastMessage(result.error.message ?? 'Speichern fehlgeschlagen.');
        setAttendanceModalEvent(null);
        setTrainingCancelReason('');
        return;
      }

      setAttendanceStatusByEventId((prev) => ({ ...prev, [eventId]: status }));
    }

    setAttendanceModalEvent(null);
    setTrainingCancelReason('');
    await refreshAttendance();
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditEvent(null);
    setEditOpponent('');
    setEditDateTime('');
    setEditLocation('');
    setEditLocationAddress('');
    setEditMeetupAt('');
    setEditSeriesScope('single');
    setEditError(null);
  };

  const handleEditSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    console.debug('[EditModal] submit');
    if (!editEvent) return;
    const opponent = (editOpponent ?? '').trim();
    if (!(editDateTime ?? '').trim()) {
      setEditError('Beginn ist Pflicht.');
      return;
    }
    setEditError(null);
    setSavingEdit(true);
    const startsAt = parseViennaDateTimeLocalToUtcIso((editDateTime ?? '').trim());
    if (!startsAt) {
      setEditError('Ungültiges Datumsformat.');
      setSavingEdit(false);
      return;
    }
    const locationVal = combineLocationParts(editLocation, editLocationAddress);
    let meetingAt: string | null = null;
    const meetupRaw = (editMeetupAt ?? '').trim();
    if (meetupRaw) {
      meetingAt = meetupUtcIsoOnViennaEventDay(startsAt, meetupRaw);
    }

    const hasSeries = Boolean(editEvent.series_id);
    const bulkScope = hasSeries && editSeriesScope !== 'single';

    const eff = getEffectiveEventType(editEvent);

    const fullPayload: Record<string, unknown> = {
      starts_at: startsAt,
      meeting_at: meetingAt,
      location: locationVal,
    };
    if (eff === 'game') {
      fullPayload.opponent = opponent || null;
    } else {
      fullPayload.opponent = null;
      fullPayload.notes = mergeTitleIntoNotes(editEvent.notes, opponent);
    }
    if (editEvent.kind === 'training') {
      fullPayload.training_absence_deadline_disabled = editTrainingDeadlineDisabled;
    }

    const sharedPayload: Record<string, unknown> = {
      location: locationVal,
    };
    if (eff === 'game') {
      sharedPayload.opponent = opponent || null;
    } else {
      sharedPayload.opponent = null;
      sharedPayload.notes = mergeTitleIntoNotes(editEvent.notes, opponent);
    }
    if (editEvent.kind === 'training') {
      sharedPayload.training_absence_deadline_disabled = editTrainingDeadlineDisabled;
    }

    const updateSelect = 'id, starts_at, meeting_at, location, opponent, notes';

    let eventErr: { message: string } | null = null;

    if (!bulkScope) {
      console.debug('[EditModal] save result: updating single event');
      console.log('event update payload', fullPayload);
      console.log('event update id', editEvent.id);
      const r = await supabase
        .from('events')
        .update(fullPayload)
        .eq('id', editEvent.id)
        .select(updateSelect);
      console.log('event update result', r.data, r.error);
      eventErr = r.error;
      if (!r.error && (!r.data || r.data.length === 0)) {
        setEditError('Speichern fehlgeschlagen: Keine Zeile aktualisiert (Berechtigung oder ID).');
        setSavingEdit(false);
        return;
      }
    } else if (editSeriesScope === 'future' && editEvent.series_id) {
      console.debug('[EditModal] save result: bulk update future');
      console.log('event bulk update (future) payload', sharedPayload);
      console.log('event bulk update series_id', editEvent.series_id);
      const r = await supabase
        .from('events')
        .update(sharedPayload)
        .eq('series_id', editEvent.series_id)
        .gte('starts_at', editEvent.starts_at)
        .select('id');
      console.log('event bulk update result', r.data, r.error);
      eventErr = r.error;
      if (!r.error && (!r.data || r.data.length === 0)) {
        setEditError('Speichern fehlgeschlagen: Keine Termine der Serie aktualisiert.');
        setSavingEdit(false);
        return;
      }
    } else if (editSeriesScope === 'series' && editEvent.series_id) {
      console.debug('[EditModal] save result: bulk update series');
      console.log('event bulk update (series) payload', sharedPayload);
      console.log('event bulk update series_id', editEvent.series_id);
      const r = await supabase
        .from('events')
        .update(sharedPayload)
        .eq('series_id', editEvent.series_id)
        .select('id');
      console.log('event bulk update result', r.data, r.error);
      eventErr = r.error;
      if (!r.error && (!r.data || r.data.length === 0)) {
        setEditError('Speichern fehlgeschlagen: Keine Termine der Serie aktualisiert.');
        setSavingEdit(false);
        return;
      }
    }

    if (eventErr) {
      console.debug('[EditModal] save error');
      setEditError(eventErr.message);
      setSavingEdit(false);
      return;
    }

    // MVP: Automatische Nachricht + Push bei relevanter Termin-Aenderung
    try {
      const oldLoc = (editEvent.location ?? '').toString();
      const newLoc = (locationVal ?? '').toString();
      const locationChanged = oldLoc !== newLoc;
      const startsChanged = (editEvent.starts_at ?? '') !== startsAt;
      const meetupChanged = (editEvent.meeting_at ?? '') !== (meetingAt ?? '');
      const relevantChanged = locationChanged || startsChanged || meetupChanged;

      if (relevantChanged && teamSeasonId) {
        const { data: sessionRes } = await supabase.auth.getSession();
        const accessToken = sessionRes.session?.access_token;
        if (accessToken) {
          const changedParts: string[] = [];
          if (meetupChanged) changedParts.push('Treffpunkt');
          if (startsChanged) changedParts.push('Uhrzeit');
          if (locationChanged) changedParts.push('Ort');
          const changedTxt = changedParts.length > 0 ? changedParts.join('/') : 'Details';
          await fetch('/api/push/send-team', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              team_season_id: teamSeasonId,
              recipient_group: 'all',
              title: 'Termin aktualisiert',
              body: `Ein Termin wurde aktualisiert: ${changedTxt} geändert.`,
              url: '/app/nachrichten',
              message_type: 'event_updated',
              related_event_id: editEvent.id,
            }),
          });
        }
      }
    } catch {
      // best-effort
    }

    setSavingEdit(false);
    closeEditModal();
    console.debug('[EditModal] save result');
    await refetch();
  };

  const handleDelete = async (event: EventRow) => {
    if (!window.confirm('Termin wirklich löschen?')) return;
    if (event.series_id) {
      const delAll = window.confirm(
        'Alle Wiederholungen dieser Serie löschen?\n\nOK = gesamte Serie\nAbbrechen = nur dieser eine Termin',
      );
      if (delAll) {
        const { data: seriesEvents, error: seriesReadError } = await supabase
          .from('events')
          .select('id, match_id')
          .eq('series_id', event.series_id);
        if (seriesReadError) {
          alert(seriesReadError.message);
          return;
        }
        const matchIds = [
          ...new Set(
            ((seriesEvents ?? []) as { id: string; match_id: string | null }[])
              .map((row) => row.match_id)
              .filter((id): id is string => typeof id === 'string' && id.length > 0),
          ),
        ];

        const { error } = await supabase.from('events').delete().eq('series_id', event.series_id);
        if (error) {
          alert(error.message);
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
            return;
          }
          if ((refs ?? []).length === 0) {
            const { error: delMatchErr } = await supabase.from('matches').delete().eq('id', matchId);
            if (delMatchErr) {
              alert(delMatchErr.message);
              return;
            }
          }
        }
        await refetch();
        return;
      }
    }
    const matchIds = event.match_id ? [event.match_id] : [];
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      alert(error.message);
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
        return;
      }
      if ((refs ?? []).length === 0) {
        const { error: delMatchErr } = await supabase.from('matches').delete().eq('id', matchId);
        if (delMatchErr) {
          alert(delMatchErr.message);
          return;
        }
      }
    }
    await refetch();
  };

  const displayEvents = useMemo(() => {
    const now = new Date();
    const statusWeight: Record<string, number> = {
      upcoming: 0,
      live: 1,
      finished: 2,
      canceled: 3,
    };
    const base = events.filter((e) => {
      // Fans sehen nur Spiele (kind === 'match')
      if (normalizedUiRole === 'fan') return e.kind === 'match';
      // Termine: Typ-Filter (Alle/Spiele/Trainings/Events)
      const et = getEffectiveEventType(e);
      if (kindFilter === 'match') return et === 'game';
      if (kindFilter === 'training') return et === 'training';
      if (kindFilter === 'event') return et === 'event' || et === 'other';
      return true; // all
    });

    const sorted = [...base].sort((a, b) => {
      const wa = statusWeight[a.status ?? 'upcoming'] ?? 0;
      const wb = statusWeight[b.status ?? 'upcoming'] ?? 0;
      if (wa !== wb) return wa - wb;
      return (a.starts_at ?? '').localeCompare(b.starts_at ?? '');
    });

    // Fan: nur Spiele, Kommend = bevorstehend + live, Vergangen = beendet.
    if (normalizedUiRole === 'fan') {
      if (timeFilter === 'upcoming') {
        return sorted.filter((e) => getEventTab(e) !== 'finished');
      }
      return sorted.filter((e) => getEventTab(e) === 'finished');
    }
    return sorted.filter((e) => getTimeBucket(e, now) === timeFilter);
  }, [events, kindFilter, normalizedUiRole, timeFilter]);

  const showHeroCard = useMemo(() => {
    if (displayEvents.length === 0) return false;
    if (normalizedUiRole === 'fan') {
      return timeFilter === 'upcoming';
    }
    return timeFilter === 'upcoming';
  }, [displayEvents.length, normalizedUiRole, timeFilter]);

  const heroEvent = showHeroCard ? displayEvents[0] ?? null : null;
  const furtherEvents = useMemo(() => {
    if (!showHeroCard) return displayEvents;
    return displayEvents.slice(1);
  }, [displayEvents, showHeroCard]);

  useEffect(() => {
    let cancelled = false;
    const matchIds = Array.from(
      new Set(
        displayEvents
          .filter((e) => getEffectiveEventType(e) === 'game')
          .map((e) => e.match_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    if (matchIds.length === 0) {
      setMatchScoreById({});
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, score_home, score_away')
        .in('id', matchIds);
      if (cancelled || error) return;
      const next: Record<string, { scoreHome: number; scoreAway: number }> = {};
      for (const row of (data ?? []) as Array<{ id: string; score_home: number | null; score_away: number | null }>) {
        next[row.id] = {
          scoreHome: Number(row.score_home ?? 0),
          scoreAway: Number(row.score_away ?? 0),
        };
      }
      setMatchScoreById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [displayEvents]);

  const displayEventIds = useMemo(() => displayEvents.map((e) => e.id), [displayEvents]);
  const { byEventId: attendanceByEventId, loading: attendanceLoading, refresh: refreshAttendance } = useEventsAttendance(displayEventIds);
  const { players } = usePlayers(effectiveTeamSeasonId);
  const { myAttendancePlayerIds } = useAvailabilityPermissions({
    role: normalizedUiRole,
    teamSeasonId,
  });

  /**
   * Training „Wieder dabei“: Absage-Zeile in event_attendance zuverlässig entfernen
   * (Standard = dabei ohne Datensatz). Umgeht Toggle-/Stale-State-Fälle von setAttendance.
   */
  const reinstateTrainingParticipation = useCallback(
    async (eventId: string): Promise<boolean> => {
      const myPidKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
      const fromDbRaw =
        myAttendancePlayerIds[0] && attendanceByEventId[eventId]
          ? attendanceByEventId[eventId].availabilityByPlayerId[myPidKey]
          : undefined;
      const fromDb: 'yes' | 'no' | null = fromDbRaw === 'yes' || fromDbRaw === 'no' ? fromDbRaw : null;
      const currentLocal = attendanceStatusByEventId[eventId] ?? fromDb ?? null;

      const candidatePlayerIds = new Set<string>();
      if (myAttendancePlayerIds[0]) candidatePlayerIds.add(myAttendancePlayerIds[0]);
      if (userId) {
        const byGuardian = await supabase.from('player_guardians').select('player_id').eq('user_id', userId);
        for (const row of byGuardian.data ?? []) {
          if (row?.player_id) candidatePlayerIds.add(String(row.player_id));
        }
        const byPlayer = await supabase.from('player_users').select('player_id').eq('user_id', userId);
        for (const row of byPlayer.data ?? []) {
          if (row?.player_id) candidatePlayerIds.add(String(row.player_id));
        }
      }
      const playerIds = Array.from(candidatePlayerIds);

      console.debug('[TRAINING REJOIN] start', {
        eventId,
        userId,
        playerId: myAttendancePlayerIds[0] ?? null,
        candidatePlayerIds: playerIds,
        currentLocal,
      });

      if (!eventId || playerIds.length === 0) {
        setToastMessage(playerIds.length === 0 ? 'Kein Spieler zugeordnet.' : 'Event fehlt.');
        return false;
      }

      // Training-Default = dabei ohne Datensatz: entferne alle negativen Status des aktuellen Users/Players.
      const deleteQuery = supabase
        .from('event_attendance')
        .delete()
        .eq('event_id', eventId)
        .in('player_id', playerIds)
        .in('status', ['no', 'absent', 'declined']);
      console.debug('[TRAINING REJOIN] delete filter', {
        table: 'event_attendance',
        event_id: eventId,
        player_id_in: playerIds,
        status_in: ['no', 'absent', 'declined'],
      });
      const { error } = await deleteQuery;
      console.debug('[TRAINING REJOIN] delete result', { error });

      if (error) {
        console.error('[ATTENDANCE] Training rejoin delete', error);
        setToastMessage(error.message ?? 'Speichern fehlgeschlagen.');
        return false;
      }

      // Optimistisch sofort grün anzeigen (✓ Dabei), bis Refresh final aus DB synchronisiert.
      setAttendanceStatusByEventId((prev) => ({ ...prev, [eventId]: 'yes' }));
      await refreshAttendance();
      const refreshForEvent = attendanceByEventId[eventId];
      const refreshStatusForActivePlayer =
        myAttendancePlayerIds[0] && refreshForEvent
          ? refreshForEvent.availabilityByPlayerId[(myAttendancePlayerIds[0] ?? '').toLowerCase()] ?? null
          : null;
      const { data: remainingNoRows, error: remainingNoRowsError } = await supabase
        .from('event_attendance')
        .select('event_id, player_id, status')
        .eq('event_id', eventId)
        .in('status', ['no', 'absent', 'declined']);
      console.debug('[TRAINING REJOIN] refresh result for event', {
        eventId,
        refreshStatusForActivePlayer,
        attendanceByEventIdEntry: refreshForEvent ?? null,
        remainingNoRows,
        remainingNoRowsError,
      });
      return true;
    },
    [attendanceByEventId, attendanceStatusByEventId, myAttendancePlayerIds, userId, refreshAttendance],
  );

  const rosterSize = players.length;

  /** Eltern/Spieler: „Weitere Termine“ etwas breiter (näher an BottomNav-Padding), ohne Hero/Filter anzufassen. */
  const widenParentFurtherList = (uiRole === 'parent' || uiRole === 'player') && !forcePublicView;

  const pageLoading = loading || eLoading;
  const error = tsError ?? eError;
  const canShowCalendarActions = Boolean(teamSeasonId && !pageLoading && displayEvents.length > 0);

  const runCalendarDownload = () => {
    downloadCalendarIcs(displayEvents, {
      appBaseUrl: window.location.origin,
      calendarName: normalizedUiRole === 'fan' ? 'Spielplan' : 'Termine',
    });
  };


  return (
    <div className="page schedule-page relative min-h-[60vh] scroll-mt-[max(5.75rem,calc(3.75rem+env(safe-area-inset-top,0px)))] [background:linear-gradient(180deg,rgba(40,5,5,0.97)_0%,rgba(20,0,0,0.98)_50%,rgba(10,0,0,0.99)_100%)] [box-shadow:inset_0_0_120px_rgba(120,20,20,0.12)]">
      <div className="w-full px-[6px] sm:px-4 md:px-6 lg:px-2">
        <div className="mx-auto mt-1 max-w-3xl space-y-3 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-3 sm:mt-2 sm:space-y-4 sm:pt-4">
          {toastMessage && (
            <div
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-black/90 border border-red-900/80 text-white text-sm font-medium shadow-lg backdrop-blur-sm"
              role="alert"
            >
              {toastMessage}
            </div>
          )}
          {forcePublicView && (
            <Link
              to="/"
              className="mb-2 inline-block text-sm text-white/70 hover:text-white transition-colors"
            >
              ← Start
            </Link>
          )}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] sm:text-3xl md:text-4xl">
                  {normalizedUiRole === 'fan' ? 'Spielplan' : 'Termine'}
                </h1>
                <div
                  className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1 text-xs text-white/80 sm:text-sm"
                  role="note"
                >
                  <span className="truncate">{teamSeasonSubtitle}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-row items-start justify-end gap-1.5">
                {canShowCalendarActions ? (
                  <button
                    type="button"
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/12 bg-black/30 px-3 text-[12px] font-semibold text-white/85 shadow-[0_0_10px_rgba(220,38,38,0.14)] transition-all hover:bg-white/[0.06] hover:text-white"
                    title="Kalender abonnieren"
                    onClick={() => setCalendarSheetOpen(true)}
                  >
                    <CalendarPlus className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    <span className="sm:hidden">Abo</span>
                    <span className="hidden sm:inline">Kalender abonnieren</span>
                  </button>
                ) : null}
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(true)}
                    disabled={!teamSeasonId}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 text-[17px] leading-none text-white/95 shadow-[0_0_8px_rgba(220,38,38,0.16)] disabled:opacity-50 hover:bg-red-500/18"
                    aria-label="Termin anlegen"
                    title="Termin anlegen"
                  >
                    +
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-stretch gap-2">
                {normalizedUiRole !== 'fan' ? (
                  <div className="flex min-h-[40px] min-w-0 flex-1 items-center gap-1 rounded-xl border border-white/12 bg-black/28 p-1 backdrop-blur-sm">
                    {([
                      { id: 'all', label: 'Alle' },
                      { id: 'match', label: 'Spiele' },
                      { id: 'training', label: 'Training' },
                      { id: 'event', label: 'Events' },
                    ] as const).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setKindFilter(f.id)}
                        className={`min-h-[36px] flex-1 rounded-lg px-2.5 text-[12px] font-medium transition-all ${
                          kindFilter === f.id
                            ? 'border border-red-400/30 bg-white/[0.11] text-white font-semibold shadow-[0_0_12px_rgba(220,38,38,0.18)]'
                            : 'border border-transparent text-white/75 hover:bg-white/[0.04] hover:text-white/90'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1" />
                )}

                <button
                  type="button"
                  onClick={() => navigate('/app/termine/calendar')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/25 text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label="Kalenderansicht"
                  title="Kalenderansicht"
                >
                  <CalendarDays className="h-4.5 w-4.5" aria-hidden />
                </button>
              </div>

              <div className="flex justify-center">
                <div className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-white/15 bg-black/25 p-1">
                  <button
                    type="button"
                    onClick={() => setTimeFilter('upcoming')}
                    className={`min-h-[32px] min-w-[88px] rounded-lg px-3 text-[12px] font-medium transition-all ${
                      timeFilter === 'upcoming'
                        ? 'border border-red-400/30 bg-white/[0.1] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.16)]'
                        : 'border border-transparent text-white/75 hover:bg-white/[0.04] hover:text-white/90'
                    }`}
                  >
                    Kommende
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilter('past')}
                    className={`min-h-[32px] min-w-[88px] rounded-lg px-3 text-[12px] font-medium transition-all ${
                      timeFilter === 'past'
                        ? 'border border-red-400/30 bg-white/[0.1] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.16)]'
                        : 'border border-transparent text-white/75 hover:bg-white/[0.04] hover:text-white/90'
                    }`}
                  >
                    Vergangene
                  </button>
                </div>
              </div>
            </div>
          </div>

          {pageLoading && (
            <p className="text-sm text-[var(--muted)]">
              {normalizedUiRole === 'fan' ? 'Lade Spielplan…' : 'Lade Termine…'}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {!pageLoading && !error && (
            <div className="w-full">
              {displayEvents.length === 0 ? (
                <p className="text-sm text-[var(--text-sub)]">
                  {events.length === 0
                    ? 'Noch keine Spiele oder Termine für diese Mannschaft erfasst.'
                    : normalizedUiRole === 'fan'
                      ? timeFilter === 'upcoming'
                        ? 'Keine kommenden Spiele.'
                        : 'Keine vergangenen Spiele.'
                      : timeFilter === 'upcoming'
                        ? 'Keine kommenden Termine für diesen Filter.'
                        : 'Keine vergangenen Termine für diesen Filter.'}
                </p>
              ) : (
                <>
                  {heroEvent
                    ? (() => {
                        const ev = heroEvent;
                        const evAttendance = attendanceByEventId[ev.id];
                        const yesRaw = evAttendance?.yes ?? 0;
                        const no = evAttendance?.no ?? 0;
                        const open = Math.max(0, rosterSize - yesRaw - no);
                        const et = getEffectiveEventType(ev);
                        const countsForCard =
                          et === 'training'
                            ? { yes: Math.max(0, rosterSize - no), no, open: 0 }
                            : { yes: yesRaw, no, open };
                        const myPlayerIdKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
                        const myStatusFromDb =
                          (uiRole === 'parent' || uiRole === 'player') &&
                          myAttendancePlayerIds[0] &&
                          evAttendance?.availabilityByPlayerId[myPlayerIdKey];
                        const attendanceStatusMerged =
                          uiRole === 'parent' || uiRole === 'player'
                            ? attendanceStatusByEventId[ev.id] ?? myStatusFromDb ?? null
                            : undefined;
                        const matchScore = ev.match_id ? matchScoreById[ev.match_id] : undefined;
                        const isFinishedMatch = et === 'game' && ev.status === 'finished' && Boolean(ev.match_id);
                        const publicWrap = forcePublicView
                          ? {
                              onClick: (e: React.MouseEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                              },
                              style: { cursor: 'default' as const },
                              role: 'presentation' as const,
                            }
                          : {};
                        const heroShowsTrainerStats =
                          !forcePublicView && !isFinishedMatch && canManage;
                        const heroShowsParentPill =
                          !forcePublicView &&
                          !isFinishedMatch &&
                          (uiRole === 'parent' || uiRole === 'player');
                        const heroTopRight =
                          normalizedUiRole === 'fan'
                            ? null
                            : heroShowsTrainerStats ? (
                                <TrainerStatsMini
                                  yes={countsForCard.yes}
                                  no={countsForCard.no}
                                  open={countsForCard.open}
                                  isTraining={et === 'training'}
                                />
                              ) : heroShowsParentPill ? (
                                <AttendanceStatusPill
                                  status={attendanceMergedToPillStatus(attendanceStatusMerged)}
                                  isTraining={et === 'training'}
                                />
                              ) : null;
                        const heroClickable = !forcePublicView && Boolean(ev.id);
                        const heroOnNavigate =
                          forcePublicView || !ev.id
                            ? undefined
                            : (id: string) =>
                                isFinishedMatch && ev.match_id
                                  ? navigate(`/app/live?matchId=${encodeURIComponent(ev.match_id)}`)
                                  : navigate(`/app/events/${id}`);
                        const trainerToolbarCompact = et === 'game';
                        const heroTrainerFooter =
                          canManage && !forcePublicView ? (
                            et === 'game' ? (
                              ev.match_id && ev.status !== 'finished' ? (
                                <div
                                  className="w-full"
                                  role="toolbar"
                                  aria-label="Trainer-Aktionen"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ScheduleHeroToolbarAction
                                    label="Live starten"
                                    title="Live starten"
                                    emphasis="primary"
                                    compact={trainerToolbarCompact}
                                    onClick={() => navigate(`/live?matchId=${ev.match_id}`)}
                                  >
                                    <Radio className="h-3.5 w-3.5" strokeWidth={2} />
                                  </ScheduleHeroToolbarAction>
                                </div>
                              ) : null
                            ) : (
                              <div
                                className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
                                role="toolbar"
                                aria-label="Trainer-Aktionen"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {et === 'game' && ev.match_id && ev.status !== 'finished' ? (
                                  <ScheduleHeroToolbarAction
                                    label="Live starten"
                                    title="Live starten"
                                    emphasis="primary"
                                    onClick={() => navigate(`/live?matchId=${ev.match_id}`)}
                                  >
                                    <Radio className="h-3.5 w-3.5" strokeWidth={2} />
                                  </ScheduleHeroToolbarAction>
                                ) : null}
                                <ScheduleHeroToolbarAction
                                  label="Bearbeiten"
                                  title="Bearbeiten"
                                  emphasis="secondary"
                                  onClick={() => openEditModal(ev)}
                                >
                                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                                </ScheduleHeroToolbarAction>
                                <ScheduleHeroToolbarAction
                                  label="Löschen"
                                  title="Löschen"
                                  emphasis="secondary"
                                  onClick={() => void handleDelete(ev)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                                </ScheduleHeroToolbarAction>
                                {ev.status !== 'finished' ? (
                                  <ScheduleHeroToolbarAction
                                    label="Kalender"
                                    title="Zum Kalender hinzufügen"
                                    emphasis="secondary"
                                    onClick={() =>
                                      downloadEventIcs(ev, {
                                        appBaseUrl: window.location.origin,
                                      })
                                    }
                                  >
                                    <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                                  </ScheduleHeroToolbarAction>
                                ) : null}
                              </div>
                            )
                          ) : null;
                        const heroParentFooter =
                          heroShowsParentPill && !forcePublicView && et !== 'game' ? (
                            <div
                              className={
                                ev.status !== 'finished'
                                  ? 'grid w-full max-w-md grid-cols-2 gap-2 sm:max-w-lg'
                                  : 'w-full max-w-md'
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="min-w-0 [&_button]:w-full">
                                <AttendanceActionRow
                                  isTraining={et === 'training'}
                                  variant="compact"
                                  compactPrimary
                                  scheduleMatchHero={false}
                                  onOpenAttendance={() => setAttendanceModalEvent(ev)}
                                />
                              </div>
                              {ev.status !== 'finished' ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-transparent px-3 text-[11px] font-medium text-white/55 hover:border-white/18 hover:bg-white/[0.04] hover:text-white/75"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadEventIcs(ev, { appBaseUrl: window.location.origin });
                                  }}
                                >
                                  <CalendarPlus className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                                  Zum Kalender
                                </Button>
                              ) : null}
                            </div>
                          ) : null;
                        const heroCardFooter =
                          heroTrainerFooter || heroParentFooter ? (
                            <div className={`flex flex-col ${et === 'game' ? 'gap-3 pb-1' : 'gap-1.5'}`}>
                              {heroTrainerFooter}
                              {heroParentFooter}
                            </div>
                          ) : undefined;
                        const opponentLogo =
                          (ev as EventRow & { opponent_logo_url?: string | null }).opponent_logo_url ?? null;
                        if (et === 'game') {
                          return (
                            <div
                              key={ev.id}
                              className="mb-4 -mx-3.5 w-[calc(100%+1.75rem)] max-w-none sm:mx-0 sm:w-full sm:max-w-full"
                              {...publicWrap}
                            >
                              <EventHeroCard label={heroLabelForEffectiveType(et)} footer={heroCardFooter}>
                                <MatchCardLigaportal
                                  className="w-full max-w-full !px-2.5 !py-2.5 sm:!px-3 sm:!py-3"
                                  scheduleNextMatchHero
                                  onScheduleHeroAddToCalendar={
                                    forcePublicView || ev.status === 'finished'
                                      ? undefined
                                      : () =>
                                          downloadEventIcs(ev, {
                                            appBaseUrl: window.location.origin,
                                          })
                                  }
                                  ourTeamName={ourTeamName}
                                  opponent={ev.opponent}
                                  isHome={ev.is_home}
                                  startsAt={ev.starts_at}
                                  status={ev.status}
                                  kind={ev.kind}
                                  eventType={ev.type}
                                  matchType={
                                    ev.kind === 'match'
                                      ? (ev.match_type ??
                                          (!ev.type || ev.type === 'game' ? 'league' : ev.type))
                                      : null
                                  }
                                  notes={ev.notes}
                                  location={ev.location}
                                  address={ev.location}
                                  meetupAt={ev.meeting_at}
                                  showMeetup={showMeetupForRole}
                                  scoreHome={matchScore?.scoreHome ?? null}
                                  scoreAway={matchScore?.scoreAway ?? null}
                                  eventId={ev.id}
                                  onNavigate={heroOnNavigate}
                                  opponentLogoUrl={opponentLogo}
                                  canManage={Boolean(heroShowsTrainerStats)}
                                  attendanceCounts={countsForCard}
                                  role={
                                    heroShowsParentPill && (uiRole === 'parent' || uiRole === 'player')
                                      ? uiRole
                                      : null
                                  }
                                  attendanceStatus={
                                    attendanceStatusMerged === 'yes'
                                      ? 'yes'
                                      : attendanceStatusMerged === 'no'
                                        ? 'no'
                                        : null
                                  }
                                  onOpenAttendance={
                                    heroShowsParentPill ? () => setAttendanceModalEvent(ev) : undefined
                                  }
                                  isPublicView={forcePublicView}
                                />
                              </EventHeroCard>
                            </div>
                          );
                        }
                        return (
                          <div key={ev.id} className="w-full" {...publicWrap}>
                            <EventHeroCard label={heroLabelForEffectiveType(et)} footer={heroCardFooter}>
                              <ScheduleHeroEventCard
                                ev={ev}
                                et={et}
                                ourTeamName={ourTeamName}
                                opponentLogoUrl={opponentLogo}
                                scoreHome={matchScore?.scoreHome}
                                scoreAway={matchScore?.scoreAway}
                                showMeetup={showMeetupForRole}
                                topRight={heroTopRight}
                                isPublicView={forcePublicView}
                                isClickable={heroClickable}
                                onNavigate={heroOnNavigate}
                              />
                            </EventHeroCard>
                          </div>
                        );
                      })()
                    : null}

                  <div
                    className={
                      widenParentFurtherList
                        ? '-mx-1.5 min-w-0 w-[calc(100%+0.75rem)] max-w-none overflow-x-hidden sm:mx-0 sm:w-full'
                        : 'min-w-0 w-full'
                    }
                  >
                    {showHeroCard && furtherEvents.length > 0 ? (
                      <h3 className="mb-1 border-t border-white/[0.06] pt-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-300/70">
                        {normalizedUiRole === 'fan' ? 'Weitere Spiele' : 'Weitere Termine'}
                      </h3>
                    ) : null}
                    {furtherEvents.map((ev) => {
                      const evAttendance = attendanceByEventId[ev.id];
                      const yesRaw = evAttendance?.yes ?? 0;
                      const no = evAttendance?.no ?? 0;
                      const open = Math.max(0, rosterSize - yesRaw - no);
                      const et = getEffectiveEventType(ev);
                      const countsForCard =
                        et === 'training'
                          ? { yes: Math.max(0, rosterSize - no), no, open: 0 }
                          : { yes: yesRaw, no, open };
                      const myPlayerIdKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
                      const myStatusFromDb =
                        (uiRole === 'parent' || uiRole === 'player') &&
                        myAttendancePlayerIds[0] &&
                        evAttendance?.availabilityByPlayerId[myPlayerIdKey];
                      const attendanceStatusMerged =
                        uiRole === 'parent' || uiRole === 'player'
                          ? attendanceStatusByEventId[ev.id] ?? myStatusFromDb ?? null
                          : undefined;
                      const isFinishedMatch = et === 'game' && ev.status === 'finished' && Boolean(ev.match_id);
                      const showCompactTrainerStats =
                        normalizedUiRole !== 'fan' && !forcePublicView && !isFinishedMatch && canManage;
                      const showCompactParentPill =
                        normalizedUiRole !== 'fan' &&
                        !forcePublicView &&
                        !isFinishedMatch &&
                        (uiRole === 'parent' || uiRole === 'player');
                      const compactTrailing = showCompactTrainerStats ? (
                        <TrainerStatsMini
                          yes={countsForCard.yes}
                          no={countsForCard.no}
                          open={countsForCard.open}
                          isTraining={et === 'training'}
                          listColumn
                        />
                      ) : showCompactParentPill ? (
                        <CompactListParentAttendance
                          status={attendanceMergedToPillStatus(attendanceStatusMerged)}
                          isTraining={et === 'training'}
                          onOpen={() => {
                            const pill = attendanceMergedToPillStatus(attendanceStatusMerged);
                            if (et === 'training' && pill === 'no') {
                              setTrainingRejoinModalEvent(ev);
                              return;
                            }
                            setAttendanceModalEvent(ev);
                          }}
                        />
                      ) : undefined;
                      const opponentLogo = (ev as EventRow & { opponent_logo_url?: string | null }).opponent_logo_url;
                      return (
                        <CompactEventCard
                          key={ev.id}
                          ev={ev}
                          et={et}
                          ourTeamName={ourTeamName}
                          opponentLogoUrl={opponentLogo}
                          parentCompactLayout={showCompactParentPill || showCompactTrainerStats}
                          trailing={compactTrailing}
                          forcePublicView={forcePublicView}
                          onNavigate={(id) =>
                            isFinishedMatch && ev.match_id
                              ? navigate(`/app/live?matchId=${encodeURIComponent(ev.match_id)}`)
                              : navigate(`/app/events/${id}`)
                          }
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <CreateEventModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            teamSeasonId={teamSeasonId}
            onSuccess={refetch}
            eventType="event"
          />

          <Modal
            isOpen={calendarSheetOpen}
            title="Kalender abonnieren"
            onClose={() => setCalendarSheetOpen(false)}
            footer={
              <Button variant="ghost" onClick={() => setCalendarSheetOpen(false)}>
                Schließen
              </Button>
            }
          >
            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-left text-sm font-medium text-white/90 hover:bg-white/[0.08]"
                onClick={() => {
                  runCalendarDownload();
                  setCalendarSheetOpen(false);
                }}
              >
                <span>iPhone Kalender</span>
                <span className="text-white/55" aria-hidden>›</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-left text-sm font-medium text-white/90 hover:bg-white/[0.08]"
                onClick={() => {
                  runCalendarDownload();
                  setCalendarSheetOpen(false);
                }}
              >
                <span>Google Kalender</span>
                <span className="text-white/55" aria-hidden>›</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-left text-sm font-medium text-white/90 hover:bg-white/[0.08]"
                onClick={() => {
                  runCalendarDownload();
                  setCalendarSheetOpen(false);
                }}
              >
                <span>FamilyWall</span>
                <span className="text-white/55" aria-hidden>›</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-left text-sm font-medium text-white/90 hover:bg-white/[0.08]"
                onClick={() => {
                  runCalendarDownload();
                  setCalendarSheetOpen(false);
                }}
              >
                <span>ICS herunterladen</span>
                <span className="text-white/55" aria-hidden>›</span>
              </button>
            </div>
          </Modal>

          <Modal
            isOpen={editModalOpen}
            title="Termin bearbeiten"
            onClose={closeEditModal}
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeEditModal} className="pointer-events-auto touch-manipulation">
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  form="edit-event-form"
                  variant="primary"
                  disabled={savingEdit}
                  className="pointer-events-auto touch-manipulation"
                  onClick={() => console.debug('[EditModal] save click')}
                >
                  {savingEdit ? 'Speichern…' : 'Speichern'}
                </Button>
              </div>
            }
          >
            <form id="edit-event-form" onSubmit={handleEditSubmit} className="space-y-4">
          {editEvent?.series_id ? (
            <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 space-y-2">
              <span className="block text-sm font-medium text-[var(--text-main)]">Serie bearbeiten</span>
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
                <input
                  type="radio"
                  name="edit-series-scope"
                  checked={editSeriesScope === 'single'}
                  onChange={() => setEditSeriesScope('single')}
                />
                Nur diesen Termin ändern (inkl. Zeit & Treffpunkt)
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
                <input
                  type="radio"
                  name="edit-series-scope"
                  checked={editSeriesScope === 'future'}
                  onChange={() => setEditSeriesScope('future')}
                />
                Alle zukünftigen Termine ändern (Ort, Bezeichnung, Trainings-Frist)
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] cursor-pointer">
                <input
                  type="radio"
                  name="edit-series-scope"
                  checked={editSeriesScope === 'series'}
                  onChange={() => setEditSeriesScope('series')}
                />
                Gesamte Serie ändern (Ort, Bezeichnung, Trainings-Frist)
              </label>
              {editSeriesScope !== 'single' && (
                <p className="text-xs text-[var(--text-sub)]">
                  Zeit und Treffpunkt nur bei „Nur diesen Termin ändern“.
                </p>
              )}
            </div>
          ) : null}
          <div>
            <label htmlFor="edit-opponent" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              {editEvent?.type === 'training' || editEvent?.type === 'event' || editEvent?.type === 'other'
                ? 'Titel'
                : 'Gegner / Bezeichnung'}
            </label>
            <input
              id="edit-opponent"
              type="text"
              value={editOpponent}
              onChange={(e) => setEditOpponent(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
            />
          </div>
          <div>
            <label htmlFor="edit-datetime" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Beginn *
            </label>
            <input
              id="edit-datetime"
              type="datetime-local"
              required
              disabled={Boolean(editEvent?.series_id && editSeriesScope !== 'single')}
              value={editDateTime}
              onChange={(e) => setEditDateTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="edit-location" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Platzname / Ort (optional)
            </label>
            <input
              id="edit-location"
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
              placeholder="z. B. Sportplatz Rohrbach"
            />
          </div>
          <div>
            <label htmlFor="edit-location-address" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Adresse / PLZ / Ort (optional)
            </label>
            <input
              id="edit-location-address"
              type="text"
              value={editLocationAddress}
              onChange={(e) => setEditLocationAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
              placeholder="z. B. Sportplatzstraße 1, 3163 Rohrbach"
            />
          </div>
          <div>
            <label htmlFor="edit-meetup_at" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Treffpunkt (optional)
            </label>
            <input
              id="edit-meetup_at"
              type="time"
              disabled={Boolean(editEvent?.series_id && editSeriesScope !== 'single')}
              value={editMeetupAt}
              onChange={(e) => setEditMeetupAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] disabled:opacity-50"
            />
          </div>
          {editEvent?.kind === 'training' ? (
            <label className="flex items-start gap-2 text-sm text-[var(--text-main)] cursor-pointer">
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
          {editError && (
            <p className="text-sm text-red-600" role="alert">
              {editError}
            </p>
          )}
            </form>
          </Modal>

          {/* Modal Zu-/Absage (Eltern/Spieler) – verwendet exakt die event_id des angeklickten Spiels. */}
          <Modal
            isOpen={attendanceModalEvent != null}
            title={
              attendanceModalEvent
                ? attendanceModalEvent.type === 'training'
                  ? `Absage (Training): ${
                      ((attendanceModalEvent.notes ?? '').split(' · ')[0]?.trim() || attendanceModalEvent.opponent) ??
                      'Termin'
                    }`
                  : `Zu-/Absage: ${
                      ((attendanceModalEvent.notes ?? '').split(' · ')[0]?.trim() || attendanceModalEvent.opponent) ??
                      'Termin'
                    }`
                : 'Zu-/Absage'
            }
            onClose={() => {
              setAttendanceModalEvent(null);
              setTrainingCancelReason('');
            }}
            footer={
              <div className="flex justify-end">
                <Button
                  variant="soft"
                  onClick={() => {
                    setAttendanceModalEvent(null);
                    setTrainingCancelReason('');
                  }}
                >
                  Schließen
                </Button>
              </div>
            }
          >
            <div className="flex flex-col py-3">
              {attendanceModalEvent && (
                <p className="text-sm text-[var(--text-sub)] mb-2">
                  {attendanceModalEvent.notes
                    ? attendanceModalEvent.notes.split(' · ')[0] ?? 'Termin'
                    : attendanceModalEvent.opponent ?? 'Termin'}{' '}
                  ·{' '}
                  {attendanceModalEvent.starts_at ? formatDateTimeDeVienna(attendanceModalEvent.starts_at) : ''}
                </p>
              )}

              {attendanceModalEvent?.type === 'training' ? (
                <>
                  {(() => {
                    const myPlayerIdKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
                    const myStatusFromDb =
                      (uiRole === 'parent' || uiRole === 'player') && myAttendancePlayerIds[0] && attendanceByEventId[attendanceModalEvent.id]
                        ? attendanceByEventId[attendanceModalEvent.id].availabilityByPlayerId[myPlayerIdKey] ?? null
                        : null;

                    const current = attendanceStatusByEventId[attendanceModalEvent.id] ?? myStatusFromDb ?? null;
                    const canceled = current === 'no';
                    const cutoffPassed = isTrainingAbsenceDeadlinePassed(
                      attendanceModalEvent.starts_at,
                      attendanceModalEvent.training_absence_deadline_disabled,
                    );
                    const cancelAllowed = !cutoffPassed;
                    return (
                      <>
                        <p className="text-sm text-[var(--text-main)] font-medium">
                          Status: {canceled ? 'Abwesend' : 'Dabei'}
                        </p>
                        <p className="text-xs text-[var(--text-sub)] mt-1">
                          {attendanceModalEvent.training_absence_deadline_disabled
                            ? 'Absage jederzeit möglich.'
                            : 'Absage bis 12:00 Uhr am Trainingstag möglich (Europe/Vienna).'}
                        </p>
                        {!cancelAllowed && !canceled ? (
                          <p className="text-xs text-amber-200/90 mt-1">Absagefrist ist vorbei – Teilnahme gilt als „Dabei“.</p>
                        ) : null}

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-[var(--text-main)] mb-1">
                            Grund (optional)
                          </label>
                          <textarea
                            value={trainingCancelReason}
                            onChange={(ev) => setTrainingCancelReason(ev.target.value)}
                            className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
                            placeholder="z. B. Krankheit, keine Zeit, etc."
                          />
                        </div>

                        <div className="flex flex-wrap gap-3 mt-6">
                          <Button
                            type="button"
                            variant="negative"
                            disabled={canceled || !cancelAllowed}
                            onClick={() => {
                              console.log('[ATTENDANCE BUTTON CLICKED]', 'training-no');
                              if (!attendanceModalEvent) return;
                              setAttendance(attendanceModalEvent.id, 'no', trainingCancelReason).catch((e) => console.error('[ATTENDANCE]', e));
                            }}
                            className={`flex-1 min-w-0 max-w-[240px] mx-auto sm:max-w-none py-3 px-5 text-sm ${
                              canceled || !cancelAllowed ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            Absagen
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <p className="text-sm text-[var(--text-sub)]">
                    Standard ist „Offen“, bis du zusagst oder absagst.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-6">
                    <Button
                      type="button"
                      variant="positive"
                      onClick={() => {
                        console.log('[ATTENDANCE BUTTON CLICKED]');
                        if (!attendanceModalEvent) return;
                        setAttendance(attendanceModalEvent.id, 'yes').catch((e) => console.error('[ATTENDANCE]', e));
                      }}
                      className="flex-1 min-w-0 max-w-[240px] mx-auto sm:max-w-none py-3 px-5 text-sm"
                    >
                      Dabei
                    </Button>
                    <Button
                      type="button"
                      variant="negative"
                      onClick={() => {
                        console.log('[ATTENDANCE BUTTON CLICKED]');
                        if (!attendanceModalEvent) return;
                        setAttendance(attendanceModalEvent.id, 'no').catch((e) => console.error('[ATTENDANCE]', e));
                      }}
                      className="flex-1 min-w-0 max-w-[240px] mx-auto sm:max-w-none py-3 px-5 text-sm"
                    >
                      Absage
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Modal>

          <Modal
            isOpen={trainingRejoinModalEvent != null}
            title="Wieder zusagen?"
            onClose={() => setTrainingRejoinModalEvent(null)}
            footer={
              <div className="flex justify-end gap-2">
                <AppButton variant="secondary" onClick={() => setTrainingRejoinModalEvent(null)}>
                  Abbrechen
                </AppButton>
                <AppButton
                  variant="success"
                  onClick={() => {
                    if (!trainingRejoinModalEvent) return;
                    void (async () => {
                      const ok = await reinstateTrainingParticipation(trainingRejoinModalEvent.id);
                      if (ok) setTrainingRejoinModalEvent(null);
                    })().catch((e) => console.error('[ATTENDANCE]', e));
                  }}
                >
                  ✅ Wieder dabei
                </AppButton>
              </div>
            }
          >
            <p className="text-sm text-[var(--text-sub)]">
              Deine Teilnahme am Training wird wieder auf „Dabei“ gesetzt.
            </p>
          </Modal>
        </div>
      </div>
    </div>
  );
};
