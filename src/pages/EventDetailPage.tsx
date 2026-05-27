import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, ChevronRight, Navigation, Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { useAvailabilityPermissions } from '../hooks/useAvailabilityPermissions';
import { normalizeRole, canSeeMeetup, canManageMatches } from '../lib/roles';
import { deleteEventAndRelatedData } from '../lib/deleteEventCascade';
import { getClubLogo, getOurTeamDisplayName } from '../lib/teamLogos';
import { MatchCardLigaportal } from '../app/components/MatchCardLigaportal';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import { MatchPlayerRow } from '../components/match/MatchPlayerRow';
import { AppButton } from '../components/ui/AppButton';
import type { EventRow, EventKind, EventStatus } from '../hooks/useEvents';
import type { PlayerItem } from '../hooks/usePlayers';
import { downloadSingleEventFullCalendarIcs } from '../lib/ics';
import { isTrainingAbsenceDeadlinePassed } from '../lib/trainingAbsence';
import { upsertEventAttendanceMinimal } from '../lib/rsvp/writeEventAttendance';
import {
  resolveTrainingAttendanceStatus,
  trainingAttendanceToDb,
  type TrainingAttendanceStatus,
} from '../lib/trainingAttendance';
import { AudienceMatchdayDetailCard } from '../components/events/AudienceMatchdayDetailCard';
import { TrainingAttendancePanel } from '../components/events/TrainingAttendancePanel';
import { ScheduleEventActionsPanel } from '../components/schedule/ScheduleEventActionsPanel';
import { PremiumPlayerCard } from '../components/player/PremiumPlayerCard';
import { PremiumStatusBadge } from '../components/player/PremiumStatusBadge';
import {
  dsPrimaryCtaClass,
  dsRsvpChoiceClass,
  dsScheduleGlassButtonClass,
  dsSecondaryCtaClass,
  dsScheduleDetailCalendarRowClass,
  dsSchedulePageStyle,
  dsSectionLabelClass,
  dsStatusChipClass,
  dsTrainingDetailHeaderAtmosphereClass,
  DS_LIST_GAP,
  DS_STAT_GRID_GAP,
  type DsChipTone,
} from '../lib/premiumDesignSystem';
import { upsertMatchForSetup } from '../lib/liveMatchService';
import { fetchMatchById, updateMatchRow } from '../lib/liveMatchService';
import { buildPauseDelimitedPeriodScoreLine, type MatchEngineEvent } from '../lib/matchEngine';
import {
  countStadiumGoalsFromMatchEventRows,
  debugAssertMatchEventDbType,
  FINISHED_REPORT_MAX_MINUTE,
  finishedReportMinuteDbFromInput,
  finishedReportMinuteDisplayFromDb,
  finishedReportUncappedDisplayMinuteFromSeconds,
  formatPeriodScoresBracket,
  friendlyMatchEventWriteError,
  mapUiGoalTypeToMatchEventDbType,
  normalizeMatchEventGoalType,
  parsePeriodScores,
  sumPeriodScoresTriplet,
} from '../lib/matchEventScores';
import {
  MATCH_FEED_TEMPLATE_KEYS,
  MATCH_FEED_TEMPLATE_LABELS,
  normalizeMatchFeedTemplateKey,
  type MatchFeedTemplateKey,
} from '../features/home/feedTemplates';
import { combineLocationParts, splitCombinedLocation } from '../lib/eventLocation';
import { openMapsNavigation, resolveEventMapsCoords } from '../lib/mapsNavigation';
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

function extractAudienceTrainerNotes(notes: string | null | undefined): string | null {
  const parts = (notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.toLowerCase().startsWith('ende:'));
  if (parts.length === 0) return null;
  const text = parts.length > 1 ? parts.slice(1).join(' · ') : parts[0];
  return text.trim() || null;
}

function compactTeamNameForMatchHeader(name: string | null | undefined): string {
  let s = (name ?? '').trim();
  if (!s) return 'Team';
  s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim(); // remove season suffix
  s = s.replace(/^U\s*\d{1,2}\s+/i, '').trim(); // remove leading age-group
  s = s.replace(/^U\d{1,2}\s+/i, '').trim();
  return s || (name ?? '').trim() || 'Team';
}

function tokenLooksLikeAbbrev(token: string): boolean {
  const t = (token || '').trim();
  if (t.length < 2 || t.length > 8) return false;
  const plain = t.replace(/\./g, '');
  if (plain.length < 2) return false;
  if (/^[A-Z0-9.]+$/.test(t) && plain.length <= 6) return true;
  return /^[A-ZÄÖÜ]{2,6}$/.test(t);
}

