import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { EventHeroCard } from '../components/schedule/EventHeroCard';
import { AppButton } from '../components/ui/AppButton';
import type { EventRow, EventKind, EventStatus } from '../hooks/useEvents';
import type { PlayerItem } from '../hooks/usePlayers';
import { downloadSingleEventFullCalendarIcs } from '../lib/ics';
import { isTrainingAbsenceDeadlinePassed } from '../lib/trainingAbsence';
import { upsertEventAttendanceMinimal } from '../lib/rsvp/writeEventAttendance';
import { upsertMatchForSetup } from '../lib/liveMatchService';
import { fetchMatchById, updateMatchRow } from '../lib/liveMatchService';
import { buildPauseDelimitedPeriodScoreLine } from '../lib/matchEngine';
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

function compactTeamNameForMatchHeader(name: string | null | undefined): string {
  let s = (name ?? '').trim();
  if (!s) return 'Team';
  s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim(); // remove season suffix
  s = s.replace(/^U\s*\d{1,2}\s+/i, '').trim(); // remove leading age-group
  s = s.replace(/^U\d{1,2}\s+/i, '').trim();
  return s || (name ?? '').trim() || 'Team';
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

  type MatchEventRow = {
    id: string;
    match_id: string;
    type: string;
    minute: number | null;
    period: number | null;
    player_id: string | null;
    created_at: string;
  };
  const [finishedTab, setFinishedTab] = useState<'overview' | 'lineup' | 'timeline' | 'stats'>('overview');
  const [matchRowLite, setMatchRowLite] = useState<{
    id: string;
    status: string | null;
    score_home: number | null;
    score_away: number | null;
    location: string | null;
    period_scores: unknown | null;
  } | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEventRow[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [reportEditOpen, setReportEditOpen] = useState(false);
  const [goalMinute, setGoalMinute] = useState(''); // Anzeige-Minute (1..)
  const [goalTeam, setGoalTeam] = useState<'home' | 'away'>('home');
  const [goalPlayerId, setGoalPlayerId] = useState<string>('');
  const [manualScoreHome, setManualScoreHome] = useState('');
  const [manualScoreAway, setManualScoreAway] = useState('');
  const [scoreEditOpen, setScoreEditOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventMinute, setEditEventMinute] = useState('');
  const [editEventType, setEditEventType] = useState<'goal_home' | 'goal_away' | 'switch'>('goal_home');
  const [editEventPlayerId, setEditEventPlayerId] = useState(''); // goal scorer
  const [editSwitchOutPlayerId, setEditSwitchOutPlayerId] = useState('');
  const [editSwitchInPlayerId, setEditSwitchInPlayerId] = useState('');
  const [lineupRows, setLineupRows] = useState<Array<{ player_id: string | null; slot: string | null }>>([]);
  const [benchRows, setBenchRows] = useState<Array<{ player_id: string | null }>>([]);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [p1h, setP1h] = useState('');
  const [p1a, setP1a] = useState('');
  const [p2h, setP2h] = useState('');
  const [p2a, setP2a] = useState('');
  const [p3h, setP3h] = useState('');
  const [p3a, setP3a] = useState('');

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
      downloadSingleEventFullCalendarIcs(event as any, {
        appBaseUrl: window.location.origin,
      });
    } catch (error) {
      console.error('Event ICS download failed', error, event);
      alert(
        'Kalender-Fehler: ' +
          ((error as { message?: string })?.message ?? String(error)),
      );
      setCalendarActionError('Kalenderdatei konnte nicht erstellt werden.');
    }
  }, [event]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const isFinishedMatchEvent = useMemo(() => {
    if (!event) return false;
    const t = (event.type ?? '').trim().toLowerCase();
    return t === 'game' && event.status === 'finished' && Boolean(event.match_id);
  }, [event]);

  useEffect(() => {
    if (!isFinishedMatchEvent || !event?.match_id) return;
    let cancelled = false;
    setMatchLoading(true);
    setMatchError(null);
    const mid = event.match_id;
    (async () => {
      const res = await fetchMatchById(mid);
      if (cancelled) return;
      if (res.error) {
        setMatchRowLite(null);
        setMatchEvents([]);
        setMatchError(res.error);
        setMatchLoading(false);
        return;
      }
      const row = res.data;
      setMatchRowLite(
        row
          ? {
              id: row.id,
              status: row.status ?? null,
              score_home: row.score_home ?? null,
              score_away: row.score_away ?? null,
              location: row.location ?? null,
              period_scores: row.period_scores ?? null,
            }
          : null,
      );

      const { data, error } = await supabase
        .from('match_events')
        .select('id, match_id, type, minute, period, player_id, created_at')
        .eq('match_id', mid)
        .order('minute', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        setMatchEvents([]);
        setMatchError(error.message);
        setMatchLoading(false);
        return;
      }
      setMatchEvents((data ?? []) as MatchEventRow[]);
      setMatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.match_id, isFinishedMatchEvent]);

  useEffect(() => {
    if (!isFinishedMatchEvent) return;
    setManualScoreHome(String(Math.max(0, Number(matchRowLite?.score_home ?? 0) || 0)));
    setManualScoreAway(String(Math.max(0, Number(matchRowLite?.score_away ?? 0) || 0)));
  }, [isFinishedMatchEvent, matchRowLite?.score_home, matchRowLite?.score_away]);

  useEffect(() => {
    if (!isFinishedMatchEvent || !event?.match_id) return;
    let cancelled = false;
    setLineupLoading(true);
    setLineupError(null);
    (async () => {
      const [lineupRes, benchRes] = await Promise.all([
        supabase.from('match_lineup').select('player_id, slot').eq('match_id', event.match_id!),
        supabase.from('match_bench').select('player_id').eq('match_id', event.match_id!),
      ]);
      if (cancelled) return;
      if (lineupRes.error) {
        setLineupRows([]);
        setBenchRows([]);
        setLineupError(lineupRes.error.message);
        setLineupLoading(false);
        return;
      }
      if (benchRes.error) {
        setLineupRows((lineupRes.data ?? []) as Array<{ player_id: string | null; slot: string | null }>);
        setBenchRows([]);
        setLineupError(benchRes.error.message);
        setLineupLoading(false);
        return;
      }
      setLineupRows((lineupRes.data ?? []) as Array<{ player_id: string | null; slot: string | null }>);
      setBenchRows((benchRes.data ?? []) as Array<{ player_id: string | null }>);
      setLineupLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.match_id, isFinishedMatchEvent]);

  const recomputeTotalsFromMatchEvents = useCallback((rows: MatchEventRow[]) => {
    const home = rows.filter((r) => String(r.type ?? '').toLowerCase() === 'goal').length;
    const away = rows.filter((r) => String(r.type ?? '').toLowerCase() === 'goal_away').length;
    return { home, away };
  }, []);

  const periodLine = useMemo(() => {
    if (!matchRowLite) return null;
    try {
      // Prefer DB period_scores if present (LiveScreen), fallback to pause-delimited from event log.
      if (matchRowLite.period_scores != null) {
        // Keep display simple: LiveScreen already uses parsePeriodScores; here we just show fallback line.
        // (Wir vermeiden hier großen Import/Refactor.)
      }
      const engineLike = matchEvents
        .map((r) => {
          const ts = Math.max(0, Number(r.minute ?? 0) || 0);
          const type = String(r.type ?? '').trim();
          if (type === 'kickoff') return { id: r.id, type: 'start' as const, timestamp: ts, playerId: undefined };
          if (type === 'final_whistle') return { id: r.id, type: 'end' as const, timestamp: ts, playerId: undefined };
          if (type === 'period_start') return { id: r.id, type: 'resume' as const, timestamp: ts, playerId: undefined };
          if (type === 'period_end') return { id: r.id, type: 'pause' as const, timestamp: ts, playerId: undefined };
          if (type === 'goal_away') return { id: r.id, type: 'goal' as const, timestamp: ts, playerId: undefined };
          if (type === 'goal') return { id: r.id, type: 'goal' as const, timestamp: ts, playerId: r.player_id ?? undefined };
          if (type === 'sub_out') return { id: r.id, type: 'sub_out' as const, timestamp: ts, playerId: r.player_id ?? undefined };
          if (type === 'sub_in') return { id: r.id, type: 'sub_in' as const, timestamp: ts, playerId: r.player_id ?? undefined };
          return null;
        })
        .filter(Boolean) as Array<{ id: string; type: any; timestamp: number; playerId?: string }>;
      if (engineLike.length === 0) return null;
      return buildPauseDelimitedPeriodScoreLine(engineLike as any, true);
    } catch {
      return null;
    }
  }, [matchEvents, matchRowLite]);

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

  if (isFinishedMatchEvent) {
    const opponentName = (event.opponent ?? 'Gegner').trim() || 'Gegner';
    const scoreHome = matchRowLite?.score_home ?? null;
    const scoreAway = matchRowLite?.score_away ?? null;
    const venue = (() => {
      const parsed = splitCombinedLocation(matchRowLite?.location ?? event.location ?? '');
      return (parsed.place ?? '').trim() || (matchRowLite?.location ?? event.location ?? '').trim() || null;
    })();
    const homeAway = event.is_home === true ? 'Heim' : event.is_home === false ? 'Auswärts' : null;
    const compactOurTeamName = compactTeamNameForMatchHeader(ourTeamName);

    const renderTabButton = (id: 'overview' | 'lineup' | 'timeline' | 'stats', label: string) => (
      <button
        type="button"
        onClick={() => setFinishedTab(id)}
        className={[
          'shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-[12px] font-medium transition-all min-h-[32px]',
          finishedTab === id
            ? 'border-red-400/30 bg-white/[0.1] font-semibold text-white shadow-[0_0_10px_rgba(220,38,38,0.16)]'
            : 'border-transparent text-white/75 hover:bg-white/[0.04] hover:text-white/90',
        ].join(' ')}
      >
        {label}
      </button>
    );

    const minuteLabel = (seconds: number | null) => {
      const s = Math.max(0, Number(seconds ?? 0) || 0);
      const m = Math.max(0, Math.floor(s / 60));
      return `${m}'`;
    };

    const playerName = (playerId: string | null) => {
      if (!playerId) return null;
      const p = players.find((x) => x.id === playerId);
      return (p?.display_name ?? p?.name ?? '').trim() || null;
    };

    const timelineEvents = matchEvents;
    const periodLineFromInputs =
      p1h !== '' && p1a !== '' && p2h !== '' && p2a !== '' && p3h !== '' && p3a !== ''
        ? `(${p1h}:${p1a} | ${p2h}:${p2a} | ${p3h}:${p3a})`
        : null;
    const shownPeriodLine = periodLineFromInputs || periodLine;
    const ownGoalScorerEntries = timelineEvents
      .filter((r) => String(r.type ?? '').toLowerCase() === 'goal' && r.player_id)
      .map((r) => {
        const n = playerName(r.player_id) ?? null;
        if (!n) return null;
        const m = Math.max(0, Math.floor((Number(r.minute ?? 0) || 0) / 60));
        return { text: `${n} ${m}'`, minute: m };
      })
      .filter((x): x is { text: string; minute: number } => Boolean(x));
    const shownOwnGoalScorers = ownGoalScorerEntries.slice(0, 4).map((x) => x.text);
    const ownGoalScorersMore = Math.max(0, ownGoalScorerEntries.length - shownOwnGoalScorers.length);

    const finishedHeroBadge = (
      <span className="shrink-0 rounded-md border border-red-950/80 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-red-300/95">
        Beendet
      </span>
    );

    const finishedHeroFooter = (
      <div className="w-full space-y-1.5">
        {shownPeriodLine ? (
          <p className="text-center text-[13px] tabular-nums text-white/50">{shownPeriodLine}</p>
        ) : null}
        {shownOwnGoalScorers.length > 0 ? (
          <p className="text-center text-[12px] leading-snug text-white/60">
            <span className="text-white/72">⚽ Tore {compactOurTeamName}:</span>{' '}
            <span className="line-clamp-2 text-white/85">
              {shownOwnGoalScorers.join(', ')}
              {ownGoalScorersMore > 0 ? `, … und ${ownGoalScorersMore} weitere` : ''}
            </span>
          </p>
        ) : null}
        {isTrainerOrAdmin ? (
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={() => setScoreEditOpen(true)}
              className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/[0.08]"
            >
              Ergebnis ändern
            </button>
          </div>
        ) : null}
      </div>
    );

    const goalCount = timelineEvents.filter((r) => {
      const t = String(r.type ?? '').toLowerCase();
      return t === 'goal' || t === 'goal_away';
    }).length;
    const subCount = timelineEvents.filter((r) => {
      const t = String(r.type ?? '').toLowerCase();
      return t === 'sub_out' || t === 'sub_in';
    }).length;
    const totalEvents = timelineEvents.length;
    const tickerRows = (() => {
      const rows: Array<{ key: string; items: MatchEventRow[] }> = [];
      let i = 0;
      while (i < timelineEvents.length) {
        const cur = timelineEvents[i];
        const next = timelineEvents[i + 1];
        const ct = String(cur?.type ?? '').toLowerCase();
        const nt = String(next?.type ?? '').toLowerCase();
        const cmin = Number(cur?.minute ?? 0);
        const nmin = Number(next?.minute ?? 0);
        if (ct === 'sub_out' && nt === 'sub_in' && cmin === nmin) {
          rows.push({ key: `subpair_${cur.id}_${next.id}`, items: [cur, next] });
          i += 2;
          continue;
        }
        rows.push({ key: cur.id, items: [cur] });
        i += 1;
      }
      return rows;
    })();
    const scoreBadgeByEventId = (() => {
      let h = 0;
      let a = 0;
      const map = new Map<string, string>();
      for (const ev of timelineEvents) {
        const t = String(ev.type ?? '').toLowerCase();
        if (t === 'goal') {
          h += 1;
          map.set(ev.id, `${h}:${a}`);
        } else if (t === 'goal_away') {
          a += 1;
          map.set(ev.id, `${h}:${a}`);
        }
      }
      return map;
    })();

    const reloadMatchEvents = async (): Promise<MatchEventRow[] | null> => {
      if (!event.match_id) return null;
      const { data, error: fetchErr } = await supabase
        .from('match_events')
        .select('id, match_id, type, minute, period, player_id, created_at')
        .eq('match_id', event.match_id)
        .order('minute', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });
      if (fetchErr) {
        setMatchError(fetchErr.message);
        return null;
      }
      const rows = (data ?? []) as MatchEventRow[];
      setMatchEvents(rows);
      return rows;
    };

    const syncScoreFromEvents = async (rows: MatchEventRow[]) => {
      if (!event.match_id) return;
      const totals = recomputeTotalsFromMatchEvents(rows);
      const { error: updErr } = await updateMatchRow(event.match_id, {
        score_home: totals.home,
        score_away: totals.away,
      });
      if (updErr) setMatchError(updErr);
      setMatchRowLite((prev) =>
        prev ? { ...prev, score_home: totals.home, score_away: totals.away } : prev,
      );
      setManualScoreHome(String(totals.home));
      setManualScoreAway(String(totals.away));
    };

    const addGoal = async () => {
      if (!event.match_id) return;
      const minute = Math.max(0, Number(goalMinute.trim()) || 0);
      const seconds = Math.max(0, (minute > 0 ? minute - 1 : 0) * 60);
      try {
        setMatchError(null);
        const dbType = goalTeam === 'away' ? 'goal_away' : 'goal';
        const { error: insErr } = await supabase.from('match_events').insert({
          match_id: event.match_id,
          type: dbType,
          minute: seconds,
          period: null,
          player_id: goalPlayerId.trim() || null,
        });
        if (insErr) {
          setMatchError(insErr.message);
          return;
        }
        const rows = await reloadMatchEvents();
        if (!rows) return;
        await syncScoreFromEvents(rows);
        setGoalMinute('');
        setGoalPlayerId('');
      } catch (e: any) {
        console.error('[FinishedMatchReport] addGoal', e);
        setMatchError(e?.message ?? 'Speichern fehlgeschlagen.');
      }
    };

    const deleteTickerRow = async (items: MatchEventRow[]) => {
      if (!event.match_id || items.length === 0) return;
      const ids = items.map((x) => x.id);
      const didTouchGoals = items.some((x) => {
        const t = String(x.type ?? '').toLowerCase();
        return t === 'goal' || t === 'goal_away';
      });
      const { error: delErr } = await supabase.from('match_events').delete().in('id', ids);
      if (delErr) {
        setMatchError(delErr.message);
        return;
      }
      const rows = await reloadMatchEvents();
      if (!rows) return;
      if (didTouchGoals) await syncScoreFromEvents(rows);
    };

    const saveManualScore = async () => {
      if (!event.match_id) return;
      const sh = Math.max(0, Number(manualScoreHome.trim()) || 0);
      const sa = Math.max(0, Number(manualScoreAway.trim()) || 0);
      const { error: updErr } = await updateMatchRow(event.match_id, {
        score_home: sh,
        score_away: sa,
      });
      if (updErr) {
        setMatchError(updErr);
        return;
      }
      setMatchRowLite((prev) => (prev ? { ...prev, score_home: sh, score_away: sa } : prev));
    };

    const beginEditEvent = (r: MatchEventRow) => {
      setEditingEventId(r.id);
      setEditEventMinute(String(Math.max(0, Math.floor((Number(r.minute ?? 0) || 0) / 60))));
      const t = String(r.type ?? '').toLowerCase();
      if (t === 'goal_away') setEditEventType('goal_away');
      else if (t === 'sub_out' || t === 'sub_in') setEditEventType('switch');
      else setEditEventType('goal_home');
      setEditEventPlayerId((t === 'goal' || t === 'goal_away') ? (r.player_id ?? '') : '');
      if (t === 'sub_out' || t === 'sub_in') {
        const sameMinute = timelineEvents.filter((x) => Number(x.minute ?? 0) === Number(r.minute ?? 0));
        const out = sameMinute.find((x) => String(x.type ?? '').toLowerCase() === 'sub_out');
        const inn = sameMinute.find((x) => String(x.type ?? '').toLowerCase() === 'sub_in');
        setEditSwitchOutPlayerId(out?.player_id ?? '');
        setEditSwitchInPlayerId(inn?.player_id ?? '');
      } else {
        setEditSwitchOutPlayerId('');
        setEditSwitchInPlayerId('');
      }
    };

    const saveEventEdit = async () => {
      if (!editingEventId) return;
      const minute = Math.max(0, Number(editEventMinute.trim()) || 0);
      const seconds = Math.max(0, (minute > 0 ? minute - 1 : 0) * 60);
      const old = timelineEvents.find((x) => x.id === editingEventId);
      const oldType = String(old?.type ?? '').toLowerCase();
      let didTouchGoals = oldType === 'goal' || oldType === 'goal_away';

      if (editEventType === 'switch') {
        const companionIds = timelineEvents
          .filter(
            (x) =>
              x.id !== editingEventId &&
              Number(x.minute ?? 0) === Number(old?.minute ?? 0) &&
              ['sub_out', 'sub_in'].includes(String(x.type ?? '').toLowerCase()),
          )
          .map((x) => x.id);
        if (companionIds.length > 0) {
          const { error } = await supabase.from('match_events').delete().in('id', companionIds);
          if (error) {
            setMatchError(error.message);
            return;
          }
        }
        const { error: delErr } = await supabase.from('match_events').delete().eq('id', editingEventId);
        if (delErr) {
          setMatchError(delErr.message);
          return;
        }
        const payloads: Array<{ match_id: string; type: string; minute: number; period: null; player_id: string | null }> = [];
        if (editSwitchOutPlayerId.trim()) {
          payloads.push({
            match_id: event.match_id!,
            type: 'sub_out',
            minute: seconds,
            period: null,
            player_id: editSwitchOutPlayerId.trim(),
          });
        }
        if (editSwitchInPlayerId.trim()) {
          payloads.push({
            match_id: event.match_id!,
            type: 'sub_in',
            minute: seconds,
            period: null,
            player_id: editSwitchInPlayerId.trim(),
          });
        }
        if (payloads.length > 0) {
          const { error: insErr } = await supabase.from('match_events').insert(payloads);
          if (insErr) {
            setMatchError(insErr.message);
            return;
          }
        }
      } else {
        const newDbType = editEventType === 'goal_away' ? 'goal_away' : 'goal';
        didTouchGoals = didTouchGoals || newDbType === 'goal' || newDbType === 'goal_away';
        const { error: updErr } = await supabase
          .from('match_events')
          .update({
            minute: seconds,
            type: newDbType,
            player_id: editEventPlayerId.trim() || null,
          })
          .eq('id', editingEventId);
        if (updErr) {
          setMatchError(updErr.message);
          return;
        }
      }
      const rows = await reloadMatchEvents();
      if (!rows) return;
      if (didTouchGoals) {
        await syncScoreFromEvents(rows);
      }
      setEditingEventId(null);
    };

    return (
      <div className="min-h-screen text-white [background:linear-gradient(180deg,rgba(40,5,5,0.97)_0%,rgba(20,0,0,0.98)_55%,rgba(10,0,0,0.99)_100%)]">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-4">
          <div className="flex flex-col gap-3">
            <Link to="/app/termine" className="text-[14px] text-white/80 hover:text-white">
              ← Zurück zum Spielplan
            </Link>
          </div>

          <div className="mb-4 -mx-3.5 w-[calc(100%+1.75rem)] max-w-none sm:mx-0 sm:w-full sm:max-w-full">
            <EventHeroCard label="Spielbericht" labelAside={finishedHeroBadge} footer={finishedHeroFooter}>
              <MatchCardLigaportal
                className="w-full max-w-full !px-2.5 !py-2.5 sm:!px-3 sm:!py-3"
                scheduleNextMatchHero
                ourTeamName={ourTeamName}
                opponent={opponentName}
                isHome={event.is_home}
                startsAt={event.starts_at}
                status={'finished'}
                kind={event.kind}
                eventType={(event as any).type ?? undefined}
                matchType={
                  event.kind === 'match'
                    ? (event.match_type ?? (!event.type || event.type === 'game' ? 'league' : event.type))
                    : null
                }
                notes={event.notes}
                location={event.location}
                address={event.location}
                meetupAt={null}
                showMeetup={false}
                scoreHome={scoreHome}
                scoreAway={scoreAway}
                opponentLogoUrl={opponentLogo.trim() ? opponentLogo.trim() : null}
                isPublicView={true}
              />
            </EventHeroCard>
          </div>

          <div className="flex justify-center">
            <div className="inline-flex min-h-[36px] w-full max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/15 bg-black/25 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {renderTabButton('overview', 'Übersicht')}
              {renderTabButton('lineup', 'Kader')}
              {renderTabButton('timeline', 'Ticker')}
              {renderTabButton('stats', 'Stats')}
            </div>
          </div>

          {matchLoading ? <p className="text-sm text-white/70">Lade Spielbericht…</p> : null}
          {matchError ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-950/40 p-3 text-sm text-red-100">
              {matchError}
            </div>
          ) : null}

          {finishedTab === 'overview' ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/60">Spielbericht</p>
              <div className="mt-1 divide-y divide-white/[0.07] text-[14px]">
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">⚽ Ergebnis</span>
                  <span className="text-right font-semibold text-white/95 tabular-nums">
                    {(scoreHome ?? 0)} : {(scoreAway ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">🕒 Datum</span>
                  <span className="max-w-[min(100%,14rem)] text-right text-white/90 sm:max-w-none">
                    {formatEventDateTimeLabel(event.starts_at)}
                  </span>
                </div>
                {venue ? (
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <span className="shrink-0 text-white/70">📍 Spielort</span>
                    <span className="max-w-[min(100%,14rem)] text-right text-white/90 sm:max-w-none">{venue}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">🏟 Heim/Auswärts</span>
                  <span className="text-white/90">{homeAway ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">⚽ Tore</span>
                  <span className="tabular-nums text-white/90">{goalCount}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">🔁 Wechsel</span>
                  <span className="tabular-nums text-white/90">{subCount}</span>
                </div>
              </div>
              {isTrainerOrAdmin ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setReportEditOpen(true)}
                    className="w-full rounded-2xl border border-red-500/35 bg-red-600/20 px-4 py-3 text-[13px] font-extrabold text-red-100 shadow-[0_0_18px_rgba(220,38,38,0.22)] hover:bg-red-600/25 active:scale-[0.99]"
                  >
                    Spielbericht bearbeiten
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {finishedTab === 'lineup' ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/60">Kader</p>
              {lineupLoading ? <p className="mt-2 text-[14px] text-white/70">Lade Aufstellung…</p> : null}
              {lineupError ? <p className="mt-2 text-[14px] text-red-200">{lineupError}</p> : null}
              {!lineupLoading && !lineupError ? (
                lineupRows.length === 0 && benchRows.length === 0 ? (
                  <p className="mt-2 text-[14px] text-white/70">Keine Aufstellung gespeichert.</p>
                ) : (
                  <div className="mt-2 grid gap-3">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-white/55">Startelf</p>
                      <ul className="mt-1.5 space-y-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-2 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                        {lineupRows.map((r, idx) => {
                          const p = players.find((x) => x.id === r.player_id);
                          return (
                            <li key={`${r.player_id ?? 'na'}-${idx}`}>
                              <MatchPlayerRow
                                player={{
                                  id: r.player_id ?? `lineup-${idx}`,
                                  display_name: p?.display_name ?? p?.name ?? 'Spieler',
                                  name: p?.name ?? p?.display_name ?? 'Spieler',
                                  position: p?.position ?? null,
                                  avatar_url: p?.avatar_url ?? null,
                                  jersey_number: p?.jersey_number ?? null,
                                }}
                                rightLabel={(r.slot ?? '').trim() || null}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-white/55">Bank</p>
                      <ul className="mt-1.5 space-y-2 rounded-2xl border border-white/10 bg-black/25 p-2 shadow-[0_0_16px_rgba(0,0,0,0.35)]">
                        {benchRows.map((r, idx) => {
                          const p = players.find((x) => x.id === r.player_id);
                          return (
                            <li key={`${r.player_id ?? 'na'}-${idx}`}>
                              <MatchPlayerRow
                                player={{
                                  id: r.player_id ?? `bench-${idx}`,
                                  display_name: p?.display_name ?? p?.name ?? 'Spieler',
                                  name: p?.name ?? p?.display_name ?? 'Spieler',
                                  position: p?.position ?? null,
                                  avatar_url: p?.avatar_url ?? null,
                                  jersey_number: p?.jersey_number ?? null,
                                }}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          ) : null}

          {finishedTab === 'stats' ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/60">Stats</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
                <div className="rounded-xl border border-white/12 bg-gradient-to-br from-black/50 to-red-950/25 px-3 py-3 shadow-[0_0_16px_rgba(220,38,38,0.12)]">
                  <p className="text-[11px] font-medium text-white/55">Tore Heim</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{scoreHome ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/12 bg-gradient-to-br from-black/50 to-red-950/25 px-3 py-3 shadow-[0_0_16px_rgba(220,38,38,0.12)]">
                  <p className="text-[11px] font-medium text-white/55">Tore Auswärts</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{scoreAway ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/12 bg-gradient-to-br from-black/50 to-red-950/25 px-3 py-3 shadow-[0_0_16px_rgba(220,38,38,0.12)]">
                  <p className="text-[11px] font-medium text-white/55">Wechsel</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{subCount}</p>
                </div>
                <div className="rounded-xl border border-white/12 bg-gradient-to-br from-black/50 to-red-950/25 px-3 py-3 shadow-[0_0_16px_rgba(220,38,38,0.12)]">
                  <p className="text-[11px] font-medium text-white/55">Ereignisse</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{totalEvents}</p>
                </div>
                <div className="rounded-xl border border-white/12 bg-gradient-to-br from-black/50 to-red-950/25 px-3 py-3 shadow-[0_0_16px_rgba(220,38,38,0.12)]">
                  <p className="text-[11px] font-medium text-white/55">Torschützen</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{ownGoalScorerEntries.length}</p>
                </div>
                <div className="rounded-xl border border-white/12 bg-gradient-to-br from-black/50 to-red-950/25 px-3 py-3 shadow-[0_0_16px_rgba(220,38,38,0.12)]">
                  <p className="text-[11px] font-medium text-white/55">Gelbe Karten</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">
                    {timelineEvents.filter((x) => ['yellow_card', 'card_yellow', 'yellow'].includes(String(x.type ?? '').toLowerCase())).length}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {finishedTab === 'timeline' ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/60">Liveticker</p>
                <span className="text-[12px] text-white/45">{timelineEvents.length} Ereignisse</span>
              </div>
              {timelineEvents.length === 0 ? (
                <p className="text-[14px] text-white/70">Noch keine Ereignisse erfasst.</p>
              ) : (
                <ul className="space-y-2">
                  {tickerRows.map((row, index) => {
                    const r = row.items[0];
                    const t = String(r.type ?? '').toLowerCase();
                    const isPairSwitch =
                      row.items.length === 2 &&
                      String(row.items[0]?.type ?? '').toLowerCase() === 'sub_out' &&
                      String(row.items[1]?.type ?? '').toLowerCase() === 'sub_in';
                    const isSwitch = isPairSwitch || t === 'sub_out' || t === 'sub_in';
                    const name = playerName(r.player_id);
                    const switchOutName = isPairSwitch
                      ? playerName(row.items[0]?.player_id ?? null)
                      : t === 'sub_out'
                        ? name
                        : null;
                    const switchInName = isPairSwitch
                      ? playerName(row.items[1]?.player_id ?? null)
                      : t === 'sub_in'
                        ? name
                        : null;
                    const scoreBadge = scoreBadgeByEventId.get(r.id) ?? null;
                    const isLast = index === tickerRows.length - 1;
                    const isGoalEv = t === 'goal' || t === 'goal_away';
                    const isYellow = ['yellow_card', 'card_yellow', 'yellow'].includes(t);
                    const isRedCard = ['red_card', 'card_red', 'red'].includes(t);
                    const eventCardClass = [
                      'min-w-0 flex-1 rounded-2xl bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-black px-3 py-2.5',
                      isGoalEv
                        ? 'border border-red-500/30 shadow-[0_0_22px_rgba(220,38,38,0.22)]'
                        : isSwitch
                          ? 'border border-white/[0.08] shadow-[0_6px_24px_rgba(0,0,0,0.4)]'
                          : isYellow
                            ? 'border border-amber-400/25 shadow-[0_0_14px_rgba(245,158,11,0.14)]'
                            : isRedCard
                              ? 'border border-red-500/35 shadow-[0_0_14px_rgba(220,38,38,0.18)]'
                              : 'border border-white/[0.08] shadow-[0_6px_28px_rgba(0,0,0,0.35)]',
                    ].join(' ');
                    return (
                      <li key={row.key} className="flex gap-2 pb-2 last:pb-0">
                        <div className="w-12 shrink-0 pt-0.5 text-right text-[15px] font-black tabular-nums leading-none text-red-200/90">
                          {minuteLabel(r.minute)}
                        </div>
                        <div className="relative flex w-3 shrink-0 flex-col items-center pt-1">
                          {!isLast ? (
                            <div className="absolute bottom-0 left-1/2 top-2 w-px -translate-x-1/2 bg-red-600/35" />
                          ) : null}
                          <div className="relative z-10 mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                        </div>
                        <div className={eventCardClass}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {isSwitch ? (
                                <>
                                  <p className="text-[10px] font-black uppercase tracking-wide text-sky-300">🔁 Wechsel</p>
                                  {switchOutName || switchInName ? (
                                    <div className="mt-1.5 space-y-0.5">
                                      <p className="text-[12px] font-semibold leading-snug text-red-200/95">
                                        Raus · {switchOutName ?? '—'}
                                      </p>
                                      <p className="py-0.5 text-center text-[11px] text-white/40">↓</p>
                                      <p className="text-[12px] font-semibold leading-snug text-emerald-300/95">
                                        Rein · {switchInName ?? '—'}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-[13px] text-white/75">Wechsel</p>
                                  )}
                                </>
                              ) : t === 'goal' || t === 'goal_away' ? (
                                <>
                                  <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">
                                    ⚽ {t === 'goal' ? 'Tor Heim' : 'Tor Auswärts'}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-white">
                                    {name ?? (t === 'goal_away' ? opponentName : compactOurTeamName)}
                                  </p>
                                </>
                              ) : isYellow ? (
                                <>
                                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-300">🟨 Gelb</p>
                                  <p className="mt-1 line-clamp-2 text-sm font-bold text-white">{name ?? 'Spieler'}</p>
                                </>
                              ) : isRedCard ? (
                                <>
                                  <p className="text-[10px] font-black uppercase tracking-wide text-red-300">🟥 Rot</p>
                                  <p className="mt-1 line-clamp-2 text-sm font-bold text-white">{name ?? 'Spieler'}</p>
                                </>
                              ) : (
                                <p className="text-[13px] font-semibold leading-snug text-gray-200">
                                  {t === 'period_end'
                                    ? 'Pause'
                                    : t === 'period_start'
                                      ? 'Start'
                                      : t === 'final_whistle'
                                        ? 'Abpfiff'
                                        : t === 'kickoff'
                                          ? 'Anpfiff'
                                          : 'Info'}
                                </p>
                              )}
                            </div>
                            {scoreBadge ? (
                              <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white/90">
                                {scoreBadge}
                              </span>
                            ) : null}
                          </div>
                          {isTrainerOrAdmin ? (
                            <div className="mt-2 flex justify-end gap-1.5">
                              <button
                                type="button"
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.07]"
                                onClick={() => {
                                  beginEditEvent(r);
                                  setReportEditOpen(true);
                                }}
                                title="Ereignis bearbeiten"
                              >
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.07]"
                                onClick={() => void deleteTickerRow(row.items)}
                                title="Ereignis löschen"
                              >
                                Löschen
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          <Modal
            isOpen={scoreEditOpen}
            title="Ergebnis ändern"
            onClose={() => setScoreEditOpen(false)}
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setScoreEditOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    await saveManualScore();
                    setScoreEditOpen(false);
                  }}
                >
                  Speichern
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] text-white/60">Heimtore</span>
                  <input
                    value={manualScoreHome}
                    onChange={(e) => setManualScoreHome(e.target.value)}
                    inputMode="numeric"
                    className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] text-white/60">Auswärtstore</span>
                  <input
                    value={manualScoreAway}
                    onChange={(e) => setManualScoreAway(e.target.value)}
                    inputMode="numeric"
                    className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                  />
                </label>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/55">Abschnitte (optional)</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">A1 Heim</span>
                  <input value={p1h} onChange={(e) => setP1h(e.target.value)} inputMode="numeric" className="h-9 rounded-xl border border-white/10 bg-black/40 px-2.5 text-[13px] text-white/90" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">A2 Heim</span>
                  <input value={p2h} onChange={(e) => setP2h(e.target.value)} inputMode="numeric" className="h-9 rounded-xl border border-white/10 bg-black/40 px-2.5 text-[13px] text-white/90" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">A3 Heim</span>
                  <input value={p3h} onChange={(e) => setP3h(e.target.value)} inputMode="numeric" className="h-9 rounded-xl border border-white/10 bg-black/40 px-2.5 text-[13px] text-white/90" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">A1 Ausw.</span>
                  <input value={p1a} onChange={(e) => setP1a(e.target.value)} inputMode="numeric" className="h-9 rounded-xl border border-white/10 bg-black/40 px-2.5 text-[13px] text-white/90" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">A2 Ausw.</span>
                  <input value={p2a} onChange={(e) => setP2a(e.target.value)} inputMode="numeric" className="h-9 rounded-xl border border-white/10 bg-black/40 px-2.5 text-[13px] text-white/90" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">A3 Ausw.</span>
                  <input value={p3a} onChange={(e) => setP3a(e.target.value)} inputMode="numeric" className="h-9 rounded-xl border border-white/10 bg-black/40 px-2.5 text-[13px] text-white/90" />
                </label>
              </div>
            </div>
          </Modal>

          <Modal
            isOpen={reportEditOpen}
            title="Spielbericht bearbeiten"
            onClose={() => setReportEditOpen(false)}
            footer={
              <Button variant="ghost" onClick={() => setReportEditOpen(false)}>
                Schließen
              </Button>
            }
          >
            <div className="space-y-4">

              {editingEventId ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Ereignis bearbeiten</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-white/60">Minute</span>
                      <input
                        value={editEventMinute}
                        onChange={(e) => setEditEventMinute(e.target.value)}
                        inputMode="numeric"
                        className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-white/60">Typ</span>
                      <select
                        value={editEventType}
                        onChange={(e) =>
                          setEditEventType(
                            (['goal_home', 'goal_away', 'switch'] as const).includes(
                              e.target.value as any,
                            )
                              ? (e.target.value as any)
                              : 'goal_home',
                          )
                        }
                        className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                      >
                        <option value="goal_home">Tor Heim</option>
                        <option value="goal_away">Tor Auswärts</option>
                        <option value="switch">Wechsel</option>
                      </select>
                    </label>
                  </div>
                  {editEventType === 'switch' ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] text-white/60">Spieler raus</span>
                        <select
                          value={editSwitchOutPlayerId}
                          onChange={(e) => setEditSwitchOutPlayerId(e.target.value)}
                          className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                        >
                          <option value="">—</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {(p.display_name ?? p.name ?? 'Spieler').trim()}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] text-white/60">Spieler rein</span>
                        <select
                          value={editSwitchInPlayerId}
                          onChange={(e) => setEditSwitchInPlayerId(e.target.value)}
                          className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                        >
                          <option value="">—</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {(p.display_name ?? p.name ?? 'Spieler').trim()}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <label className="mt-2 flex flex-col gap-1">
                      <span className="text-[12px] text-white/60">Torschütze (optional)</span>
                      <select
                        value={editEventPlayerId}
                        onChange={(e) => setEditEventPlayerId(e.target.value)}
                        className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                      >
                        <option value="">—</option>
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.display_name ?? p.name ?? 'Spieler').trim()}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="ghost" onClick={() => setEditingEventId(null)}>
                      Abbrechen
                    </Button>
                    <Button variant="primary" onClick={() => void saveEventEdit()}>
                      Speichern
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Tor hinzufügen</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-white/60">Minute</span>
                    <input
                      value={goalMinute}
                      onChange={(e) => setGoalMinute(e.target.value)}
                      inputMode="numeric"
                      className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                      placeholder="z. B. 12"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-white/60">Team</span>
                    <select
                      value={goalTeam}
                      onChange={(e) => setGoalTeam(e.target.value === 'away' ? 'away' : 'home')}
                      className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                    >
                      <option value="home">Heim</option>
                      <option value="away">Auswärts</option>
                    </select>
                  </label>
                </div>
                <label className="mt-2 flex flex-col gap-1">
                  <span className="text-[12px] text-white/60">Torschütze (optional)</span>
                  <select
                    value={goalPlayerId}
                    onChange={(e) => setGoalPlayerId(e.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-[14px] text-white/90"
                  >
                    <option value="">—</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.display_name ?? p.name ?? 'Spieler').trim()}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="primary" className="mt-3 w-full" onClick={() => void addGoal()}>
                  Tor speichern
                </Button>
                <p className="mt-2 text-[12px] text-white/55">
                  Endstand wird automatisch aus den Toren neu berechnet.
                </p>
              </div>
            </div>
          </Modal>
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
          <div className="flex w-full flex-col gap-1 sm:w-auto sm:self-end">
            <AppButton
              variant="secondary"
              size="sm"
              className="w-full px-3 py-2 text-[13px] sm:w-auto"
              onClick={() => void handleAddSingleEventToCalendar()}
            >
              Diesen Termin hinzufügen
            </AppButton>
            <p className="text-[11px] leading-snug text-white/55 sm:text-right">
              Fügt nur diesen Termin deinem Kalender hinzu.
            </p>
          </div>
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
