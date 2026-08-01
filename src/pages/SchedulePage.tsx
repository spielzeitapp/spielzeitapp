import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { CalendarDays, CalendarPlus, Pencil, Radio, Trash2 } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import { AppButton } from '../components/ui/AppButton';
import { CreateEventModal } from '../app/components/CreateEventModal';
import type { AttendanceStatusKind } from '../components/schedule/AttendanceStatusPill';
import { CompactListParentAttendance } from '../components/schedule/CompactListParentAttendance';
import { ScheduleEventActionsPanel } from '../components/schedule/ScheduleEventActionsPanel';
import { CompactEventCard } from '../components/schedule/CompactEventCard';
import { PastMatchResultCard } from '../components/schedule/PastMatchResultCard';
import { MatchCardLigaportal } from '../app/components/MatchCardLigaportal';
import { EventHeroCard } from '../components/schedule/EventHeroCard';
import { ScheduleHeroEventCard } from '../components/schedule/ScheduleHeroEventCard';
import { TrainerStatsMini } from '../components/schedule/TrainerStatsMini';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePublicTeamSeason } from '../hooks/usePublicTeamSeason';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { useEventsAttendance, type AttendanceStatus } from '../hooks/useEventsAttendance';
import { usePlayers } from '../hooks/usePlayers';
import { useLinkedPlayerIsLaz } from '../hooks/useLinkedPlayerIsLaz';
import { useAvailabilityPermissions } from '../hooks/useAvailabilityPermissions';
import { useSession, getTeamNameFromMembership, getSeasonLabelFromMembership } from '../auth/useSession';
import { normalizeRole, canManageMatches, canSeeMeetup } from '../lib/roles';
import { isMatchReviewPending } from '../lib/matchPreparationAccess';
import { formatTeamSeasonDisplayLabel } from '../lib/seasonLifecycle';
import { assertTeamSeasonWritable } from '../lib/seasonTransition';
import { getOurTeamDisplayName } from '../lib/teamLogos';
import { supabase } from '../lib/supabaseClient';
import { deleteEventAndRelatedData } from '../lib/deleteEventCascade';
import { downloadEventIcs } from '../lib/ics';
import { buildTeamIcsFeedUrl, teamCalendarSlugFromTeamName } from '../lib/calendarFeed';
import { isTrainingAbsenceDeadlinePassed } from '../lib/trainingAbsence';
import type { SeriesEditScope } from '../lib/seriesEditScope';
import {
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsScheduleFilterTabClass,
  dsScheduleKindFilterTabClass,
  DS_SCHEDULE_KIND_FILTER_SCROLL_CLASS,
  DS_SCHEDULE_KIND_FILTER_TRACK_CLASS,
  dsScheduleGlassButtonClass,
  dsSchedulePageStyle,
  dsSchedulePlusButtonClass,
  dsSublineClass,
  dsPrimaryCtaClass,
  dsSecondaryCtaClass,
} from '../lib/premiumDesignSystem';
import {
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  utcIsoToViennaDateTimeLocal,
  utcIsoToViennaTimeHHmm,
} from '../lib/viennaTime';
import { formatDateTimeDeVienna } from '../lib/notifications/format';
import { attendanceLazModalButtonClass } from '../lib/attendanceColors';
import { upsertEventAttendanceMinimal } from '../lib/rsvp/writeEventAttendance';
import { combineLocationParts, splitCombinedLocation } from '../lib/eventLocation';
import { trainingScheduleCardCounts } from '../lib/trainingAttendance';
import { buildPlayerAvailabilityMap } from '../lib/playerAvailability';
import {
  formatPeriodScoresBracket,
  parsePeriodScores,
  sumPeriodScoresTriplet,
} from '../lib/matchEventScores';
import { fetchLineupForLiveMatch } from '../lib/liveMatchService';
import { isStartelfCompleteFromStartingIds } from '../pages/MatchDetail/lineupGuards';
import { PremiumEmptyState } from '../ui';
import { getEffectiveEventType } from '../lib/eventTypeUtils';
import { eventNotesTitle, mergeTitleIntoNotes } from '../components/schedule/scheduleEventViewUtils';

type KindFilterId = 'all' | 'match' | 'training' | 'event' | 'tournament';
type TimeFilterId = 'upcoming' | 'past';

function getEventTab(e: EventRow): 'upcoming' | 'live' | 'finished' {
  const s = e.status ?? 'upcoming';
  if (s === 'live') return 'live';
  if (s === 'finished' || s === 'canceled') return 'finished';
  return 'upcoming';
}

function getTimeBucket(e: EventRow, now: Date): TimeFilterId {
  const status = e.status ?? 'upcoming';
  if (status === 'finished' || status === 'canceled') return 'past';
  if (status === 'live') return 'upcoming';
  const et = getEffectiveEventType(e);
  if (et === 'training' || et === 'event' || et === 'other' || et === 'tournament') {
    const starts = e.starts_at ? new Date(e.starts_at).getTime() : 0;
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (starts && starts + TWO_HOURS < now.getTime()) return 'past';
  }
  return 'upcoming';
}