function splitPrefixAndName(full: string): { prefix: string; name: string } {
  const trimmed = (full || '').trim();
  if (!trimmed) return { prefix: '', name: '' };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { prefix: '', name: trimmed };
  const first = parts[0];
  const last = parts[parts.length - 1];
  const firstIsAbbrev = tokenLooksLikeAbbrev(first);
  const lastIsAbbrev = tokenLooksLikeAbbrev(last);
  if (firstIsAbbrev && !lastIsAbbrev) return { prefix: first, name: parts.slice(1).join(' ') };
  if (lastIsAbbrev && !firstIsAbbrev) return { prefix: last, name: parts.slice(0, -1).join(' ') };
  return { prefix: first, name: parts.slice(1).join(' ') };
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

type AttendanceBucket = 'open' | 'yes' | 'no';

function bucketRank(s: AttendanceBucket): number {
  // Trainer-Flow: Offen zuerst, dann Dabei, dann Abwesend.
  return s === 'open' ? 0 : s === 'yes' ? 1 : 2;
}

function statusBucket(getStatus: (playerId: string) => 'yes' | 'no' | null, playerId: string): AttendanceBucket {
  const s = getStatus(playerId);
  return s === 'yes' ? 'yes' : s === 'no' ? 'no' : 'open';
}

function comparePlayersInBucket(a: PlayerItem, b: PlayerItem): number {
  const an = a.jersey_number != null ? Number(a.jersey_number) : null;
  const bn = b.jersey_number != null ? Number(b.jersey_number) : null;
  if (an != null && bn != null && an !== bn) return an - bn;
  if (an != null && bn == null) return -1;
  if (an == null && bn != null) return 1;

  const aLast = (a.last_name ?? '').trim().toLocaleLowerCase('de-AT');
  const bLast = (b.last_name ?? '').trim().toLocaleLowerCase('de-AT');
  const byLast = aLast.localeCompare(bLast, 'de-AT');
  if (byLast !== 0) return byLast;

  const aFirst = (a.first_name ?? '').trim().toLocaleLowerCase('de-AT');
  const bFirst = (b.first_name ?? '').trim().toLocaleLowerCase('de-AT');
  const byFirst = aFirst.localeCompare(bFirst, 'de-AT');
  if (byFirst !== 0) return byFirst;

  return (a.display_name ?? '').trim().toLocaleLowerCase('de-AT').localeCompare((b.display_name ?? '').trim().toLocaleLowerCase('de-AT'), 'de-AT');
}

/** Sortierung RSVP-Spielerliste: OFFEN → DABEI → ABWESEND; innerhalb Gruppe: # aufsteigend, sonst Nachname/Vorname. */
function sortPlayersByRsvpBuckets(players: PlayerItem[], getStatus: (playerId: string) => 'yes' | 'no' | null): PlayerItem[] {
  return [...players].sort((a, b) => {
    const ba = statusBucket(getStatus, a.id);
    const bb = statusBucket(getStatus, b.id);
    const byBucket = bucketRank(ba) - bucketRank(bb);
    if (byBucket !== 0) return byBucket;
    return comparePlayersInBucket(a, b);
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
    payload?: unknown;
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
  const [pendingMatchEventDeletes, setPendingMatchEventDeletes] = useState<MatchEventRow[] | null>(null);
  const [matchEventSingleDeleteBusy, setMatchEventSingleDeleteBusy] = useState(false);
  const [reportEditOpen, setReportEditOpen] = useState(false);
  const [goalMinute, setGoalMinute] = useState(''); // Anzeige-Minute (1..)
  const [goalTeam, setGoalTeam] = useState<'stadium_home' | 'stadium_away'>('stadium_home');
  const [goalPlayerId, setGoalPlayerId] = useState<string>('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventMinute, setEditEventMinute] = useState('');
  const [editEventType, setEditEventType] = useState<'stadium_home' | 'stadium_away' | 'switch'>('stadium_home');
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
  const [newSwitchMinute, setNewSwitchMinute] = useState('');
  const [newSwitchOutPlayerId, setNewSwitchOutPlayerId] = useState('');
  const [newSwitchInPlayerId, setNewSwitchInPlayerId] = useState('');
  const [newCardMinute, setNewCardMinute] = useState('');
  const [newCardType, setNewCardType] = useState<'yellow_card' | 'red_card'>('yellow_card');
  const [newCardPlayerId, setNewCardPlayerId] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardMinute, setEditCardMinute] = useState('');
  const [editCardType, setEditCardType] = useState<'yellow_card' | 'red_card'>('yellow_card');
  const [editCardPlayerId, setEditCardPlayerId] = useState('');

  const [rsvpStatus, setRsvpStatus] = useState<'yes' | 'no' | 'injured' | null>(null);
  const [loadingRsvp, setLoadingRsvp] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  /** Für Trainer: alle Zu-/Absagen dieses Events aus event_attendance. */
  const [eventAttendanceByPlayerId, setEventAttendanceByPlayerId] = useState<
    Record<string, 'yes' | 'no' | 'injured' | 'external_training'>
  >({});
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
  /** Trainer/Chef/Co/Admin: Spielplan & Spielbericht (Membership-Rolle ist bereits normalisiert). */
  const canTrainerManageEvent = canManageMatches(effectiveRole);
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
        .select('id, match_id, type, minute, period, player_id, created_at, payload')
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

  const recomputeTotalsFromMatchEvents = useCallback((rows: MatchEventRow[]) => countStadiumGoalsFromMatchEventRows(rows), []);

  const parsedDbPeriodScores = useMemo(
    () => (isFinishedMatchEvent ? parsePeriodScores(matchRowLite?.period_scores) : null),
    [isFinishedMatchEvent, matchRowLite?.period_scores],
  );

  const periodLine = useMemo(() => {
    if (!matchRowLite) return null;
    try {
      const fromDb = parsePeriodScores(matchRowLite.period_scores);
      if (fromDb) return formatPeriodScoresBracket(fromDb);
      const engineLike = matchEvents
        .map((r) => {
          const ts = Math.max(0, Math.floor(Number(r.minute ?? 0) || 0));
          const type = String(r.type ?? '').trim();
          if (type === 'kickoff') return { id: r.id, type: 'start' as const, timestamp: ts, playerId: undefined };
          if (type === 'final_whistle') return { id: r.id, type: 'end' as const, timestamp: ts, playerId: undefined };
          if (type === 'period_start') return { id: r.id, type: 'resume' as const, timestamp: ts, playerId: undefined };
          if (type === 'period_end') return { id: r.id, type: 'pause' as const, timestamp: ts, playerId: undefined };
          const gEngine = normalizeMatchEventGoalType(r.type);
          if (gEngine === 'goal_away')
            return {
              id: r.id,
              type: 'goal_away' as const,
              timestamp: ts,
              playerId: r.player_id ?? undefined,
            };
          if (gEngine === 'goal')
            return { id: r.id, type: 'goal' as const, timestamp: ts, playerId: r.player_id ?? undefined };
          const tl = String(type).trim().toLowerCase();
          if (tl === 'sub_out' || tl === 'substitution_out')
            return { id: r.id, type: 'sub_out' as const, timestamp: ts, playerId: r.player_id ?? undefined };
          if (tl === 'sub_in' || tl === 'substitution_in')
            return { id: r.id, type: 'sub_in' as const, timestamp: ts, playerId: r.player_id ?? undefined };
          return null;
        })
        .filter(Boolean) as MatchEngineEvent[];
      if (engineLike.length === 0) return null;
      return buildPauseDelimitedPeriodScoreLine(engineLike, true);
    } catch {
      return null;
    }
  }, [matchEvents, matchRowLite]);

  /** Abgeschlossene Spiele: vollständige Abschnitte in DB → Endstand kommt aus Summe Abschnitte, nicht aus match_events. */
  const hasManualPeriodScores = Boolean(parsedDbPeriodScores);

  useEffect(() => {
    if (!reportEditOpen) return;
    const ps = matchRowLite?.period_scores;
    if (ps && typeof ps === 'object') {
      const o = ps as Record<string, unknown>;
      const fromPair = (k: string): [string, string] | null => {
        const v = o[k];
        if (!v || typeof v !== 'object') return null;
        const p = v as { h?: unknown; a?: unknown };
        const h = p.h;
        const a = p.a;
        if (h === undefined && a === undefined) return null;
        return [String(h ?? '0'), String(a ?? '0')];
      };
      const a = fromPair('p1');
      const b = fromPair('p2');
      const c = fromPair('p3');
      if (a && b && c) {
        setP1h(a[0]);
        setP1a(a[1]);
        setP2h(b[0]);
        setP2a(b[1]);
        setP3h(c[0]);
        setP3a(c[1]);
        return;
      }
      const legacyH = (key: string) => (o[key] !== undefined && o[key] !== null ? String(o[key]) : '');
      if (legacyH('p1h') !== '' || legacyH('p1a') !== '') {
        setP1h(legacyH('p1h'));
        setP1a(legacyH('p1a'));
        setP2h(legacyH('p2h'));
        setP2a(legacyH('p2a'));
        setP3h(legacyH('p3h'));
        setP3a(legacyH('p3a'));
        return;
      }
    }
    const match = /\((\d+):(\d+)\s*\|\s*(\d+):(\d+)\s*\|\s*(\d+):(\d+)\)/.exec(periodLine ?? '');
    if (!match) return;
    setP1h(match[1] ?? '');
    setP1a(match[2] ?? '');
    setP2h(match[3] ?? '');
    setP2a(match[4] ?? '');
    setP3h(match[5] ?? '');
    setP3a(match[6] ?? '');
  }, [periodLine, reportEditOpen, matchRowLite?.period_scores]);

  /** Endstand in DB an Tore (nur type goal / goal_away) angleichen — repariert alte falsche score_home/score_away. Läuft nicht bei manuellen Abschnitten. */
  useEffect(() => {
    if (!isFinishedMatchEvent || !event?.match_id || matchLoading) return;
    if (parsePeriodScores(matchRowLite?.period_scores)) return;
    const t = countStadiumGoalsFromMatchEventRows(matchEvents);
    const row = matchRowLite;
    if (!row) return;
    const sh = Number(row.score_home ?? 0);
    const sa = Number(row.score_away ?? 0);
    if (t.home === sh && t.away === sa) return;
    let cancelled = false;
    void (async () => {
      const { error } = await updateMatchRow(event.match_id!, { score_home: t.home, score_away: t.away });
      if (cancelled) return;
      if (!error) {
        setMatchRowLite((prev) => (prev ? { ...prev, score_home: t.home, score_away: t.away } : prev));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFinishedMatchEvent, event?.match_id, matchLoading, matchEvents, matchRowLite]);

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
    if (!event || event.kind !== 'match' || !canTrainerManageEvent || event.match_id) {
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
    canTrainerManageEvent,
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

      if (!err && data) {
        const st = String(data.status ?? '').toLowerCase();
        if (st === 'yes' || st === 'no' || st === 'injured' || st === 'external_training') {
          setRsvpStatus(st as 'yes' | 'no' | 'injured');
        } else {
          setRsvpStatus(null);
        }
      } else {
        setRsvpStatus(null);
      }
      setLoadingRsvp(false);
    };
    loadRsvp();
  }, [eventId, playerId]);

  const saveFeedSettings = useCallback(async () => {
    if (!eventId || !canTrainerManageEvent || event?.kind !== 'match') return;
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
    canTrainerManageEvent,
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
        const byPlayer: Record<string, 'yes' | 'no' | 'injured' | 'external_training'> = {};
        for (const row of data as { player_id: string; status: string }[]) {
          const pid = (row.player_id ?? '').toLowerCase();
          const st = String(row.status ?? '').toLowerCase();
          if (st === 'yes' || st === 'no' || st === 'injured' || st === 'external_training') {
            byPlayer[pid] = st as 'yes' | 'no' | 'injured' | 'external_training';
          }
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
      if (!eventId || !canTrainerManageEvent) return;
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
    [eventId, event?.kind, canTrainerManageEvent, loadEventAttendance]
  );

  const getAttendanceStatus = useCallback(
    (pid: string): 'yes' | 'no' | null => {
      const raw = eventAttendanceByPlayerId[(pid ?? '').toLowerCase()];
      if (raw === 'yes' || raw === 'no') return raw;
      return null;
    },
    [eventAttendanceByPlayerId],
  );

  const getTrainingAttendanceStatus = useCallback(
    (pid: string): TrainingAttendanceStatus =>
      resolveTrainingAttendanceStatus(
        eventAttendanceByPlayerId[(pid ?? '').toLowerCase()],
        event?.starts_at ?? null,
      ),
    [eventAttendanceByPlayerId, event?.starts_at],
  );

  const handleTrainerTrainingStatus = useCallback(
    async (targetPlayerId: string, next: TrainingAttendanceStatus) => {
      if (!eventId || !canTrainerManageEvent) return;
      const pidKey = (targetPlayerId ?? '').toLowerCase();
      const dbStatus = trainingAttendanceToDb(next);
      if (dbStatus === null) {
        const del = await supabase
          .from('event_attendance')
          .delete()
          .eq('event_id', eventId)
          .eq('player_id', targetPlayerId);
        if (del.error) return;
        setEventAttendanceByPlayerId((prev) => {
          const n = { ...prev };
          delete n[pidKey];
          return n;
        });
      } else {
        const result = await upsertEventAttendanceMinimal(supabase, {
          event_id: eventId,
          player_id: targetPlayerId,
          status: dbStatus,
        });
        if (result.error) return;
        setEventAttendanceByPlayerId((prev) => ({ ...prev, [pidKey]: dbStatus }));
      }
      await loadEventAttendance();
    },
    [eventId, canTrainerManageEvent, loadEventAttendance],
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
    if (!eventId || !canTrainerManageEvent || !event) return;
    setDeletingEvent(true);
    const { error: delErr } = await deleteEventAndRelatedData(event.id, event.match_id ?? null);
    setDeletingEvent(false);
    if (delErr) {
      alert(delErr);
      return;
    }
    setDeleteConfirmOpen(false);
    navigate('/app/termine');
  }, [eventId, event, canTrainerManageEvent, navigate]);

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
    const eventGoalTotals = countStadiumGoalsFromMatchEventRows(matchEvents);
    const displayedScore = hasManualPeriodScores
      ? sumPeriodScoresTriplet(parsedDbPeriodScores!)
      : eventGoalTotals;
    const scoreHome = displayedScore.home;
    const scoreAway = displayedScore.away;
    const venue = (() => {
      const parsed = splitCombinedLocation(matchRowLite?.location ?? event.location ?? '');
      return (parsed.place ?? '').trim() || (matchRowLite?.location ?? event.location ?? '').trim() || null;
    })();
    const homeAway = event.is_home === true ? 'Heim' : event.is_home === false ? 'Auswärts' : null;
    const compactOurTeamName = compactTeamNameForMatchHeader(ourTeamName);
    const compactOpponentName = compactTeamNameForMatchHeader(opponentName);
    /** Links im Spielbericht = Stadion-Heim → DB type goal; rechts = Stadion-Auswärts → goal_away (unabhängig von event.is_home). */
    const homeTeamName = event.is_home === false ? compactOpponentName : compactOurTeamName;
    const awayTeamName = event.is_home === false ? compactOurTeamName : compactOpponentName;
    const homeSplit = splitPrefixAndName(homeTeamName);
    const awaySplit = splitPrefixAndName(awayTeamName);
    const homeLogoSrc =
      event.is_home === false
        ? getClubLogo(opponentName, { logoUrl: opponentLogo.trim() || undefined })
        : getClubLogo(ourTeamName);
    const awayLogoSrc =
      event.is_home === false
        ? getClubLogo(ourTeamName)
        : getClubLogo(opponentName, { logoUrl: opponentLogo.trim() || undefined });
    const scoreStr = `${scoreHome}:${scoreAway}`;

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

    const finishedMinuteLabel = (raw: number | null) => {
      const m = finishedReportMinuteDisplayFromDb(raw) ?? 0;
      return `${m}'`;
    };

    const FINISHED_SUB_PAIR_GAP_SEC = 5;
    const matchEventStoredSeconds = (r: Pick<MatchEventRow, 'minute'>) =>
      Math.max(0, Math.floor(Number(r.minute ?? 0) || 0));
    const normalizeSubEventType = (type: string | null | undefined): string => {
      const t = String(type ?? '').trim().toLowerCase();
      if (t === 'substitution_out') return 'sub_out';
      if (t === 'substitution_in') return 'sub_in';
      if (t === 'substitution') return 'substitution';
      return t;
    };
    const substitutionInPlayerIdFromRow = (row: MatchEventRow): string => {
      const p = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
      return typeof p.player_in_id === 'string' ? p.player_in_id.trim() : '';
    };
    const sameSubstitutionEditWindow = (a: MatchEventRow, b: MatchEventRow): boolean =>
      Math.abs(matchEventStoredSeconds(a) - matchEventStoredSeconds(b)) <= FINISHED_SUB_PAIR_GAP_SEC;

    const playerName = (playerId: string | null) => {
      if (!playerId) return null;
      const p = players.find((x) => x.id === playerId);
      return (p?.display_name ?? p?.name ?? '').trim() || null;
    };

    const squadPlayerIds = (() => {
      const ids = new Set<string>();
      for (const r of lineupRows) {
        if (r.player_id) ids.add(r.player_id);
      }
      for (const r of benchRows) {
        if (r.player_id) ids.add(r.player_id);
      }
      return ids;
    })();

    const requireSquadPlayer = (id: string | null | undefined, ctx: string): boolean => {
      const t = String(id ?? '').trim();
      if (!t) return true;
      if (squadPlayerIds.size === 0) return true;
      if (!squadPlayerIds.has(t)) {
        setMatchError(`${ctx}: nur Spieler aus dem Matchkader (Startelf + Bank).`);
        return false;
      }
      return true;
    };

    const editorPlayerSelectExtras = new Set<string>();
    const noteExtra = (id: string | null | undefined) => {
      const t = (id ?? '').trim();
      if (t) editorPlayerSelectExtras.add(t);
    };
    noteExtra(goalPlayerId);
    noteExtra(editEventPlayerId);
    noteExtra(editSwitchOutPlayerId);
    noteExtra(editSwitchInPlayerId);
    noteExtra(newSwitchOutPlayerId);
    noteExtra(newSwitchInPlayerId);
    noteExtra(newCardPlayerId);
    noteExtra(editCardPlayerId);

    const editorPlayers =
      squadPlayerIds.size > 0
        ? (() => {
            const list = players.filter((p) => squadPlayerIds.has(p.id));
            const out = [...list];
            for (const pid of editorPlayerSelectExtras) {
              if (squadPlayerIds.has(pid)) continue;
              const p = players.find((x) => x.id === pid);
              if (p && !out.some((x) => x.id === p.id)) out.push(p);
            }
            return out;
          })()
        : [];

    const renderEditorPlayerOptions = () =>
      editorPlayers.map((p) => (
        <option key={p.id} value={p.id}>
          {(p.display_name ?? p.name ?? 'Spieler').trim()}
        </option>
      ));

    const compareFinishedMatchEventsChrono = (x: MatchEventRow, y: MatchEventRow): number => {
      const sx = matchEventStoredSeconds(x);
      const sy = matchEventStoredSeconds(y);
      if (sx !== sy) return sx - sy;
      return String(x.id).localeCompare(String(y.id));
    };

    const timelineEvents = [...matchEvents].sort(compareFinishedMatchEventsChrono);
    const periodLineFromInputs =
      p1h !== '' && p1a !== '' && p2h !== '' && p2a !== '' && p3h !== '' && p3a !== ''
        ? `(${p1h}:${p1a} | ${p2h}:${p2a} | ${p3h}:${p3a})`
        : null;
    /** Nur gespeicherte oder Engine-Klammer auf dem Spielbericht — nicht unfertige Modal-Eingabe. */
    const savedOrEngineBracket = periodLine;
    const shownPeriodLineModalPreview = periodLineFromInputs || savedOrEngineBracket;
    const goalScorerDisplayRows = timelineEvents
      .filter((r) => normalizeMatchEventGoalType(r.type) && r.player_id)
      .map((r) => {
        const g = normalizeMatchEventGoalType(r.type);
        const teamLabel = g === 'goal_away' ? awayTeamName : homeTeamName;
        const n = playerName(r.player_id) ?? '?';
        const m = finishedReportMinuteDisplayFromDb(r.minute) ?? 0;
        return { name: n, teamLabel, minute: `${m}'` };
      });
    const ownGoalScorerEntries = goalScorerDisplayRows;
    const reportGoalScorerLines = goalScorerDisplayRows.map((r) => ({
      name: r.name,
      team: r.teamLabel,
      minute: r.minute,
    }));

    const goalCount = timelineEvents.filter((r) => normalizeMatchEventGoalType(r.type)).length;
    const tickerRows = (() => {
      const rows: Array<{ key: string; items: MatchEventRow[] }> = [];
      const used = new Set<string>();
      const GAP = FINISHED_SUB_PAIR_GAP_SEC;
      for (let i = 0; i < timelineEvents.length; i++) {
        const cur = timelineEvents[i];
        if (used.has(cur.id)) continue;
        const ct = normalizeSubEventType(cur.type);
        if (ct === 'position_swap') {
          used.add(cur.id);
          rows.push({ key: cur.id, items: [cur] });
          continue;
        }
        if (ct === 'substitution') {
          used.add(cur.id);
          rows.push({ key: cur.id, items: [cur] });
          continue;
        }
        if (ct === 'sub_out') {
          let pairJ = -1;
          for (let j = i + 1; j < timelineEvents.length; j++) {
            const cand = timelineEvents[j];
            if (used.has(cand.id)) continue;
            const nt = normalizeSubEventType(cand.type);
            if (nt === 'sub_in' && Math.abs(matchEventStoredSeconds(cur) - matchEventStoredSeconds(cand)) <= GAP) {
              pairJ = j;
              break;
            }
          }
          if (pairJ >= 0) {
            const inn = timelineEvents[pairJ];
            used.add(cur.id);
            used.add(inn.id);
            rows.push({ key: `subpair_${cur.id}_${inn.id}`, items: [cur, inn] });
            continue;
          }
        }
        if (ct === 'sub_in') {
          let pairJ = -1;
          for (let j = i - 1; j >= 0; j--) {
            const cand = timelineEvents[j];
            if (used.has(cand.id)) continue;
            const pt = normalizeSubEventType(cand.type);
            if (pt === 'sub_out' && Math.abs(matchEventStoredSeconds(cur) - matchEventStoredSeconds(cand)) <= GAP) {
              pairJ = j;
              break;
            }
          }
          if (pairJ >= 0) {
            const outt = timelineEvents[pairJ];
            used.add(cur.id);
            used.add(outt.id);
            rows.push({ key: `subpair_${outt.id}_${cur.id}`, items: [outt, cur] });
            continue;
          }
        }
        used.add(cur.id);
        rows.push({ key: cur.id, items: [cur] });
      }
      return rows;
    })();
    const subCount = tickerRows.filter((row) => {
      const t0 = normalizeSubEventType(row.items[0]?.type);
      if (row.items.length === 1 && t0 === 'substitution') return true;
      if (row.items.length !== 2) return false;
      const t1 = normalizeSubEventType(row.items[1]?.type);
      return t0 === 'sub_out' && t1 === 'sub_in';
    }).length;
    if (typeof import.meta !== 'undefined' && import.meta.env.DEV) {
      for (const r of timelineEvents) {
        const u = finishedReportUncappedDisplayMinuteFromSeconds(r.minute);
        if (u > FINISHED_REPORT_MAX_MINUTE) {
          console.warn('[EventDetail finished report] Spielminute > 90 (ungeclampft)', {
            id: r.id,
            type: r.type,
            seconds: matchEventStoredSeconds(r),
            uncappedDisplayMinute: u,
          });
        }
      }
      for (const row of tickerRows) {
        if (row.items.length !== 1) continue;
        const t = normalizeSubEventType(row.items[0]?.type);
        if (t === 'sub_out' || t === 'sub_in') {
          console.warn('[EventDetail finished report] Wechsel ohne Paar (sub_out/sub_in einzeln)', row.items[0]);
        }
      }
    }
    const totalEvents = timelineEvents.length;
    const yellowCardCount = timelineEvents.filter((x) =>
      ['yellow_card', 'card_yellow', 'yellow'].includes(String(x.type ?? '').toLowerCase()),
    ).length;
    const redCardCount = timelineEvents.filter((x) =>
      ['red_card', 'card_red', 'red'].includes(String(x.type ?? '').toLowerCase()),
    ).length;
    const goalEvents = timelineEvents.filter((r) => normalizeMatchEventGoalType(r.type));
    const switchRows = tickerRows.filter((row) => {
      const t0 = normalizeSubEventType(row.items[0]?.type);
      if (row.items.length === 1 && t0 === 'substitution') return true;
      if (row.items.length === 2) {
        const t1 = normalizeSubEventType(row.items[1]?.type);
        return t0 === 'sub_out' && t1 === 'sub_in';
      }
      const t = normalizeSubEventType(row.items[0]?.type);
      return t === 'sub_out' || t === 'sub_in';
    });
    const cardEvents = timelineEvents.filter((r) => {
      const t = String(r.type ?? '').toLowerCase();
      return ['yellow_card', 'card_yellow', 'yellow', 'red_card', 'card_red', 'red'].includes(t);
    });
    const scoreBadgeByEventId = (() => {
      let h = 0;
      let a = 0;
      const map = new Map<string, string>();
      for (const ev of timelineEvents) {
        const g = normalizeMatchEventGoalType(ev.type);
        if (g === 'goal') {
          h += 1;
          map.set(ev.id, `${h}:${a}`);
        } else if (g === 'goal_away') {
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
        .select('id, match_id, type, minute, period, player_id, created_at, payload')
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

    const syncScoreFromEvents = async (rows: MatchEventRow[]): Promise<boolean> => {
      if (!event.match_id) return true;
      if (parsePeriodScores(matchRowLite?.period_scores)) return true;
      const totals = recomputeTotalsFromMatchEvents(rows);
      const { error: updErr } = await updateMatchRow(event.match_id, {
        score_home: totals.home,
        score_away: totals.away,
      });
      if (updErr) {
        setMatchError(friendlyMatchEventWriteError(updErr));
        return false;
      }
      setMatchError(null);
      setMatchRowLite((prev) =>
        prev ? { ...prev, score_home: totals.home, score_away: totals.away } : prev,
      );
      return true;
    };

    const addGoal = async () => {
      if (!event.match_id) return;
      try {
        setMatchError(null);
        if (!requireSquadPlayer(goalPlayerId, 'Torschütze')) return;
        const dbMinute = finishedReportMinuteDbFromInput(goalMinute.trim());
        if (dbMinute < 0) {
          setMatchError(`Minute muss zwischen 1 und ${FINISHED_REPORT_MAX_MINUTE} liegen.`);
          return;
        }
        const dbType = mapUiGoalTypeToMatchEventDbType(goalTeam);
        debugAssertMatchEventDbType('addGoal', dbType);
        const { error: insErr } = await supabase.from('match_events').insert({
          match_id: event.match_id,
          type: dbType,
          minute: dbMinute,
          period: null,
          player_id: goalPlayerId.trim() || null,
        });
        if (insErr) {
          setMatchError(friendlyMatchEventWriteError(insErr.message));
          return;
        }
        const rows = await reloadMatchEvents();
        if (!rows) return;
        const synced = await syncScoreFromEvents(rows);
        if (!synced) return;
        setMatchError(null);
        setGoalMinute('');
        setGoalPlayerId('');
      } catch (e: any) {
        console.error('[FinishedMatchReport] addGoal', e);
        setMatchError(friendlyMatchEventWriteError(e?.message));
      }
    };

    const requestDeleteTickerRows = (items: MatchEventRow[]) => {
      if (items.length === 0) return;
      setPendingMatchEventDeletes(items);
    };

    const executeDeleteTickerRows = async (items: MatchEventRow[]): Promise<boolean> => {
      if (!event.match_id || items.length === 0) return false;
      const ids = items.map((x) => x.id);
      const didTouchGoals = items.some((x) => normalizeMatchEventGoalType(x.type) !== null);
      const { error: delErr } = await supabase.from('match_events').delete().in('id', ids);
      if (delErr) {
        setMatchError(friendlyMatchEventWriteError(delErr.message));
        return false;
      }
      const rows = await reloadMatchEvents();
      if (!rows) return false;
      if (didTouchGoals) {
        const synced = await syncScoreFromEvents(rows);
        if (!synced) return false;
      }
      setMatchError(null);
      return true;
    };

    const confirmPendingMatchEventDelete = async () => {
      const items = pendingMatchEventDeletes;
      if (!items?.length) return;
      setMatchEventSingleDeleteBusy(true);
      try {
        const ok = await executeDeleteTickerRows(items);
        if (ok) setPendingMatchEventDeletes(null);
      } finally {
        setMatchEventSingleDeleteBusy(false);
      }
    };

    const addSwitch = async () => {
      if (!event.match_id) return;
      setMatchError(null);
      if (!requireSquadPlayer(newSwitchOutPlayerId, 'Auswechselnder')) return;
      if (!requireSquadPlayer(newSwitchInPlayerId, 'Einwechselnder')) return;
      const dbMinute = finishedReportMinuteDbFromInput(newSwitchMinute.trim());
      if (dbMinute < 0) {
        setMatchError(`Minute muss zwischen 1 und ${FINISHED_REPORT_MAX_MINUTE} liegen.`);
        return;
      }
      const payloads: Array<{ match_id: string; type: string; minute: number; period: null; player_id: string | null }> = [];
      if (newSwitchOutPlayerId.trim()) {
        payloads.push({
          match_id: event.match_id,
          type: 'sub_out',
          minute: dbMinute,
          period: null,
          player_id: newSwitchOutPlayerId.trim(),
        });
      }
      if (newSwitchInPlayerId.trim()) {
        payloads.push({
          match_id: event.match_id,
          type: 'sub_in',
          minute: dbMinute,
          period: null,
          player_id: newSwitchInPlayerId.trim(),
        });
      }
      if (payloads.length === 0) return;
      const { error: insErr } = await supabase.from('match_events').insert(payloads);
      if (insErr) {
        setMatchError(friendlyMatchEventWriteError(insErr.message));
        return;
      }
      await reloadMatchEvents();
      setMatchError(null);
      setNewSwitchMinute('');
      setNewSwitchOutPlayerId('');
      setNewSwitchInPlayerId('');
    };

    const addCard = async () => {
      if (!event.match_id) return;
      setMatchError(null);
      if (!requireSquadPlayer(newCardPlayerId, 'Karte')) return;
      const dbMinute = finishedReportMinuteDbFromInput(newCardMinute.trim());
      if (dbMinute < 0) {
        setMatchError(`Minute muss zwischen 1 und ${FINISHED_REPORT_MAX_MINUTE} liegen.`);
        return;
      }
      const { error: insErr } = await supabase.from('match_events').insert({
        match_id: event.match_id,
        type: newCardType,
        minute: dbMinute,
        period: null,
        player_id: newCardPlayerId.trim() || null,
      });
      if (insErr) {
        setMatchError(friendlyMatchEventWriteError(insErr.message));
        return;
      }
      await reloadMatchEvents();
      setMatchError(null);
      setNewCardMinute('');
      setNewCardPlayerId('');
      setNewCardType('yellow_card');
    };

    const beginEditCard = (r: MatchEventRow) => {
      const t = String(r.type ?? '').toLowerCase();
      setEditingCardId(r.id);
      setEditCardMinute(String(finishedReportMinuteDisplayFromDb(r.minute) ?? 0));
      setEditCardType(t === 'red_card' || t === 'card_red' || t === 'red' ? 'red_card' : 'yellow_card');
      setEditCardPlayerId(r.player_id ?? '');
    };

    const saveCardEdit = async () => {
      if (!editingCardId) return;
      setMatchError(null);
      if (!requireSquadPlayer(editCardPlayerId, 'Karte')) return;
      const dbMinute = finishedReportMinuteDbFromInput(editCardMinute.trim());
      if (dbMinute < 0) {
        setMatchError(`Minute muss zwischen 1 und ${FINISHED_REPORT_MAX_MINUTE} liegen.`);
        return;
      }
      const { error: updErr } = await supabase
        .from('match_events')
        .update({
          minute: dbMinute,
          type: editCardType,
          player_id: editCardPlayerId.trim() || null,
        })
        .eq('id', editingCardId);
      if (updErr) {
        setMatchError(friendlyMatchEventWriteError(updErr.message));
        return;
      }
      await reloadMatchEvents();
      setMatchError(null);
      setEditingCardId(null);
    };

    const savePeriodScores = async () => {
      if (!event.match_id) return;
      const parseCell = (v: string) => {
        const t = v.trim();
        if (t === '') return 0;
        const n = Number(t);
        return Number.isNaN(n) ? NaN : Math.floor(n);
      };
      const h1 = parseCell(p1h);
      const a1 = parseCell(p1a);
      const h2 = parseCell(p2h);
      const a2 = parseCell(p2a);
      const h3 = parseCell(p3h);
      const a3 = parseCell(p3a);
      if ([h1, a1, h2, a2, h3, a3].some((n) => Number.isNaN(n) || n < 0)) {
        setMatchError('Abschnitte müssen gültige Zahlen >= 0 sein (leer = 0).');
        return;
      }
      const sumH = h1 + h2 + h3;
      const sumA = a1 + a2 + a3;
      const period_scores = {
        p1: { h: h1, a: a1 },
        p2: { h: h2, a: a2 },
        p3: { h: h3, a: a3 },
      };
      const { error: updErr } = await updateMatchRow(event.match_id, {
        period_scores,
        score_home: sumH,
        score_away: sumA,
      });
      if (updErr) {
        setMatchError(updErr.message ?? String(updErr));
        return;
      }
      setMatchError(null);
      setMatchRowLite((prev) =>
        prev ? { ...prev, period_scores, score_home: sumH, score_away: sumA } : prev,
      );
      await reloadMatchEvents();
    };

    const beginEditEvent = (r: MatchEventRow) => {
      setEditingEventId(r.id);
      setEditEventMinute(String(finishedReportMinuteDisplayFromDb(r.minute) ?? 0));
      const t = normalizeSubEventType(r.type);
      if (t === 'sub_out' || t === 'sub_in') {
        setEditEventType('switch');
        setEditEventPlayerId('');
        const sameMinute = timelineEvents.filter((x) => sameSubstitutionEditWindow(x, r));
        const out = sameMinute.find((x) => normalizeSubEventType(x.type) === 'sub_out');
        const inn = sameMinute.find((x) => normalizeSubEventType(x.type) === 'sub_in');
        setEditSwitchOutPlayerId(out?.player_id ?? '');
        setEditSwitchInPlayerId(inn?.player_id ?? '');
      } else {
        setEditSwitchOutPlayerId('');
        setEditSwitchInPlayerId('');
        const gType = normalizeMatchEventGoalType(r.type);
        if (gType === 'goal_away') setEditEventType('stadium_away');
        else if (gType === 'goal') setEditEventType('stadium_home');
        else setEditEventType('stadium_home');
        setEditEventPlayerId(gType ? (r.player_id ?? '') : '');
      }
    };

    const saveEventEdit = async () => {
      if (!editingEventId) return;
      if (!event.id || !event.match_id) {
        setMatchError('Termin oder Spiel nicht vollständig zugeordnet.');
        return;
      }
      setMatchError(null);
      const editMinuteRaw = editEventMinute.trim();
      const dbMinute = finishedReportMinuteDbFromInput(editMinuteRaw);
      if (dbMinute < 0) {
        setMatchError(`Minute muss zwischen 1 und ${FINISHED_REPORT_MAX_MINUTE} liegen.`);
        return;
      }
      const old = timelineEvents.find((x) => x.id === editingEventId);
      let didTouchGoals = normalizeMatchEventGoalType(old?.type) !== null;

      if (editEventType === 'switch') {
        if (!requireSquadPlayer(editSwitchOutPlayerId, 'Auswechselnder')) return;
        if (!requireSquadPlayer(editSwitchInPlayerId, 'Einwechselnder')) return;
        const companionIds = timelineEvents
          .filter(
            (x) =>
              x.id !== editingEventId &&
              old != null &&
              sameSubstitutionEditWindow(x, old) &&
              ['sub_out', 'sub_in', 'substitution_out', 'substitution_in'].includes(String(x.type ?? '').toLowerCase()),
          )
          .map((x) => x.id);
        if (companionIds.length > 0) {
          const { error } = await supabase.from('match_events').delete().in('id', companionIds);
          if (error) {
            setMatchError(friendlyMatchEventWriteError(error.message));
            return;
          }
        }
        const { error: delErr } = await supabase.from('match_events').delete().eq('id', editingEventId);
        if (delErr) {
          setMatchError(friendlyMatchEventWriteError(delErr.message));
          return;
        }
        const payloads: Array<{ match_id: string; type: string; minute: number; period: null; player_id: string | null }> = [];
        if (editSwitchOutPlayerId.trim()) {
          payloads.push({
            match_id: event.match_id,
            type: 'sub_out',
            minute: dbMinute,
            period: null,
            player_id: editSwitchOutPlayerId.trim(),
          });
        }
        if (editSwitchInPlayerId.trim()) {
          payloads.push({
            match_id: event.match_id,
            type: 'sub_in',
            minute: dbMinute,
            period: null,
            player_id: editSwitchInPlayerId.trim(),
          });
        }
        if (payloads.length > 0) {
          const { error: insErr } = await supabase.from('match_events').insert(payloads);
          if (insErr) {
            setMatchError(friendlyMatchEventWriteError(insErr.message));
            return;
          }
        }
      } else if (editEventType === 'stadium_home' || editEventType === 'stadium_away') {
        if (!requireSquadPlayer(editEventPlayerId, 'Torschütze')) return;
        didTouchGoals = true;
        const newDbType = mapUiGoalTypeToMatchEventDbType(editEventType);
        debugAssertMatchEventDbType('saveEventEdit goal', newDbType);
        const { data: updatedRows, error: updErr } = await supabase
          .from('match_events')
          .update({
            minute: dbMinute,
            type: newDbType,
            player_id: editEventPlayerId.trim() || null,
          })
          .eq('id', editingEventId)
          .select('id');
        if (import.meta.env.DEV) {
          console.debug('[FinishedMatchReport] saveGoal', {
            eventId: event.id,
            matchId: event.match_id,
            matchEventId: editingEventId,
            oldMinute: old?.minute ?? null,
            editMinute: editMinuteRaw,
            dbMinute,
            selectedTeam: editEventType,
            dbType: newDbType,
            playerId: editEventPlayerId.trim() || null,
            updateError: updErr?.message ?? null,
            updateReturnedIds: updatedRows?.map((x) => x.id) ?? [],
          });
        }
        if (updErr) {
          setMatchError(friendlyMatchEventWriteError(updErr.message));
          return;
        }
        if (!updatedRows || updatedRows.length === 0) {
          setMatchError('Ereignis konnte nicht aktualisiert werden. Bitte Rechte/Team prüfen.');
          return;
        }
      } else {
        setMatchError('Unbekannter Ereignistyp.');
        return;
      }
      const rows = await reloadMatchEvents();
      if (!rows) return;
      if (didTouchGoals) {
        const synced = await syncScoreFromEvents(rows);
        if (!synced) return;
      }
      setMatchError(null);
      setEditingEventId(null);
    };

    return (
      <div className="min-h-screen text-white [background:linear-gradient(180deg,rgba(40,5,5,0.97)_0%,rgba(20,0,0,0.98)_55%,rgba(10,0,0,0.99)_100%)]">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 py-4 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-4">
          <div className="flex flex-col gap-2">
            <Link to="/app/termine" className="text-[14px] text-white/80 hover:text-white">
              ← Zurück zum Spielplan
            </Link>
          </div>

          <div className="mb-1 -mx-3.5 w-[calc(100%+1.75rem)] max-w-none sm:mx-0 sm:w-full sm:max-w-full">
            <section className="mb-1 w-full pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
              <div className="mb-1.5 flex items-start justify-between gap-2 px-0.5">
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-300/90">Spielbericht</h2>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-md border border-red-500/35 bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-red-200/95">
                    BEENDET
                  </span>
                  {canTrainerManageEvent ? (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-red-300/70 underline-offset-2 hover:text-red-200 hover:underline"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      Termin löschen
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="relative w-full overflow-hidden rounded-[2rem] border border-red-500/30 bg-black shadow-[0_0_40px_rgba(255,0,0,0.25)]">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#000000] via-[#100304] to-[#050505]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_42%),radial-gradient(ellipse_at_bottom,rgba(150,18,24,0.09),transparent_58%)]" />
                <div className="pointer-events-none absolute inset-0 opacity-60 [background:linear-gradient(180deg,rgba(0,0,0,0.28)_0%,rgba(0,0,0,0.6)_46%,rgba(0,0,0,0.9)_100%)]" />

                <div className="relative z-10 px-3 py-1.5 sm:px-4 sm:py-2">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2">
                    <div className="flex min-w-0 flex-col items-center text-center">
                      <img src={homeLogoSrc} alt="" className="h-10 w-10 object-contain drop-shadow sm:h-11 sm:w-11" />
                      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                        {homeSplit.prefix || ' '}
                      </p>
                      <p className="mt-0.5 line-clamp-2 min-w-0 max-w-[8.5rem] text-center text-[14px] font-semibold leading-[1.25] text-white break-normal hyphens-none [overflow-wrap:normal] sm:max-w-[10rem] sm:text-[15px]">
                        {homeSplit.name || homeTeamName}
                      </p>
                    </div>

                    <div className="flex min-w-0 flex-col items-center px-1 text-center">
                      <p className="text-[10px] font-semibold text-white/82">
                        {event.match_type ? getDomainEventLabel(event) : 'Meisterschaftsspiel'}
                      </p>
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.34em] text-red-300/88">ENDSTAND</p>
                      <p className="mt-0.5 text-[2.45rem] font-black leading-none tabular-nums text-white sm:text-[2.72rem]">
                        {scoreStr}
                      </p>
                      {savedOrEngineBracket ? (
                        <p className="mt-0 text-[11px] tabular-nums leading-tight text-white/58">{savedOrEngineBracket}</p>
                      ) : null}
                      {venue ? <p className="mt-0.5 line-clamp-2 text-center text-[0.9rem] leading-snug text-white/65">{venue}</p> : null}
                      {homeAway ? (
                        <span
                          className={`mt-0.5 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            event.is_home === true
                              ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                              : 'border-amber-500/35 bg-amber-500/12 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.18)]'
                          }`}
                        >
                          {homeAway}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex min-w-0 flex-col items-center text-center">
                      <img src={awayLogoSrc} alt="" className="h-10 w-10 object-contain drop-shadow sm:h-11 sm:w-11" />
                      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
                        {awaySplit.prefix || ' '}
                      </p>
                      <p className="mt-0.5 line-clamp-2 min-w-0 max-w-[8.5rem] text-center text-[14px] font-semibold leading-[1.25] text-white break-normal hyphens-none [overflow-wrap:normal] sm:max-w-[10rem] sm:text-[15px]">
                        {awaySplit.name || awayTeamName}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-0.5 flex justify-center">
            <div className="inline-flex min-h-[36px] w-full max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/15 bg-black/25 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {renderTabButton('overview', 'Spielbericht')}
              {renderTabButton('lineup', 'Aufstellung')}
              {renderTabButton('timeline', 'Liveticker')}
              {renderTabButton('stats', 'Statistik')}
            </div>
          </div>
          {canTrainerManageEvent ? (
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setReportEditOpen(true)}
                className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-[15px] font-semibold text-white/85 transition hover:border-red-400/35 hover:shadow-[0_0_12px_rgba(220,38,38,0.2)] active:scale-[0.99]"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Spielbericht bearbeiten
              </button>
            </div>
          ) : null}

          {matchLoading ? <p className="text-sm text-white/70">Lade Spielbericht…</p> : null}
          {matchError ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-950/40 p-3 text-sm text-red-100">
              {matchError}
            </div>
          ) : null}

          {finishedTab === 'overview' ? (
            <div className="rounded-2xl border border-white/10 bg-black/45 p-4 text-white/85 shadow-[0_12px_28px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/60">Spielbericht</p>
              <div className="mt-1.5 divide-y divide-white/[0.07] text-[13px]">
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">⚽ Ergebnis</span>
                  <span className="text-right font-semibold text-white/95 tabular-nums">
                    {scoreHome} : {scoreAway}
                  </span>
                </div>
                {hasManualPeriodScores ? (
                  <p className="py-2 text-[12px] text-white/50">Endstand aus Abschnitten</p>
                ) : null}
                {savedOrEngineBracket ? (
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <span className="shrink-0 text-white/70">⏱ Abschnitte</span>
                    <span className="text-right text-sm tabular-nums text-white/88">{savedOrEngineBracket}</span>
                  </div>
                ) : null}
                {reportGoalScorerLines.length > 0 ? (
                  <div className="py-3.5">
                    <p className="text-white/70">⚽ Torschützen</p>
                    <div className="mt-1.5 space-y-1">
                      {reportGoalScorerLines.map((line, i) => (
                        <p key={`${line.name}-${line.team}-${i}`} className="text-[13px]">
                          <span className="text-white/85">{line.name}</span>
                          <span className="text-white/50"> · {line.team}</span>
                          {line.minute ? <span className="text-white/55"> · {line.minute}</span> : null}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">🕒 Datum</span>
                  <span className="max-w-[min(100%,14rem)] text-right text-white/90 sm:max-w-none">
                    {formatEventDateTimeLabel(event.starts_at)}
                  </span>
                </div>
                {venue ? (
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <span className="shrink-0 text-white/70">Spielort</span>
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
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">🟨/🟥 Karten</span>
                  <span className="tabular-nums text-white/90">
                    {yellowCardCount} / {redCardCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-white/70">🏆 Bewerb</span>
                  <span className="text-right text-white/90">
                    {event.match_type ? getDomainEventLabel(event) : 'Meisterschaftsspiel'}
                  </span>
                </div>
              </div>
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
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{scoreHome}</p>
                </div>
                <div className="rounded-xl border border-white/12 bg-gradient-to-br from-black/50 to-red-950/25 px-3 py-3 shadow-[0_0_16px_rgba(220,38,38,0.12)]">
                  <p className="text-[11px] font-medium text-white/55">Tore Auswärts</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{scoreAway}</p>
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
                    const t0 = normalizeSubEventType(row.items[0]?.type);
                    const t1 = row.items[1] ? normalizeSubEventType(row.items[1]?.type) : '';
                    const stadiumGoal = normalizeMatchEventGoalType(r.type);
                    const t = String(r.type ?? '').toLowerCase();
                    const isAtomicSubstitution = row.items.length === 1 && t0 === 'substitution';
                    const isPairSwitch = row.items.length === 2 && t0 === 'sub_out' && t1 === 'sub_in';
                    const isPosSwap = t0 === 'position_swap';
                    const isSwitch =
                      isAtomicSubstitution ||
                      isPairSwitch ||
                      (!isPosSwap && (t0 === 'sub_out' || t0 === 'sub_in'));
                    const name = playerName(r.player_id);
                    const switchOutName = isAtomicSubstitution
                      ? playerName(row.items[0]?.player_id ?? null)
                      : isPairSwitch
                        ? playerName(row.items[0]?.player_id ?? null)
                        : t0 === 'sub_out'
                          ? name
                          : null;
                    const switchInName = isAtomicSubstitution
                      ? playerName(substitutionInPlayerIdFromRow(row.items[0]!) || null)
                      : isPairSwitch
                        ? playerName(row.items[1]?.player_id ?? null)
                        : t0 === 'sub_in'
                          ? name
                          : null;
                    const swapWithId =
                      isPosSwap && r.payload && typeof r.payload === 'object'
                        ? String((r.payload as Record<string, unknown>).swap_player_id ?? '').trim()
                        : '';
                    const swapWithName = swapWithId ? playerName(swapWithId) : null;
                    const minuteSourceSec = isPairSwitch
                      ? Math.max(matchEventStoredSeconds(row.items[0]!), matchEventStoredSeconds(row.items[1]!))
                      : matchEventStoredSeconds(r);
                    const scoreBadge = scoreBadgeByEventId.get(r.id) ?? null;
                    const isLast = index === tickerRows.length - 1;
                    const isGoalEv = stadiumGoal !== null;
                    const isYellow = ['yellow_card', 'card_yellow', 'yellow'].includes(t);
                    const isRedCard = ['red_card', 'card_red', 'red'].includes(t);
                    const eventCardClass = [
                      'min-w-0 flex-1 rounded-2xl bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-black px-3 py-2.5',
                      isGoalEv
                        ? 'border border-red-500/30 shadow-[0_0_22px_rgba(220,38,38,0.22)]'
                        : isSwitch
                          ? 'border border-white/[0.08] shadow-[0_6px_24px_rgba(0,0,0,0.4)]'
                          : isPosSwap
                            ? 'border border-violet-400/20 shadow-[0_0_14px_rgba(139,92,246,0.12)]'
                            : isYellow
                              ? 'border border-amber-400/25 shadow-[0_0_14px_rgba(245,158,11,0.14)]'
                              : isRedCard
                                ? 'border border-red-500/35 shadow-[0_0_14px_rgba(220,38,38,0.18)]'
                                : 'border border-white/[0.08] shadow-[0_6px_28px_rgba(0,0,0,0.35)]',
                    ].join(' ');
                    return (
                      <li key={row.key} className="flex gap-2 pb-2 last:pb-0">
                        <div className="w-12 shrink-0 pt-0.5 text-right text-[15px] font-black tabular-nums leading-none text-red-200/90">
                          {finishedMinuteLabel(minuteSourceSec)}
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
                              {isPosSwap ? (
                                <>
                                  <p className="text-[10px] font-black uppercase tracking-wide text-violet-300">⇄ Positionswechsel</p>
                                  <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90">
                                    {(name ?? '—') + ' ↔ ' + (swapWithName ?? '—')}
                                  </p>
                                </>
                              ) : isSwitch ? (
                                <>
                                  <p className="text-[10px] font-black uppercase tracking-wide text-sky-300">🔁 Wechsel</p>
                                  {switchOutName || switchInName ? (
                                    <p className="mt-1 text-[12px] font-semibold leading-snug text-white/90">
                                      <span className="text-red-200/95">Raus {switchOutName ?? '—'}</span>
                                      <span className="mx-1.5 text-white/35">→</span>
                                      <span className="text-emerald-300/95">Rein {switchInName ?? '—'}</span>
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-[13px] text-white/75">Wechsel</p>
                                  )}
                                </>
                              ) : stadiumGoal ? (
                                <>
                                  <p className="line-clamp-2 text-[15px] font-bold leading-snug text-white">
                                    Team {stadiumGoal === 'goal_away' ? awayTeamName : homeTeamName}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-white/65">
                                    {name ? `Torschütze: ${name}` : 'Ohne Torschütze'}
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
                            {!hasManualPeriodScores && scoreBadge ? (
                              <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white/90">
                                {scoreBadge}
                              </span>
                            ) : null}
                          </div>
                          {canTrainerManageEvent ? (
                            <div className="mt-2 flex justify-end gap-1.5">
                              {!isPosSwap ? (
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
                              ) : null}
                              <button
                                type="button"
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.07]"
                                onClick={() => requestDeleteTickerRows(row.items)}
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
            isOpen={reportEditOpen}
            title="Spielbericht bearbeiten"
            titleClassName="!text-[22px] !font-bold !leading-tight tracking-tight text-white"
            onClose={() => setReportEditOpen(false)}
            footer={
              <Button variant="ghost" className="min-h-[48px] px-5 text-[16px] font-semibold" onClick={() => setReportEditOpen(false)}>
                Schließen
              </Button>
            }
          >
            <div className="space-y-6 pb-1">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[14px] font-bold uppercase tracking-[0.22em] text-white/55">Ergebnis</p>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-center">
                  {hasManualPeriodScores ? (
                    <p className="text-[22px] font-black tabular-nums leading-tight text-white sm:text-[28px]">
                      Endstand aus Abschnitten: {scoreHome} : {scoreAway}
                    </p>
                  ) : (
                    <>
                      <p className="text-[15px] font-medium text-white/65">Endstand</p>
                      <p className="mt-1 text-[34px] font-black tabular-nums leading-none text-white">
                        {scoreHome} : {scoreAway}
                      </p>
                    </>
                  )}
                  <p className="mt-2 text-[15px] leading-snug text-white/60">
                    {hasManualPeriodScores
                      ? 'Die Abschnitte bestimmen den Endstand. Tore sind nur für Liveticker/Torschützen.'
                      : 'Wird aus den Toren berechnet, solange keine vollständigen Abschnitte gespeichert sind.'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[14px] font-bold uppercase tracking-[0.22em] text-white/55">Abschnitte</p>
                <p className="mt-2 text-[15px] leading-snug text-white/65">Optional – für Klammerergebnis.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">A1 Heim</span>
                    <input value={p1h} onChange={(e) => setP1h(e.target.value)} inputMode="numeric" className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">A1 Ausw.</span>
                    <input value={p1a} onChange={(e) => setP1a(e.target.value)} inputMode="numeric" className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">A2 Heim</span>
                    <input value={p2h} onChange={(e) => setP2h(e.target.value)} inputMode="numeric" className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">A2 Ausw.</span>
                    <input value={p2a} onChange={(e) => setP2a(e.target.value)} inputMode="numeric" className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">A3 Heim</span>
                    <input value={p3h} onChange={(e) => setP3h(e.target.value)} inputMode="numeric" className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90" />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">A3 Ausw.</span>
                    <input value={p3a} onChange={(e) => setP3a(e.target.value)} inputMode="numeric" className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90" />
                  </label>
                </div>
                <Button variant="secondary" className="mt-4 min-h-[48px] w-full text-[16px] font-semibold" onClick={() => void savePeriodScores()}>
                  Abschnitte speichern
                </Button>
                {shownPeriodLineModalPreview ? (
                  <p className="mt-3 text-center text-[15px] tabular-nums text-white/60">{shownPeriodLineModalPreview}</p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[14px] font-bold uppercase tracking-[0.22em] text-white/55">Tore</p>
                <p className="mt-2 text-[12px] leading-snug text-white/50">
                  Team wie im Spielbericht: links = Stadion-Heim (wird als <span className="text-white/65">goal</span> gespeichert), rechts =
                  Stadion-Auswärts (<span className="text-white/65">goal_away</span>).
                </p>

                {editingEventId && (editEventType === 'stadium_home' || editEventType === 'stadium_away') ? (
                  <div className="mb-4 mt-4 rounded-2xl border border-red-500/20 bg-red-950/15 p-4 shadow-[0_0_24px_rgba(220,38,38,0.12)]">
                    <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-white/55">Tor bearbeiten</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-[15px] font-medium text-white/70">Minute</span>
                        <input
                          value={editEventMinute}
                          onChange={(e) => setEditEventMinute(e.target.value)}
                          inputMode="numeric"
                          className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-[15px] font-medium text-white/70">Team</span>
                        <select
                          value={editEventType}
                          onChange={(e) =>
                            setEditEventType(e.target.value === 'stadium_away' ? 'stadium_away' : 'stadium_home')
                          }
                          className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                        >
                          <option value="stadium_home">{homeTeamName}</option>
                          <option value="stadium_away">{awayTeamName}</option>
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 flex flex-col gap-2">
                      <span className="text-[15px] font-medium text-white/70">Torschütze (optional)</span>
                      <select
                        value={editEventPlayerId}
                        onChange={(e) => setEditEventPlayerId(e.target.value)}
                        className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                      >
                        <option value="">—</option>
                        {renderEditorPlayerOptions()}
                      </select>
                    </label>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Button variant="ghost" className="min-h-[48px] text-[16px] font-semibold" onClick={() => setEditingEventId(null)}>
                        Abbrechen
                      </Button>
                      <Button variant="primary" className="min-h-[48px] text-[16px] font-semibold" onClick={() => void saveEventEdit()}>
                        Speichern
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {goalEvents.length === 0 ? (
                    <p className="text-[16px] text-white/55">Keine Tore erfasst.</p>
                  ) : (
                    goalEvents.map((g) => (
                      <div
                        key={g.id}
                        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-xl font-bold text-white">
                            <span className="mr-1.5" aria-hidden>
                              ⚽
                            </span>
                            {finishedMinuteLabel(g.minute)}
                          </p>
                          <p className="mt-1 text-[17px] font-semibold text-white/95">
                            Team {normalizeMatchEventGoalType(g.type) === 'goal_away' ? awayTeamName : homeTeamName}
                          </p>
                          <p className="mt-1 text-[14px] text-white/60">
                            {playerName(g.player_id) ? `Torschütze: ${playerName(g.player_id)}` : 'Ohne Torschütze'}
                          </p>
                        </div>
                        <div className="flex gap-2 sm:flex-shrink-0">
                          <button
                            type="button"
                            className="min-h-[48px] flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-[16px] font-semibold text-white/85 hover:bg-white/[0.1] sm:flex-initial"
                            onClick={() => beginEditEvent(g)}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            className="min-h-[48px] flex-1 rounded-xl border border-red-400/35 bg-red-500/12 px-4 text-[16px] font-semibold text-red-100 hover:bg-red-500/18 sm:flex-initial"
                            onClick={() => requestDeleteTickerRows([g])}
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">Minute</span>
                    <input
                      value={goalMinute}
                      onChange={(e) => setGoalMinute(e.target.value)}
                      inputMode="numeric"
                      className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                      placeholder="z. B. 12"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[15px] font-medium text-white/70">Team</span>
                    <select
                      value={goalTeam}
                      onChange={(e) => setGoalTeam(e.target.value === 'stadium_away' ? 'stadium_away' : 'stadium_home')}
                      className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                    >
                      <option value="stadium_home">{homeTeamName}</option>
                      <option value="stadium_away">{awayTeamName}</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 flex flex-col gap-2">
                  <span className="text-[15px] font-medium text-white/70">Torschütze (optional)</span>
                  <select
                    value={goalPlayerId}
                    onChange={(e) => setGoalPlayerId(e.target.value)}
                    className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                  >
                    <option value="">—</option>
                    {renderEditorPlayerOptions()}
                  </select>
                </label>
                <Button variant="primary" className="mt-4 min-h-[48px] w-full text-[16px] font-semibold" onClick={() => void addGoal()}>
                  + Neues Tor
                </Button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[14px] font-bold uppercase tracking-[0.22em] text-white/55">Wechsel</p>

                {editingEventId && editEventType === 'switch' ? (
                  <div className="mb-4 mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-4 shadow-[0_0_24px_rgba(16,185,129,0.1)]">
                    <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-white/55">Wechsel bearbeiten</p>
                    <label className="mt-3 flex flex-col gap-2">
                      <span className="text-[15px] font-medium text-white/70">Minute</span>
                      <input
                        value={editEventMinute}
                        onChange={(e) => setEditEventMinute(e.target.value)}
                        inputMode="numeric"
                        className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                      />
                    </label>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-[15px] font-medium text-white/70">Spieler raus</span>
                        <select
                          value={editSwitchOutPlayerId}
                          onChange={(e) => setEditSwitchOutPlayerId(e.target.value)}
                          className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                        >
                          <option value="">—</option>
                          {renderEditorPlayerOptions()}
                        </select>
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-[15px] font-medium text-white/70">Spieler rein</span>
                        <select
                          value={editSwitchInPlayerId}
                          onChange={(e) => setEditSwitchInPlayerId(e.target.value)}
                          className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                        >
                          <option value="">—</option>
                          {renderEditorPlayerOptions()}
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Button variant="ghost" className="min-h-[48px] text-[16px] font-semibold" onClick={() => setEditingEventId(null)}>
                        Abbrechen
                      </Button>
                      <Button variant="primary" className="min-h-[48px] text-[16px] font-semibold" onClick={() => void saveEventEdit()}>
                        Speichern
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {switchRows.length === 0 ? (
                    <p className="text-[16px] text-white/55">Keine Wechsel erfasst.</p>
                  ) : (
                    switchRows.map((row) => {
                      const isAtomic =
                        row.items.length === 1 &&
                        normalizeSubEventType(row.items[0]?.type) === 'substitution';
                      const outEvent =
                        row.items.find((x) => {
                          const t = normalizeSubEventType(x.type);
                          return t === 'sub_out' || t === 'substitution';
                        }) ?? row.items[0]!;
                      const inEvent = isAtomic
                        ? ({
                            ...outEvent,
                            player_id: substitutionInPlayerIdFromRow(outEvent) || outEvent.player_id,
                          } as MatchEventRow)
                        : (row.items.find((x) => normalizeSubEventType(x.type) === 'sub_in') ?? row.items[0]!);
                      return (
                        <div
                          key={row.key}
                          className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-xl font-bold text-white">
                              <span className="mr-1.5" aria-hidden>
                                🔁
                              </span>
                              {finishedMinuteLabel(outEvent.minute)}
                            </p>
                            <p className="mt-1 text-[16px] font-semibold leading-snug text-white/90">
                              <span className="text-red-200/90">Raus {playerName(outEvent.player_id) ?? '—'}</span>
                              <span className="mx-1.5 text-white/35">→</span>
                              <span className="text-emerald-300/90">Rein {playerName(inEvent.player_id) ?? '—'}</span>
                            </p>
                          </div>
                          <div className="flex gap-2 sm:flex-shrink-0">
                            <button
                              type="button"
                              className="min-h-[48px] flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-[16px] font-semibold text-white/85 hover:bg-white/[0.1] sm:flex-initial"
                              onClick={() => beginEditEvent(outEvent)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              className="min-h-[48px] flex-1 rounded-xl border border-red-400/35 bg-red-500/12 px-4 text-[16px] font-semibold text-red-100 hover:bg-red-500/18 sm:flex-initial"
                              onClick={() => requestDeleteTickerRows(row.items)}
                            >
                              Löschen
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    value={newSwitchMinute}
                    onChange={(e) => setNewSwitchMinute(e.target.value)}
                    inputMode="numeric"
                    placeholder="Minute"
                    className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                  />
                  <select
                    value={newSwitchOutPlayerId}
                    onChange={(e) => setNewSwitchOutPlayerId(e.target.value)}
                    className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                  >
                    <option value="">Raus</option>
                    {renderEditorPlayerOptions()}
                  </select>
                  <select
                    value={newSwitchInPlayerId}
                    onChange={(e) => setNewSwitchInPlayerId(e.target.value)}
                    className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                  >
                    <option value="">Rein</option>
                    {renderEditorPlayerOptions()}
                  </select>
                </div>
                <Button variant="secondary" className="mt-4 min-h-[48px] w-full text-[16px] font-semibold" onClick={() => void addSwitch()}>
                  + Neuer Wechsel
                </Button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-[14px] font-bold uppercase tracking-[0.22em] text-white/55">Karten</p>

                {editingCardId ? (
                  <div className="mb-4 mt-4 rounded-2xl border border-amber-400/25 bg-amber-950/15 p-4 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
                    <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-white/55">Karte bearbeiten</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-[15px] font-medium text-white/70">Minute</span>
                        <input
                          value={editCardMinute}
                          onChange={(e) => setEditCardMinute(e.target.value)}
                          inputMode="numeric"
                          className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-[15px] font-medium text-white/70">Typ</span>
                        <select
                          value={editCardType}
                          onChange={(e) => setEditCardType(e.target.value === 'red_card' ? 'red_card' : 'yellow_card')}
                          className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                        >
                          <option value="yellow_card">Gelb</option>
                          <option value="red_card">Rot</option>
                        </select>
                      </label>
                    </div>
                    <label className="mt-3 flex flex-col gap-2">
                      <span className="text-[15px] font-medium text-white/70">Spieler</span>
                      <select
                        value={editCardPlayerId}
                        onChange={(e) => setEditCardPlayerId(e.target.value)}
                        className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                      >
                        <option value="">—</option>
                        {renderEditorPlayerOptions()}
                      </select>
                    </label>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Button variant="ghost" className="min-h-[48px] text-[16px] font-semibold" onClick={() => setEditingCardId(null)}>
                        Abbrechen
                      </Button>
                      <Button variant="primary" className="min-h-[48px] text-[16px] font-semibold" onClick={() => void saveCardEdit()}>
                        Speichern
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {cardEvents.length === 0 ? (
                    <p className="text-[16px] text-white/55">Keine Karten erfasst.</p>
                  ) : (
                    cardEvents.map((c) => {
                      const t = String(c.type ?? '').toLowerCase();
                      const isRed = ['red_card', 'card_red', 'red'].includes(t);
                      return (
                        <div
                          key={c.id}
                          className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-xl font-bold text-white">
                              <span className="mr-1.5" aria-hidden>
                                {isRed ? '🟥' : '🟨'}
                              </span>
                              {finishedMinuteLabel(c.minute)}
                            </p>
                            <p className="mt-1 text-[17px] font-medium text-white/90">{playerName(c.player_id) ?? 'Spieler offen'}</p>
                          </div>
                          <div className="flex gap-2 sm:flex-shrink-0">
                            <button
                              type="button"
                              className="min-h-[48px] flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-[16px] font-semibold text-white/85 hover:bg-white/[0.1] sm:flex-initial"
                              onClick={() => beginEditCard(c)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              className="min-h-[48px] flex-1 rounded-xl border border-red-400/35 bg-red-500/12 px-4 text-[16px] font-semibold text-red-100 hover:bg-red-500/18 sm:flex-initial"
                              onClick={() => requestDeleteTickerRows([c])}
                            >
                              Löschen
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    value={newCardMinute}
                    onChange={(e) => setNewCardMinute(e.target.value)}
                    inputMode="numeric"
                    placeholder="Minute"
                    className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                  />
                  <select
                    value={newCardType}
                    onChange={(e) => setNewCardType(e.target.value === 'red_card' ? 'red_card' : 'yellow_card')}
                    className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                  >
                    <option value="yellow_card">Gelb</option>
                    <option value="red_card">Rot</option>
                  </select>
                  <select
                    value={newCardPlayerId}
                    onChange={(e) => setNewCardPlayerId(e.target.value)}
                    className="min-h-[48px] rounded-xl border border-white/12 bg-black/45 px-3 text-[17px] text-white/90"
                  >
                    <option value="">Spieler</option>
                    {renderEditorPlayerOptions()}
                  </select>
                </div>
                <Button variant="secondary" className="mt-4 min-h-[48px] w-full text-[16px] font-semibold" onClick={() => void addCard()}>
                  + Neue Karte
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            isOpen={pendingMatchEventDeletes != null && pendingMatchEventDeletes.length > 0}
            title="Ereignis löschen?"
            onClose={() => {
              if (!matchEventSingleDeleteBusy) setPendingMatchEventDeletes(null);
            }}
            footer={
              <div className="flex justify-end gap-2">
                <AppButton
                  variant="secondary"
                  onClick={() => !matchEventSingleDeleteBusy && setPendingMatchEventDeletes(null)}
                  disabled={matchEventSingleDeleteBusy}
                >
                  Abbrechen
                </AppButton>
                <AppButton
                  variant="danger"
                  onClick={() => void confirmPendingMatchEventDelete()}
                  disabled={matchEventSingleDeleteBusy}
                >
                  {matchEventSingleDeleteBusy ? 'Löschen…' : 'Löschen'}
                </AppButton>
              </div>
            }
          >
            <p className="text-[14px] text-white/75">Dieses Ereignis wirklich löschen?</p>
          </Modal>

          <Modal
            isOpen={deleteConfirmOpen}
            title="Termin löschen?"
            onClose={() => {
              if (!deletingEvent) setDeleteConfirmOpen(false);
            }}
            footer={
              <div className="flex justify-end gap-2">
                <AppButton variant="secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={deletingEvent}>
                  Abbrechen
                </AppButton>
                <AppButton variant="danger" onClick={() => void handleDeleteEvent()} disabled={deletingEvent}>
                  {deletingEvent ? 'Löschen…' : 'Endgültig löschen'}
                </AppButton>
              </div>
            }
          >
            <p className="text-[14px] text-white/75">
              Diesen Termin wirklich löschen? Alle zugehörigen Spielbericht-, Liveticker-, Aufstellungs- und Statistikdaten
              werden entfernt.
            </p>
          </Modal>
        </div>
      </div>
    );
  }

  const isAudienceMatchDetail = event.kind === 'match' && !canTrainerManageEvent;
  const audienceLocation = splitCombinedLocation(event.location);
  const audienceMapsCoords = resolveEventMapsCoords(event.location, event.notes);
  const audienceTrainerNotes = extractAudienceTrainerNotes(event.notes);

  const handleStartNavigation = () => {
    const opened = openMapsNavigation({
      lat: audienceMapsCoords?.lat,
      lng: audienceMapsCoords?.lng,
      place: audienceLocation.place,
      address: audienceLocation.address,
      locationRaw: event.location,
    });
    if (!opened) {
      alert('Kein Spielort hinterlegt.');
    }
  };

  return (
    <div
      className="min-h-screen text-white"
      style={isTraining ? dsSchedulePageStyle() : { background: '#000000' }}
    >
      <div
        className={`mx-auto flex w-full max-w-2xl flex-col px-2 py-4 pb-28 sm:px-4 ${isAudienceMatchDetail ? 'gap-3' : 'gap-5 py-5'}`}
      >
        <div className="flex flex-col gap-3">
          <Link to="/app/termine" className="text-[14px] text-white/90 hover:text-white">
            ← Zurück zum Spielplan
          </Link>
          {isAudienceMatchDetail ? (
            <div className="flex flex-col gap-2" role="toolbar" aria-label="Spieltag-Aktionen">
              <button
                type="button"
                className={`inline-flex min-h-[52px] w-full items-center gap-3 ${dsScheduleDetailCalendarRowClass()}`}
                onClick={() => void handleAddSingleEventToCalendar()}
              >
                <CalendarPlus className="h-4 w-4 shrink-0 text-[#B85C68]" strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1 text-left text-[15px] font-semibold">Zum Kalender hinzufügen</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/35" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className={`inline-flex min-h-[52px] w-full items-center gap-3 ${dsScheduleDetailCalendarRowClass()}`}
                onClick={handleStartNavigation}
              >
                <Navigation className="h-4 w-4 shrink-0 text-[#B85C68]" strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1 text-left text-[15px] font-semibold">Navigation starten</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/35" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : (
            <ScheduleEventActionsPanel
              className="w-full"
              rows={[
                {
                  key: 'calendar',
                  label: 'Zum Kalender hinzufügen',
                  icon: <CalendarPlus className="h-4 w-4" strokeWidth={2} aria-hidden />,
                  onClick: () => void handleAddSingleEventToCalendar(),
                },
                ...(canTrainerManageEvent
                  ? [
                      {
                        key: 'edit',
                        label: 'Bearbeiten',
                        icon: <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />,
                        onClick: () => openEditModal(event),
                      },
                      {
                        key: 'delete',
                        label: 'Löschen',
                        icon: <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />,
                        danger: true,
                        onClick: () => setDeleteConfirmOpen(true),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>

        <div className="-mx-3 relative flex w-[calc(100%+1.5rem)] min-w-0 max-w-none flex-col sm:mx-0 sm:w-full sm:max-w-full">
          {isTraining ? <div className={dsTrainingDetailHeaderAtmosphereClass()} aria-hidden /> : null}
          <MatchCardLigaportal
            className="relative z-[1] !overflow-visible w-full max-w-full rounded-2xl"
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
            role={effectiveRole}
            isPublicView={true}
          />
        </div>

        {isAudienceMatchDetail ? (
          <AudienceMatchdayDetailCard
            showMeetup={showMeetup}
            meetupAt={event.meeting_at}
            placeLine={audienceLocation.place}
            addressLine={audienceLocation.address}
            trainerNotes={audienceTrainerNotes}
            status={event.status}
            matchId={event.match_id}
            onOpenLive={
              event.status === 'live' && event.match_id
                ? () => navigate(`/app/live?matchId=${encodeURIComponent(event.match_id!)}`)
                : undefined
            }
          />
        ) : null}

        {!isFan && (
          <Card
            className={
              isTraining
                ? 'relative flex flex-col gap-4 overflow-hidden border border-[rgba(122,29,42,0.12)] bg-[rgba(18,18,20,0.94)] shadow-[0_0_32px_rgba(122,29,42,0.08),inset_0_1px_0_rgba(255,255,255,0.03)]'
                : 'flex flex-col gap-4'
            }
          >
            {isTraining ? (
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(122,29,42,0.08)_0%,transparent_58%)]"
                aria-hidden
              />
            ) : null}
            <CardTitle className={isTraining ? 'relative z-[1]' : undefined}>
              {isTraining ? 'Training-Teilnahme' : 'Zu-/Absagen'}
            </CardTitle>

            {canTrainerManageEvent ? (
              <div className={`flex flex-col gap-3 ${isTraining ? 'relative z-[1]' : ''}`}>
                {event.kind === 'match' && event.match_id ? (
                  <button
                    type="button"
                    className={`mb-1 w-full ${dsPrimaryCtaClass()}`}
                    onClick={() => navigate(`/app/match-preparation?matchId=${encodeURIComponent(event.match_id)}`)}
                  >
                    Match vorbereiten
                  </button>
                ) : null}
                {isTraining ? (
                  <TrainingAttendancePanel
                    players={players}
                    getStatus={getTrainingAttendanceStatus}
                    onSetStatus={(playerId, status) => void handleTrainerTrainingStatus(playerId, status)}
                    loading={playersLoading || loadingEventAttendance}
                    className="-mx-1 min-w-0 pb-[max(5.5rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] sm:-mx-1.5"
                  />
                ) : (
                  <>
                <div className={`mt-2 flex flex-wrap ${DS_STAT_GRID_GAP}`}>
                    <span className={dsStatusChipClass('present')}>
                      Zugesagt: {Object.values(eventAttendanceByPlayerId).filter((s) => s === 'yes').length}
                    </span>
                    <span className={dsStatusChipClass('absent')}>
                      Abgesagt: {Object.values(eventAttendanceByPlayerId).filter((s) => s === 'no').length}
                    </span>
                    <span className={dsStatusChipClass('open')}>
                      Offen: {Math.max(0, players.length - Object.keys(eventAttendanceByPlayerId).length)}
                    </span>
                  </div>
                <div className={`flex flex-col ${DS_LIST_GAP} border-t border-[#2a2a2e]/60 pt-3`}>
                  {(playersLoading || loadingEventAttendance) && (
                    <p className="text-[14px] text-white/70">Lade…</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length === 0 && (
                    <p className="text-[14px] text-white/70">Keine Spieler im Kader.</p>
                  )}
                  {!playersLoading && !loadingEventAttendance && players.length > 0 && (
                    (() => {
                      const sorted = sortPlayersByRsvpBuckets(players, getAttendanceStatus);
                      const openPlayers = sorted.filter((p) => statusBucket(getAttendanceStatus, p.id) === 'open');
                      const yesPlayers = sorted.filter((p) => statusBucket(getAttendanceStatus, p.id) === 'yes');
                      const noPlayers = sorted.filter((p) => statusBucket(getAttendanceStatus, p.id) === 'no');

                      const renderGroup = (title: 'OFFEN' | 'DABEI' | 'ABWESEND', group: PlayerItem[]) => {
                        if (group.length === 0) return null;
                        return (
                          <div className={`flex flex-col ${DS_LIST_GAP}`}>
                            <p className={`mb-0.5 mt-3 ${dsSectionLabelClass()}`}>{title}</p>
                            <ul className={`flex flex-col ${DS_LIST_GAP}`}>
                              {group.map((player) => {
                                const bucket = statusBucket(getAttendanceStatus, player.id);
                                const badge =
                                  bucket === 'yes' ? 'DABEI' : bucket === 'no' ? 'ABWESEND' : 'OFFEN';
                                const chipTone: DsChipTone =
                                  bucket === 'yes' ? 'present' : bucket === 'no' ? 'absent' : 'open';
                                const num = player.jersey_number != null ? `#${player.jersey_number}` : null;
                                const pos = (player.position ?? '').trim();
                                const sub = [pos || null, num].filter(Boolean).join(' · ') || '—';

                                return (
                                  <li key={player.id} className="w-full">
                                    <PremiumPlayerCard
                                      player={player}
                                      subline={sub}
                                      density="compact"
                                      trailing={
                                        <PremiumStatusBadge label={badge} tone={chipTone} />
                                      }
                                      footer={
                                        <div className={`grid grid-cols-2 ${DS_STAT_GRID_GAP}`}>
                                          <button
                                            type="button"
                                            onClick={() => handleTrainerRsvp(player.id, 'yes')}
                                            className={dsRsvpChoiceClass('yes', bucket === 'yes')}
                                          >
                                            Dabei
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleTrainerRsvp(player.id, 'no')}
                                            className={dsRsvpChoiceClass('no', bucket === 'no')}
                                          >
                                            Abwesend
                                          </button>
                                        </div>
                                      }
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      };

                      return (
                        <div className="flex flex-col gap-1">
                          {renderGroup('OFFEN', openPlayers)}
                          {renderGroup('DABEI', yesPlayers)}
                          {renderGroup('ABWESEND', noPlayers)}
                        </div>
                      );
                    })()
                  )}
                </div>
                  </>
                )}
              </div>
            ) : (effectiveRole === 'player' || effectiveRole === 'parent') ? (
              <div className="flex flex-col gap-2">
                {!playerId ? (
                  <p className="text-[14px] text-white/90">Kein Spieler zugeordnet. Bitte beim Trainer melden.</p>
                ) : loadingRsvp ? (
                  <p className="text-[14px] text-white/70">Lade Status…</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {isTraining ? (
                      <>
                        <p className="text-[12px] text-white/70">
                          {event.training_absence_deadline_disabled
                            ? 'Absage jederzeit möglich.'
                            : 'Absage bis 12:00 Uhr am Trainingstag möglich (Europe/Vienna).'}
                        </p>
                        {!trainingCancellationAllowed && rsvpStatus !== 'no' ? (
                          <p className="mt-1 text-[12px] text-amber-200/90">Absagefrist ist vorbei – Teilnahme gilt als „Dabei“.</p>
                        ) : null}
                        <div className={`mt-3 grid grid-cols-2 ${DS_STAT_GRID_GAP}`}>
                          <button
                            type="button"
                            className={dsRsvpChoiceClass('yes', rsvpStatus !== 'no')}
                            onClick={() => void handleRsvp('yes')}
                          >
                            <ThumbsUp className="h-4 w-4" aria-hidden />
                            Dabei
                          </button>
                          <button
                            type="button"
                            disabled={!trainingCancellationAllowed && rsvpStatus !== 'no'}
                            className={dsRsvpChoiceClass('no', rsvpStatus === 'no')}
                            onClick={() => {
                              if (!trainingCancellationAllowed && rsvpStatus !== 'no') return;
                              void handleRsvp('no');
                            }}
                          >
                            <ThumbsDown className="h-4 w-4" aria-hidden />
                            Absagen
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`mt-1 grid grid-cols-2 ${DS_STAT_GRID_GAP}`}>
                          <button
                            type="button"
                            className={dsRsvpChoiceClass('yes', rsvpStatus === 'yes')}
                            onClick={() => void handleRsvp('yes')}
                          >
                            <ThumbsUp className="h-4 w-4" aria-hidden />
                            Zusage
                          </button>
                          <button
                            type="button"
                            className={dsRsvpChoiceClass('no', rsvpStatus === 'no')}
                            onClick={() => void handleRsvp('no')}
                          >
                            <ThumbsDown className="h-4 w-4" aria-hidden />
                            Absage
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        )}

        {event.kind === 'match' && event.status === 'live' && event.match_id && !isAudienceMatchDetail ? (
          <Card className="flex flex-col gap-3">
            <CardTitle>Livespiel</CardTitle>
            <p className="text-[14px] text-white/75">
              Aufstellung, Spielstand und Ereignisse findest du im zentralen Livespiel unter „Live“.
            </p>
            <Link
              to={`/app/live?matchId=${encodeURIComponent(event.match_id)}`}
              className={`flex w-full min-h-[48px] items-center justify-center gap-2 ${dsPrimaryCtaClass()}`}
            >
              Zum Livespiel
              <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>
          </Card>
        ) : null}

        {event.kind === 'match' && canTrainerManageEvent && (
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
                {deletingEvent ? 'Löschen…' : 'Endgültig löschen'}
              </AppButton>
            </div>
          }
        >
          <p className="text-[14px] text-white/75">
            Diesen Termin wirklich löschen? Alle zugehörigen Spielbericht-, Liveticker-, Aufstellungs- und Statistikdaten
            werden entfernt.
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