function heroLabelForEffectiveType(
  et: ReturnType<typeof getEffectiveEventType>,
): string {
  if (et === 'game') return 'Nächstes Spiel';
  if (et === 'training') return 'Nächstes Training';
  if (et === 'tournament') return 'Nächstes Turnier';
  return 'Nächster Termin';
}

function attendanceMergedToPillStatus(s: AttendanceStatus | null | undefined): AttendanceStatusKind {
  if (s === 'external_training') return 'laz';
  if (s === 'yes') return 'yes';
  if (s === 'no') return 'no';
  return 'open';
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
      ? `${dsPrimaryCtaClass()} !h-auto !min-h-0 !w-full !rounded-[14px] !px-2 !py-0 !text-[10px] sm:!text-[11px]`
      : emphasis === 'danger'
        ? 'border-[rgba(122,29,42,0.28)] bg-[rgba(58,18,24,0.55)] text-[#E8C4C8] shadow-[0_0_12px_rgba(122,29,42,0.12)] backdrop-blur-sm hover:border-[rgba(122,29,42,0.38)] hover:bg-[rgba(72,12,22,0.65)] hover:text-white'
        : `${dsScheduleGlassButtonClass()} !h-auto !min-h-0 !w-full !rounded-[14px] !px-2 !py-0 !text-[10px] !font-semibold !text-white/78 sm:!text-[11px] hover:!text-white/92`;
  const sizeClass = compact
    ? 'h-9 min-h-9 gap-1 px-2 text-[11px] sm:text-[11px]'
    : 'h-10 min-h-[2.5rem] gap-1.5 px-2 text-[10px] sm:text-[11px]';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`inline-flex w-full min-w-0 shrink-0 items-center justify-center font-semibold transition ${sizeClass} ${tone} ${className}`}
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
  const {
    teamLabel,
    teamLine,
    teamLabelWithStatus,
    teamSeasonId,
    readTeamSeasonId,
    activeTeamSeasonId,
    teamSeasons,
    setViewTeamSeasonId,
    isHistoryReadOnly,
    softLockMessage,
    role: roleFromHook,
    loading: tsLoading,
    error: tsError,
  } = useActiveTeamSeason();
  const { teamSeasonId: publicTeamId, teamLabel: publicLabel, loading: publicLoading } =
    usePublicTeamSeason();
  const { selectedMembership, user, selectedTeamSeason, isViewOnlyPlayer } = useSession();
  const userId = user?.id ?? null;
  const effectiveTeamSeasonId = teamSeasonId ?? publicTeamId;
  const { events: rawEvents, loading: eLoading, error: eError, refetch } = useEvents(effectiveTeamSeasonId);

  const [matchStatusById, setMatchStatusById] = useState<Record<string, string>>({});
  useEffect(() => {
    const matchIds = Array.from(
      new Set(
        rawEvents
          .filter((e) => e.match_id)
          .map((e) => e.match_id!)
      ),
    );
    if (matchIds.length === 0) { setMatchStatusById({}); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, status')
        .in('id', matchIds);
      if (cancelled || error) return;
      const next: Record<string, string> = {};
      for (const r of data ?? []) next[r.id] = r.status ?? 'upcoming';
      setMatchStatusById(next);
    })();
    return () => { cancelled = true; };
  }, [rawEvents]);

  const events: EventRow[] = useMemo(() =>
    rawEvents.map((e) => {
      if (!e.match_id) return e;
      const ms = matchStatusById[e.match_id];
      if (ms === 'live' && e.status !== 'live') return { ...e, status: 'live' as const };
      return e;
    }),
  [rawEvents, matchStatusById]);

  const loading = tsLoading || (!teamSeasonId && publicLoading);

  const teamSeasonSubtitle = (() => {
    if (teamLabelWithStatus?.trim()) return teamLabelWithStatus.trim();
    if (teamLabel?.trim()) return teamLabel.trim();
    return publicLabel ?? 'Spielplan';
  })();

  /** Öffentliche Team-ICS-URL (Slug aus Teamname, sonst Team-UUID). */
  const teamCalendarSegment = useMemo(() => {
    const nameFromSeason = selectedTeamSeason?.team?.name?.trim();
    const nameFromMembership = getTeamNameFromMembership(selectedMembership)?.trim();
    let fromPublic = publicLabel?.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
    if (fromPublic === 'Spielplan') fromPublic = null;
    const fromTeamLabel = teamLabel?.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
    const name = nameFromSeason || nameFromMembership || fromPublic || fromTeamLabel;
    if (name) return teamCalendarSlugFromTeamName(name);
    return selectedTeamSeason?.team?.id ?? null;
  }, [selectedTeamSeason, selectedMembership, publicLabel, teamLabel]);

  const teamIcsFeedUrl = useMemo(() => {
    if (!teamCalendarSegment) return null;
    return buildTeamIcsFeedUrl(window.location.origin, teamCalendarSegment);
  }, [teamCalendarSegment]);

  // Public Mode: /schedule und /live = nur Anzeige, KEINE Navigation zu Event-Detail
  const { pathname } = useLocation();
  const forcePublicView =
    pathname === '/schedule' || pathname === '/live' || !pathname.startsWith('/app');
  const backendRole = normalizeRole(roleFromHook);
  const uiRoleRaw = forcePublicView ? null : (backendRole ?? null);
  const normalizedUiRole = normalizeRole(uiRoleRaw);
  const uiRole = normalizedUiRole === 'fan' ? null : normalizedUiRole;
  const canShowRsvpUi = (uiRole === 'parent' || uiRole === 'player') && !isViewOnlyPlayer;
  const canManage = forcePublicView || isHistoryReadOnly ? false : canManageMatches(normalizedUiRole);
  const showMeetupForRole = forcePublicView ? true : canSeeMeetup(normalizedUiRole); // Öffentlich: Treffpunkt für alle
  const ourTeamName =
    (teamLine ?? '').trim() ||
    publicLabel ||
    getOurTeamDisplayName();

  const [kindFilter, setKindFilter] = useState<KindFilterId>(() =>
    normalizedUiRole === 'fan' ? 'match' : 'all',
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilterId>('upcoming');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
  const [calendarGuideKind, setCalendarGuideKind] = useState<'google' | 'familywall' | null>(null);

  /** Zu-/Absage: Modal + Status. Gespeichertes Event = genau das angeklickte Spiel (ID-Konsistenz). */
  const [attendanceModalEvent, setAttendanceModalEvent] = useState<EventRow | null>(null);
  const [trainingRejoinModalEvent, setTrainingRejoinModalEvent] = useState<EventRow | null>(null);
  const [attendanceStatusByEventId, setAttendanceStatusByEventId] = useState<Record<string, AttendanceStatus>>({});
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
  const [matchScoreById, setMatchScoreById] = useState<
    Record<
      string,
      { scoreHome: number; scoreAway: number; periodBracket: string | null; liveIsRunning: boolean }
    >
  >({});

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
    const editEff = getEffectiveEventType(e);
    setEditOpponent(
      editEff === 'game' ? (e.opponent ?? '') : (eventNotesTitle(e.notes) ?? e.opponent ?? ''),
    );
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
  const setAttendance = async (eventId: string, status: AttendanceStatus, _reason?: string) => {
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
      const payload = {
        event_id: eventId,
        player_id: playerId,
        status: 'yes' as const,
      };
      const result = await upsertEventAttendanceMinimal(supabase, payload);
      if (result.error) {
        setToastMessage(result.error.message ?? 'Speichern fehlgeschlagen.');
        setAttendanceModalEvent(null);
        setTrainingCancelReason('');
        return;
      }
      setAttendanceStatusByEventId((prev) => ({ ...prev, [eventId]: 'yes' }));
      setAttendanceModalEvent(null);
      setTrainingCancelReason('');
      await refreshAttendance();
      return;
    }

    if (isTrainingEv && status === 'external_training') {
      const { data: lazRow, error: lazErr } = await supabase
        .from('players')
        .select('is_laz_player')
        .eq('id', playerId)
        .maybeSingle();
      if (lazErr || !lazRow?.is_laz_player) {
        setToastMessage('LAZ ist für diesen Spieler nicht freigeschaltet.');
        return;
      }
    }

    // Toggle-Logik: Klick auf denselben Status → zurück auf neutral (Eintrag löschen).
    // Lokaler Override + DB-Status (sonst nach Reload kein erneutes „no“→Delete möglich).
    const myPidKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
    const fromDbRaw =
      myAttendancePlayerIds[0] && attendanceByEventId[eventId]
        ? attendanceByEventId[eventId].availabilityByPlayerId[myPidKey]
        : undefined;
    const fromDb: AttendanceStatus | null =
      fromDbRaw === 'yes' || fromDbRaw === 'no' || fromDbRaw === 'external_training' ? fromDbRaw : null;
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
    const writable = await assertTeamSeasonWritable(editEvent.team_season_id);
    if (!writable.ok) {
      setEditError(writable.message);
      return;
    }
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
      if (editEvent.kind === 'tournament') {
        fullPayload.type = 'tournament';
      }
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
      if (editEvent.kind === 'tournament') {
        sharedPayload.type = 'tournament';
      }
    }
    if (editEvent.kind === 'training') {
      sharedPayload.training_absence_deadline_disabled = editTrainingDeadlineDisabled;
    }

    const updateSelect = 'id, starts_at, meeting_at, location, opponent, notes';

    let eventErr: { message: string } | null = null;

    if (!bulkScope) {
      console.debug('[EditModal] save result: updating single event');
      console.log('event update payload', fullPayload);
      console.log('saved event kind', editEvent.kind);
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
    if (isHistoryReadOnly) {
      alert(softLockMessage ?? 'Archiv: nur Lesen');
      return;
    }
    const writable = await assertTeamSeasonWritable(event.team_season_id);
    if (!writable.ok) {
      alert(writable.message);
      return;
    }
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
        for (const row of (seriesEvents ?? []) as { id: string; match_id: string | null }[]) {
          const { error } = await deleteEventAndRelatedData(row.id, row.match_id ?? null);
          if (error) {
            alert(error);
            return;
          }
        }
        await refetch();
        return;
      }
    }
    const { error } = await deleteEventAndRelatedData(event.id, event.match_id ?? null);
    if (error) {
      alert(error);
      return;
    }
    await refetch();
  };

  const displayEvents = useMemo(() => {
    const now = new Date();
    const statusWeight: Record<string, number> = {
      live: -1,
      upcoming: 0,
      finished: 2,
      canceled: 3,
    };
    const base = events.filter((e) => {
      // Fans sehen nur Spiele (kind === 'match')
      if (normalizedUiRole === 'fan') return e.kind === 'match';
      // Termine: Typ-Filter (Alle/Spiele/Trainings/Events)
      if (kindFilter === 'match') return e.kind === 'match';
      if (kindFilter === 'training') return e.kind === 'training';
      if (kindFilter === 'tournament') return e.kind === 'tournament';
      if (kindFilter === 'event') return e.kind === 'event';
      return true; // all
    });

    const sorted = [...base].sort((a, b) => {
      const reviewA =
        a.match_id &&
        isMatchReviewPending({ eventStatus: a.status, matchStatus: matchStatusById[a.match_id] });
      const reviewB =
        b.match_id &&
        isMatchReviewPending({ eventStatus: b.status, matchStatus: matchStatusById[b.match_id] });
      if (reviewA !== reviewB) return reviewA ? -1 : 1;
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
  }, [events, kindFilter, normalizedUiRole, timeFilter, matchStatusById]);

  const showHeroCard = useMemo(() => {
    if (displayEvents.length === 0) return false;
    if (normalizedUiRole === 'fan') {
      return timeFilter === 'upcoming';
    }
    return timeFilter === 'upcoming';
  }, [displayEvents.length, normalizedUiRole, timeFilter]);

  const heroEvent = showHeroCard ? displayEvents[0] ?? null : null;
  const [heroLineupReady, setHeroLineupReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mid = heroEvent?.match_id?.trim() ?? '';
    if (!mid || !heroEvent || getEffectiveEventType(heroEvent) !== 'game') {
      setHeroLineupReady(false);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const { data, error } = await fetchLineupForLiveMatch(mid);
      if (cancelled) return;
      setHeroLineupReady(!error && isStartelfCompleteFromStartingIds(data.startingPlayerIds));
    })();
    return () => {
      cancelled = true;
    };
  }, [heroEvent?.id, heroEvent?.match_id]);

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
        .select('id, score_home, score_away, period_scores, live_is_running')
        .in('id', matchIds);
      if (cancelled || error) return;
      const next: Record<
        string,
        { scoreHome: number; scoreAway: number; periodBracket: string | null; liveIsRunning: boolean }
      > = {};
      for (const row of (data ?? []) as Array<{
        id: string;
        score_home: number | null;
        score_away: number | null;
        period_scores: unknown;
        live_is_running: boolean | null;
      }>) {
        const liveIsRunning = Boolean(row.live_is_running);
        const triplet = parsePeriodScores(row.period_scores);
        if (triplet) {
          const s = sumPeriodScoresTriplet(triplet);
          next[row.id] = {
            scoreHome: s.home,
            scoreAway: s.away,
            periodBracket: formatPeriodScoresBracket(triplet),
            liveIsRunning,
          };
        } else {
          next[row.id] = {
            scoreHome: Number(row.score_home ?? 0),
            scoreAway: Number(row.score_away ?? 0),
            periodBracket: null,
            liveIsRunning,
          };
        }
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
    viewOnlyPlayer: isViewOnlyPlayer,
  });

  /**
   * Training „Wieder dabei“: status = yes in event_attendance speichern (UPSERT).
   * Umgeht Toggle-/Stale-State-Fälle von setAttendance.
   */
  const reinstateTrainingParticipation = useCallback(
    async (eventId: string): Promise<boolean> => {
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
        return false;
      }

      const result = await upsertEventAttendanceMinimal(supabase, {
        event_id: eventId,
        player_id: playerId,
        status: 'yes',
      });

      if (result.error) {
        console.error('[ATTENDANCE] Training rejoin upsert', result.error);
        setToastMessage(result.error.message ?? 'Speichern fehlgeschlagen.');
        return false;
      }

      setAttendanceStatusByEventId((prev) => ({ ...prev, [eventId]: 'yes' }));
      await refreshAttendance();
      return true;
    },
    [myAttendancePlayerIds, userId, refreshAttendance],
  );

  const rosterPlayerIds = useMemo(() => players.map((p) => p.id), [players]);
  const playerAvailabilityById = useMemo(() => buildPlayerAvailabilityMap(players), [players]);
  const myLinkedPlayerId = myAttendancePlayerIds[0] ?? null;
  const { isLazPlayer: myLinkedPlayerIsLaz } = useLinkedPlayerIsLaz(myLinkedPlayerId);

  /** Eltern/Spieler: „Weitere Termine“ etwas breiter (näher an BottomNav-Padding), ohne Hero/Filter anzufassen. */
  const widenParentFurtherList = (uiRole === 'parent' || uiRole === 'player') && !forcePublicView;

  const pageLoading = loading || eLoading;
  const error = tsError ?? eError;
  const canShowCalendarActions = Boolean(teamIcsFeedUrl && !pageLoading && displayEvents.length > 0);

  const copyTeamIcsUrl = useCallback(async () => {
    if (!teamIcsFeedUrl) return;
    try {
      await navigator.clipboard.writeText(teamIcsFeedUrl);
      setToastMessage('Kalender-URL kopiert.');
    } catch (e) {
      console.error('[Calendar Subscription] copy URL failed', e);
      setToastMessage('URL konnte nicht kopiert werden.');
    }
  }, [teamIcsFeedUrl]);

  const openTeamIcsSubscriptionUrl = useCallback(() => {
    if (!teamIcsFeedUrl) return;
    window.location.assign(teamIcsFeedUrl);
  }, [teamIcsFeedUrl]);


  return (
    <div
      className="page schedule-page relative scroll-mt-[max(5.75rem,calc(3.75rem+env(safe-area-inset-top,0px)))]"
      style={dsSchedulePageStyle()}
    >
      <div className="schedule-page__scroll min-w-0 overflow-x-hidden">
        <div className="w-full px-[6px] sm:px-4 md:px-6 lg:px-2">
          <div className="mx-auto mt-1 max-w-3xl space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-1 sm:mt-2 sm:space-y-4 sm:pt-2">
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
                <div className="flex items-center gap-2">
                  <h1 className={dsPageTitleClass()}>
                    {normalizedUiRole === 'fan' ? 'Spielplan' : 'Termine'}
                  </h1>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (isHistoryReadOnly) {
                          window.alert(softLockMessage ?? 'Archivierte Saison: nur Lesen.');
                          return;
                        }
                        setCreateModalOpen(true);
                      }}
                      disabled={!activeTeamSeasonId || isHistoryReadOnly}
                      className={`${dsSchedulePlusButtonClass()} h-8 w-8 shrink-0 text-[16px] leading-none`}
                      aria-label="Termin anlegen"
                      title={isHistoryReadOnly ? softLockMessage ?? 'Archiv: nur Lesen' : 'Termin anlegen'}
                    >
                      +
                    </button>
                  ) : null}
                </div>
                <div className="mt-1.5 flex max-w-full flex-col gap-1.5">
                  {teamSeasons.length > 1 ? (
                    <label className="block min-w-0">
                      <span className="sr-only">Saison anzeigen</span>
                      <select
                        value={readTeamSeasonId ?? ''}
                        onChange={(e) => setViewTeamSeasonId(e.target.value || null)}
                        className="w-full max-w-full truncate rounded-lg border border-white/10 bg-[rgba(14,14,18,0.72)] px-2.5 py-1.5 text-xs text-white/90 sm:text-sm"
                        aria-label="Saison für Termine wählen"
                      >
                        {teamSeasons.map((ts) => (
                          <option key={ts.id} value={ts.id}>
                            {formatTeamSeasonDisplayLabel(
                              {
                                displayName: ts.display_name,
                                ageGroup: ts.age_group,
                                teamName: ts.team?.name,
                                seasonName: ts.season?.name,
                                status: ts.status,
                              },
                              { markArchived: true },
                            )}
                            {ts.id === activeTeamSeasonId ? ' — Aktuell' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div
                      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-[rgba(14,14,18,0.72)] px-2.5 py-1 text-xs sm:text-sm ${dsSublineClass()}`}
                      role="note"
                    >
                      <span className="truncate">{teamSeasonSubtitle}</span>
                    </div>
                  )}
                  {isHistoryReadOnly ? (
                    <p className="text-[11px] text-amber-200/90">{softLockMessage}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-row items-center justify-end gap-1.5">
                {canShowCalendarActions ? (
                  <button
                    type="button"
                    className={`${dsScheduleGlassButtonClass()} h-10 shrink-0 gap-1.5 px-3 text-[12px]`}
                    title="Kalender abonnieren"
                    onClick={() => setCalendarSheetOpen(true)}
                  >
                    <CalendarPlus className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    <span className="sm:hidden">Abo</span>
                    <span className="hidden sm:inline">Kalender abonnieren</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate('/app/termine/calendar')}
                  className={`${dsScheduleGlassButtonClass()} h-10 w-10 shrink-0`}
                  aria-label="Kalenderansicht"
                  title="Kalenderansicht"
                >
                  <CalendarDays className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                </button>
              </div>
            </div>
          </div>

          <div
            className="schedule-page__filters flex w-full min-w-0 flex-col gap-2 overflow-x-hidden"
            aria-label="Termine Filter"
          >
            <div className="flex flex-col gap-2">
              {normalizedUiRole !== 'fan' ? (
                <div className={DS_SCHEDULE_KIND_FILTER_SCROLL_CLASS}>
                  <div className={DS_SCHEDULE_KIND_FILTER_TRACK_CLASS}>
                    {([
                      { id: 'all', label: 'Alle' },
                      { id: 'match', label: 'Spiele' },
                      { id: 'training', label: 'Training' },
                      { id: 'event', label: 'Events' },
                      { id: 'tournament', label: 'Turniere' },
                    ] as const).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setKindFilter(f.id)}
                        className={dsScheduleKindFilterTabClass(kindFilter === f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-center">
                <div className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-white/[0.08] bg-[rgba(18,18,20,0.92)] p-1">
                  <button
                    type="button"
                    onClick={() => setTimeFilter('upcoming')}
                    className={`min-h-[32px] min-w-[88px] ${dsScheduleFilterTabClass(timeFilter === 'upcoming')}`}
                  >
                    Kommende
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilter('past')}
                    className={`min-h-[32px] min-w-[88px] ${dsScheduleFilterTabClass(timeFilter === 'past')}`}
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
                normalizedUiRole === 'fan' && events.length === 0 ? (
                  <PremiumEmptyState
                    variant="subtle"
                    title="Noch keine Termine"
                    description="Für dein Team sind noch keine Termine eingetragen."
                    className="py-6"
                  />
                ) : (
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
                )
              ) : (
                <>
                  {heroEvent
                    ? (() => {
                        const ev = heroEvent;
                        const evAttendance = attendanceByEventId[ev.id];
                        const yesRaw = evAttendance?.yes ?? 0;
                        const no = evAttendance?.no ?? 0;
                        const open = Math.max(0, rosterPlayerIds.length - yesRaw - no);
                        const et = getEffectiveEventType(ev);
                        const countsForCard =
                          et === 'training'
                            ? trainingScheduleCardCounts({
                                rosterPlayerIds,
                                availabilityByPlayerId: evAttendance?.availabilityByPlayerId,
                                startsAtIso: ev.starts_at,
                                playerAvailabilityById,
                              })
                            : { yes: yesRaw, no, open };
                        const myPlayerIdKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
                        const myStatusFromDb =
                          canShowRsvpUi &&
                          myAttendancePlayerIds[0] &&
                          evAttendance?.availabilityByPlayerId[myPlayerIdKey];
                        const attendanceStatusMerged =
                          canShowRsvpUi
                            ? attendanceStatusByEventId[ev.id] ?? myStatusFromDb ?? null
                            : undefined;
                        const matchScore = ev.match_id ? matchScoreById[ev.match_id] : undefined;
                        const matchReviewPending = Boolean(
                          ev.match_id &&
                            isMatchReviewPending({
                              eventStatus: ev.status,
                              matchStatus: matchStatusById[ev.match_id],
                            }),
                        );
                        const isFinishedMatch =
                          et === 'game' && ev.status === 'finished' && Boolean(ev.match_id);
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
                          canShowRsvpUi;
                        const heroTopRight =
                          normalizedUiRole === 'fan'
                            ? null
                            : heroShowsTrainerStats ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center rounded-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-black/70"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigate(`/app/events/${ev.id}`);
                                  }}
                                  aria-label="Teilnehmerübersicht öffnen"
                                >
                                  <TrainerStatsMini
                                    yes={countsForCard.yes}
                                    no={countsForCard.no}
                                    open={countsForCard.open}
                                    isTraining={et === 'training'}
                                    listColumn
                                    size="hero"
                                  />
                                </button>
                              ) : heroShowsParentPill && et !== 'game' ? (
                                <CompactListParentAttendance
                                  status={attendanceMergedToPillStatus(attendanceStatusMerged)}
                                  isTraining={et === 'training'}
                                  context="hero"
                                  onOpen={() => {
                                    const pill = attendanceMergedToPillStatus(attendanceStatusMerged);
                                    if (et === 'training' && (pill === 'no' || pill === 'laz')) {
                                      setTrainingRejoinModalEvent(ev);
                                      return;
                                    }
                                    setAttendanceModalEvent(ev);
                                  }}
                                />
                              ) : null;
                        const heroClickable = !forcePublicView && Boolean(ev.id);
                        const heroIsLive =
                          ev.status === 'live' || Boolean(matchScore?.liveIsRunning);
                        const heroOnNavigate =
                          forcePublicView || !ev.id
                            ? undefined
                            : (id: string) => {
                                if ((isFinishedMatch || matchReviewPending) && ev.match_id) {
                                  navigate(`/app/live?matchId=${encodeURIComponent(ev.match_id)}`);
                                  return;
                                }
                                navigate(`/app/events/${id}`);
                              };
                        const heroCardFooter = undefined;
                        const heroGoLive =
                          et === 'game' &&
                          ev.match_id &&
                          !forcePublicView &&
                          (heroIsLive || matchReviewPending || (Boolean(heroShowsTrainerStats) && heroLineupReady))
                            ? () => navigate(`/app/live?matchId=${encodeURIComponent(ev.match_id!)}`)
                            : undefined;
                        const opponentLogo = ev.opponent_logo_url ?? null;
                        if (et === 'game') {
                          return (
                            <div
                              key={ev.id}
                              className="mb-3 -mx-1 w-[calc(100%+0.5rem)] max-w-none sm:mx-0 sm:w-full sm:max-w-full"
                              {...publicWrap}
                            >
                              <EventHeroCard label={heroLabelForEffectiveType(et)} footer={heroCardFooter}>
                                <MatchCardLigaportal
                                  className="w-full max-w-full !px-2.5 !py-2 sm:!px-3 sm:!py-2.5"
                                  scheduleNextMatchHero
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
                                    !forcePublicView && !isFinishedMatch && et === 'game' && normalizedUiRole === 'fan'
                                      ? 'fan'
                                      : heroShowsParentPill && canShowRsvpUi
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
                                    heroShowsTrainerStats
                                      ? // Trainer: Teilnehmerübersicht (wer dabei/offen/abgesagt) im Termin-Detail
                                        () => navigate(`/app/events/${ev.id}`)
                                      : heroShowsParentPill
                                        ? () => setAttendanceModalEvent(ev)
                                        : undefined
                                  }
                                  isPublicView={forcePublicView}
                                  onScheduleHeroGoLive={heroGoLive}
                                  lineupReady={Boolean(heroShowsTrainerStats && heroLineupReady)}
                                  scheduleHeroMatchId={ev.match_id ?? null}
                                  liveIsRunning={matchScore?.liveIsRunning ?? null}
                                  reviewPending={matchReviewPending}
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
                        ? '-mx-1.5 min-w-0 w-[calc(100%+0.75rem)] max-w-none overflow-x-hidden pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] sm:mx-0 sm:w-full'
                        : 'min-w-0 w-full pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]'
                    }
                  >
                    {showHeroCard && furtherEvents.length > 0 ? (
                      <h3 className={`mb-2 mt-1 border-t border-white/[0.05] pt-3 ${dsMatchdaySectionLabelClass()} !text-[0.7rem]`}>
                        {normalizedUiRole === 'fan' ? 'Weitere Spiele' : 'Weitere Termine'}
                      </h3>
                    ) : null}
                    {furtherEvents.map((ev) => {
                      const evAttendance = attendanceByEventId[ev.id];
                      const yesRaw = evAttendance?.yes ?? 0;
                      const no = evAttendance?.no ?? 0;
                      const open = Math.max(0, rosterPlayerIds.length - yesRaw - no);
                      const et = getEffectiveEventType(ev);
                      const countsForCard =
                        et === 'training'
                          ? trainingScheduleCardCounts({
                              rosterPlayerIds,
                              availabilityByPlayerId: evAttendance?.availabilityByPlayerId,
                              startsAtIso: ev.starts_at,
                              playerAvailabilityById,
                            })
                          : { yes: yesRaw, no, open };
                      const myPlayerIdKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
                      const myStatusFromDb =
                        canShowRsvpUi &&
                        myAttendancePlayerIds[0] &&
                        evAttendance?.availabilityByPlayerId[myPlayerIdKey];
                      const attendanceStatusMerged =
                        canShowRsvpUi
                          ? attendanceStatusByEventId[ev.id] ?? myStatusFromDb ?? null
                          : undefined;
                      const isFinishedMatch = et === 'game' && ev.status === 'finished' && Boolean(ev.match_id);
                      const showCompactTrainerStats =
                        normalizedUiRole !== 'fan' && !forcePublicView && !isFinishedMatch && canManage;
                      const showCompactParentPill =
                        normalizedUiRole !== 'fan' &&
                        !forcePublicView &&
                        !isFinishedMatch &&
                        canShowRsvpUi;
                      const compactTrailing = showCompactTrainerStats ? (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-black/70"
                          aria-label="Teilnehmerübersicht öffnen"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/app/events/${ev.id}`);
                          }}
                        >
                          <TrainerStatsMini
                            yes={countsForCard.yes}
                            no={countsForCard.no}
                            open={countsForCard.open}
                            isTraining={et === 'training'}
                            listColumn
                            size="list"
                          />
                        </button>
                      ) : showCompactParentPill ? (
                        <CompactListParentAttendance
                          status={attendanceMergedToPillStatus(attendanceStatusMerged)}
                          isTraining={et === 'training'}
                          onOpen={() => {
                            const pill = attendanceMergedToPillStatus(attendanceStatusMerged);
                            if (et === 'training' && (pill === 'no' || pill === 'laz')) {
                              setTrainingRejoinModalEvent(ev);
                              return;
                            }
                            setAttendanceModalEvent(ev);
                          }}
                        />
                      ) : undefined;
                      const opponentLogo = ev.opponent_logo_url ?? null;
                      const matchScoreRow = ev.match_id ? matchScoreById[ev.match_id] : undefined;
                      const matchReviewPending = Boolean(
                        ev.match_id &&
                          isMatchReviewPending({
                            eventStatus: ev.status,
                            matchStatus: matchStatusById[ev.match_id],
                          }),
                      );
                      const showPastResultCard = et === 'game' && ev.status === 'finished';
                      if (showPastResultCard) {
                        return (
                          <PastMatchResultCard
                            key={ev.id}
                            ev={ev}
                            ourTeamName={ourTeamName}
                            opponentLogoUrl={opponentLogo}
                            scoreHome={matchScoreRow?.scoreHome ?? null}
                            scoreAway={matchScoreRow?.scoreAway ?? null}
                            periodBracketLine={matchScoreRow?.periodBracket ?? null}
                            forcePublicView={forcePublicView}
                            onNavigate={(id) => navigate(`/app/events/${id}`)}
                          />
                        );
                      }
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
                            (isFinishedMatch || matchReviewPending) && ev.match_id
                              ? navigate(`/app/live?matchId=${encodeURIComponent(ev.match_id)}`)
                              : navigate(`/app/events/${id}`)
                          }
                          reviewPending={matchReviewPending}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      <CreateEventModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            teamSeasonId={activeTeamSeasonId}
            onSuccess={refetch}
            eventType="match"
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
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-left hover:bg-white/[0.08]"
                onClick={() => {
                  openTeamIcsSubscriptionUrl();
                  setCalendarSheetOpen(false);
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-white/90">iPhone Kalender</span>
                  <span className="text-[11px] font-normal leading-snug text-white/55">
                    Öffnet den abonnierbaren Teamkalender.
                  </span>
                </span>
                <span className="shrink-0 text-white/55" aria-hidden>›</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-left hover:bg-white/[0.08]"
                onClick={() => {
                  setCalendarSheetOpen(false);
                  setCalendarGuideKind('google');
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-white/90">Google Kalender</span>
                  <span className="text-[11px] font-normal leading-snug text-white/55">
                    URL kopieren und in Google Kalender abonnieren.
                  </span>
                </span>
                <span className="shrink-0 text-white/55" aria-hidden>›</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-left hover:bg-white/[0.08]"
                onClick={() => {
                  setCalendarSheetOpen(false);
                  setCalendarGuideKind('familywall');
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-white/90">FamilyWall</span>
                  <span className="text-[11px] font-normal leading-snug text-white/55">
                    URL kopieren und in FamilyWall als ICS-Kalender hinzufügen.
                  </span>
                </span>
                <span className="shrink-0 text-white/55" aria-hidden>›</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-left hover:bg-white/[0.08]"
                onClick={() => {
                  void copyTeamIcsUrl();
                  setCalendarSheetOpen(false);
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-white/90">ICS URL kopieren</span>
                  <span className="text-[11px] font-normal leading-snug text-white/55">
                    Kopiert die Abo-URL in die Zwischenablage.
                  </span>
                </span>
                <span className="shrink-0 text-white/55" aria-hidden>›</span>
              </button>
            </div>
          </Modal>

          <Modal
            isOpen={calendarGuideKind !== null}
            title={calendarGuideKind === 'google' ? 'Google Kalender' : 'FamilyWall'}
            onClose={() => setCalendarGuideKind(null)}
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCalendarGuideKind(null)}>
                  Schließen
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    void copyTeamIcsUrl();
                    setCalendarGuideKind(null);
                  }}
                >
                  ICS URL kopieren
                </Button>
              </div>
            }
          >
            <p className="text-[14px] text-white/80">
              {calendarGuideKind === 'google'
                ? 'Google Kalender unterstützt Kalender-Abos per URL.'
                : 'In FamilyWall → Kalender → ICS abonnieren → URL einfügen.'}
            </p>
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
            {editEvent?.type === 'training' || editEvent?.type === 'event' || editEvent?.type === 'other' ? (
              <p className="mt-1 text-xs text-[var(--text-sub)]">Steuert die Überschrift auf der Termine-Karte.</p>
            ) : null}
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
                      (canShowRsvpUi) && myAttendancePlayerIds[0] && attendanceByEventId[attendanceModalEvent.id]
                        ? attendanceByEventId[attendanceModalEvent.id].availabilityByPlayerId[myPlayerIdKey] ?? null
                        : null;

                    const current = attendanceStatusByEventId[attendanceModalEvent.id] ?? myStatusFromDb ?? null;
                    const isLaz = current === 'external_training';
                    const canceled = current === 'no';
                    const cutoffPassed = isTrainingAbsenceDeadlinePassed(
                      attendanceModalEvent.starts_at,
                      attendanceModalEvent.training_absence_deadline_disabled,
                    );
                    const cancelAllowed = !cutoffPassed;
                    return (
                      <>
                        <p className="text-sm text-[var(--text-main)] font-medium">
                          Status: {isLaz ? 'LAZ' : canceled ? 'Abwesend' : 'Dabei'}
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

                        <div
                          className={`mt-6 grid gap-3 ${myLinkedPlayerIsLaz ? 'grid-cols-3' : 'grid-cols-2'}`}
                        >
                          <Button
                            type="button"
                            variant="positive"
                            disabled={!canceled && !isLaz}
                            onClick={() => {
                              if (!attendanceModalEvent) return;
                              setAttendance(attendanceModalEvent.id, 'yes').catch((e) => console.error('[ATTENDANCE]', e));
                            }}
                            className={`w-full py-3 px-5 text-sm ${
                              !canceled && !isLaz ? '' : 'opacity-50 cursor-not-allowed'
                            }`}
                          >
                            Dabei
                          </Button>
                          <Button
                            type="button"
                            variant="negative"
                            disabled={canceled || !cancelAllowed}
                            onClick={() => {
                              console.log('[ATTENDANCE BUTTON CLICKED]', 'training-no');
                              if (!attendanceModalEvent) return;
                              setAttendance(attendanceModalEvent.id, 'no', trainingCancelReason).catch((e) => console.error('[ATTENDANCE]', e));
                            }}
                            className={`w-full py-3 px-5 text-sm ${
                              canceled || !cancelAllowed ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            Absagen
                          </Button>
                          {myLinkedPlayerIsLaz ? (
                            <Button
                              type="button"
                              variant="soft"
                              onClick={() => {
                                if (!attendanceModalEvent) return;
                                setAttendance(attendanceModalEvent.id, 'external_training').catch((e) =>
                                  console.error('[ATTENDANCE]', e),
                                );
                              }}
                              className={`w-full py-3 px-5 text-sm font-semibold ${attendanceLazModalButtonClass(isLaz)}`}
                            >
                              LAZ
                            </Button>
                          ) : null}
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
  );
};
