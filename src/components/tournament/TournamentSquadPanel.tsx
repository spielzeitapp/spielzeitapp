import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../app/ui/Modal';
import { ClipboardList } from 'lucide-react';
import { usePlayers } from '../../hooks/usePlayers';
import { playerAvailabilityFromItem, resolveMatchEventRsvpStatus } from '../../lib/playerAvailability';
import { comparePlayerItems } from '../../lib/rosterPlayer';
import { matchLineupPath, matchPreparationPath } from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass, dsSecondaryCtaClass, dsScheduleGlassButtonClass, dsSectionLabelClass, dsStatusChipClass, DS_LIST_GAP } from '../../lib/premiumDesignSystem';
import { AttendanceStatCard } from '../events/AttendanceStatCard';
import { MatchPlayerRow } from '../match/MatchPlayerRow';
import { PremiumStatusBadge } from '../player/PremiumStatusBadge';
import {
  fetchTournamentSquadPlayerIds,
  getTournamentSquadPublication,
  publishTournamentSquad,
  saveTournamentSquad,
  type TournamentSquadPublication,
} from '../../lib/tournamentSquad';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { pickFeaturedTournamentSlot } from './tournamentCenterUtils';
import { useDemoMode } from '../../demo/DemoContext';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentStartsAt: string;
  tournamentTitle: string;
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  canManage?: boolean;
  onSaved?: () => void;
  onOpenTemplate?: () => void;
};

type PrepStatus = 'available' | 'open' | 'absent';

function LineupLink({
  slots,
  loading,
  basePath = '/app',
}: {
  slots: TournamentMatchSlotView[];
  loading: boolean;
  basePath?: '/app' | '/demo' | '/manager';
}) {
  const featured = pickFeaturedTournamentSlot(slots);
  const matchId = featured?.match_id?.trim() ?? '';
  const hasLineup = Boolean(featured?.has_lineup);
  const opponent = featured?.opponent_name ?? null;

  if (loading) return null;

  return (
    <div className="rounded-[18px] border sz-club-event-section px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 sz-club-accent-text" strokeWidth={2.25} aria-hidden />
          <span className="text-[16px] font-bold uppercase tracking-[0.1em] text-white/75">Aufstellung</span>
        </span>
        <span className={dsStatusChipClass(hasLineup ? 'present' : 'neutral')}>
          {hasLineup ? 'Vorbereitet' : 'Offen'}
        </span>
      </div>
      <p className="text-[16px] leading-snug text-white/65">
        {opponent
          ? `Formation und Startelf für vs ${opponent}.`
          : 'Formation, Startaufstellung und Ersatzspieler für das nächste Turnierspiel.'}
      </p>
      {!matchId ? (
        <p className="mt-2 text-[16px] text-white/40">Zuerst Turnierspiel anlegen oder importieren.</p>
      ) : (
        <Link
          to={matchLineupPath(matchId, basePath)}
          className={`mt-2 inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-3 text-[16px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
        >
          {hasLineup ? 'Aufstellung öffnen' : 'Aufstellung erstellen'}
        </Link>
      )}
    </div>
  );
}

export function TournamentSquadPanel({
  tournamentEventId,
  teamSeasonId,
  tournamentStartsAt,
  tournamentTitle,
  slots,
  loading: slotsLoading = false,
  canManage = false,
  onSaved,
  onOpenTemplate,
}: Props) {
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const basePath = useInternalBasePath();
  const { players: dbPlayers, loading: playersLoadingLive } = usePlayers(isDemo ? null : teamSeasonId);
  const players = isDemo && demo ? demo.players : dbPlayers;
  const playersLoading = isDemo ? false : playersLoadingLive;
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [squadLoading, setSquadLoading] = useState(true);
  const [squadError, setSquadError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [attendanceByPlayerId, setAttendanceByPlayerId] = useState<Record<string, string>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const [publication, setPublication] = useState<TournamentSquadPublication | null>(null);
  const [publicationLoading, setPublicationLoading] = useState(!isDemo);
  const [publicationLoadError, setPublicationLoadError] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const deliveryGroup = useId();
  const [feedOnly, setFeedOnly] = useState(false);
  const [messages, setMessages] = useState({ selected: '', notSelected: '' });

  useEffect(() => {
    if (isDemo || !canManage) return;
    let active = true;
    setPublicationLoading(true);
    setPublicationLoadError(null);
    void getTournamentSquadPublication(tournamentEventId).then(({ data, error }) => {
      if (!active) return;
      setPublication(data);
      setPublicationLoadError(error ? 'Veröffentlichungsstand konnte nicht geladen werden. Bitte neu öffnen.' : null);
      setPublicationLoading(false);
    });
    return () => { active = false; };
  }, [canManage, isDemo, tournamentEventId]);

  const reloadSquad = useCallback(async () => {
    setSquadLoading(true);
    setSquadError(null);
    const { data, error } = await fetchTournamentSquadPlayerIds(tournamentEventId);
    setSquadIds(data);
    setSquadError(error);
    setSquadLoading(false);
  }, [tournamentEventId]);

  useEffect(() => {
    void reloadSquad();
  }, [reloadSquad]);

  useEffect(() => {
    let cancelled = false;
    setAttendanceLoading(true);
    void (async () => {
      if (isDemo && demo) {
        const byEvent = demo.getAttendanceByEventIds([tournamentEventId]);
        const data = byEvent[tournamentEventId];
        const byPlayer: Record<string, string> = {};
        if (data) {
          for (const [pid, status] of Object.entries(data.availabilityByPlayerId ?? {})) {
            if (typeof status === 'string') byPlayer[pid.toLowerCase()] = status;
          }
        }
        if (!cancelled) {
          setAttendanceByPlayerId(byPlayer);
          setAttendanceLoading(false);
        }
        return;
      }
      const { supabase } = await import('../../lib/supabaseClient');
      const { data, error } = await supabase
        .from('event_attendance')
        .select('player_id, status')
        .eq('event_id', tournamentEventId);
      if (cancelled) return;
      if (error) {
        setAttendanceByPlayerId({});
      } else {
        const byPlayer: Record<string, string> = {};
        for (const row of (data ?? []) as Array<{ player_id: string | null; status: string | null }>) {
          const pid = String(row.player_id ?? '').toLowerCase();
          if (pid && row.status) byPlayer[pid] = row.status;
        }
        setAttendanceByPlayerId(byPlayer);
      }
      setAttendanceLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentEventId, isDemo, demo]);

  const getAttendance = useCallback(
    (player: (typeof players)[number]) => resolveMatchEventRsvpStatus(
      attendanceByPlayerId[player.id.toLowerCase()],
      playerAvailabilityFromItem(player),
      tournamentStartsAt,
    ),
    [attendanceByPlayerId, tournamentStartsAt],
  );

  const squadSet = useMemo(() => new Set(squadIds), [squadIds]);

  const grouped = useMemo(() => {
    const sorted = [...players].sort(comparePlayerItems);
    const available: typeof sorted = [];
    const open: typeof sorted = [];
    const absent: typeof sorted = [];
    for (const p of sorted) {
      const status = getAttendance(p);
      if (status === 'yes') available.push(p);
      else if (status === 'unset') open.push(p);
      else absent.push(p);
    }
    return { available, open, absent };
  }, [players, getAttendance]);

  const attendanceSummary = useMemo(
    () => ({
      yes: grouped.available.length,
      open: grouped.open.length,
      no: grouped.absent.length,
    }),
    [grouped],
  );

  const persistSquad = async (nextIds: string[]) => {
    setSaveBusy(true);
    setSquadError(null);
    const { error } = await saveTournamentSquad(tournamentEventId, nextIds, squadIds);
    setSaveBusy(false);
    if (error) {
      setSquadError(error);
      return false;
    }
    setSquadIds(nextIds);
    onSaved?.();
    return true;
  };

  const publicationMatches = Boolean(publication &&
    publication.selected_player_ids.length === squadIds.length &&
    publication.selected_player_ids.every(id => squadSet.has(id)));
  const publishLabel = publication ? 'Kader aktualisieren' : 'Kader veröffentlichen';

  const openPublishConfirmation = () => {
    setMessages({
      selected: `Für „${tournamentTitle}“ ist ein mit deinem Konto verknüpfter Spieler im Turnierkader.`.slice(0, 500),
      notSelected: `Für „${tournamentTitle}“ seid ihr diesmal nicht im Turnierkader.`.slice(0, 500),
    });
    setPublishError(null);
    setFeedOnly(false);
    setConfirming(true);
  };

  const confirmPublication = async () => {
    if (publishBusy || saveBusy || !squadIds.length || publicationMatches) return;
    setPublishError(null);
    setPublishBusy(true);
    try {
      if (isDemo) {
        setPublication({ selected_player_ids: [...squadIds], version: (publication?.version ?? 0) + 1, published_at: new Date().toISOString() });
      } else {
        const { data, error } = await publishTournamentSquad(tournamentEventId, squadIds, publication?.version ?? 0, feedOnly ? null : messages);
        if (error || !data) {
          setPublishError(error?.message ?? 'Der Kader konnte nicht veröffentlicht werden.');
          return;
        }
        setPublication(data);
      }
      setConfirming(false);
    } catch {
      setPublishError('Die Veröffentlichung konnte nicht bestätigt werden. Bitte erneut versuchen.');
    } finally {
      setPublishBusy(false);
    }
  };

  const toggleSquadPlayer = (playerId: string) => {
    if (saveBusy || publishBusy || confirming) return;
    const next = squadSet.has(playerId)
      ? squadIds.filter((id) => id !== playerId)
      : [...squadIds, playerId];
    void persistSquad(next);
  };

  if (!canManage) return null;

  const dataLoading = slotsLoading || playersLoading || squadLoading || attendanceLoading;
  const featured = pickFeaturedTournamentSlot(slots);
  const featuredMatchId = featured?.match_id?.trim() ?? '';

  const missingConfirmedIds = grouped.available
    .filter((player) => !squadSet.has(player.id))
    .map((player) => player.id);

  const renderGroup = (title: string, list: typeof players, status: PrepStatus) => (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className={`${dsSectionLabelClass()} !text-[11px]`}>{title}</p>
        {status === 'available' && list.length > 0 ? (
          <button
            type="button"
            className={`${dsScheduleGlassButtonClass()} min-h-11 px-3 text-sm disabled:opacity-50`}
            disabled={saveBusy || publishBusy || confirming || missingConfirmedIds.length === 0}
            onClick={() => void persistSquad([...squadIds, ...missingConfirmedIds])}
            aria-label="Alle zugesagten Spieler auswählen"
          >
            Alle auswählen
          </button>
        ) : null}
      </div>
      {list.length === 0 ? (
        <p className="text-[12px] text-white/45">Keine Spieler</p>
      ) : (
        <ul className={`flex flex-col ${DS_LIST_GAP}`}>
          {list.map((p) => {
            const inSquad = squadSet.has(p.id);
            const reason = getAttendance(p);
            const disabled = saveBusy || publishBusy || confirming || (status === 'absent' && !inSquad);
            return (
              <li key={p.id} className={disabled ? 'opacity-70' : ''}>
                <MatchPlayerRow
                  player={{ ...p, is_injured: reason === 'injured' }}
                  nameStatus={reason === 'sick' ? <PremiumStatusBadge label="Krank" tone="sick" /> : undefined}
                  status={status === 'available' ? 'yes' : status === 'absent' ? 'no' : 'open'}
                  rightLabel={inSquad ? 'Im Kader' : undefined}
                  layout="team-roster"
                  hideLaz
                  hideNumber
                  hideSubline
                  onClick={disabled ? undefined : () => toggleSquadPlayer(p.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <section id="tournament-squad-section" aria-label="Turnierkader" className="flex min-w-0 flex-col gap-3">
      <div className="grid w-full grid-cols-3 gap-2">
        <AttendanceStatCard label="Zugesagt" value={attendanceSummary.yes} tone="present" />
        <AttendanceStatCard label="Abgesagt" value={attendanceSummary.no} tone="absent" />
        <AttendanceStatCard label="Offen" value={attendanceSummary.open} tone="open" />
      </div>

      {!dataLoading ? (
        <p className="text-sm font-medium text-white/65" role="status">
          <strong className="text-white">{squadIds.length}</strong> im Turnierkader
        </p>
      ) : null}

      <button type="button" className={`${dsPrimaryCtaClass()} min-h-11 w-full disabled:opacity-45`}
        disabled={dataLoading || publicationLoading || Boolean(publicationLoadError) || Boolean(squadError) ||
          saveBusy || publishBusy || squadIds.length === 0 || publicationMatches}
        onClick={openPublishConfirmation}>
        {publishLabel}
      </button>
      {publicationLoadError ? <p role="alert" className="text-sm text-red-300">{publicationLoadError}</p> : null}
      {publication ? <p role="status" className="text-sm text-white/65">
        {publicationMatches
          ? isDemo ? 'Turnierkader in der Demo veröffentlicht.' : 'Turnierkader im Team-Feed veröffentlicht.'
          : 'Die aktuelle Auswahl ist gespeichert. Die Änderungen können veröffentlicht werden.'}
      </p> : null}

      <Modal open={confirming} title={publishLabel} className="tournamentWorkflowModal"
        onClose={() => { if (!publishBusy) setConfirming(false); }}
        footer={<div className="grid w-full grid-cols-2 gap-2">
          <button type="button" className={`${dsSecondaryCtaClass()} min-h-11`} disabled={publishBusy}
            onClick={() => setConfirming(false)}>Abbrechen</button>
          <button type="button" className={`${dsPrimaryCtaClass()} min-h-11 disabled:opacity-45`}
            disabled={publishBusy || (!feedOnly && (!messages.selected.trim() || !messages.notSelected.trim()))}
            onClick={() => void confirmPublication()}>
            {publishBusy ? 'Speichert…' : publication ? 'Aktualisieren' : 'Veröffentlichen'}
          </button>
        </div>}>
        <p className="text-sm text-white/70">
          {squadIds.length} Spieler im Turnierkader. Nach der Bestätigung erscheint der Kader im Team-Feed.
        </p>
        <fieldset className="mt-4 space-y-2" disabled={publishBusy}>
          <legend className="mb-2 text-sm font-bold">Veröffentlichen in</legend>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/15 px-3 text-sm font-semibold">
            <input type="radio" name={deliveryGroup} checked={feedOnly} onChange={() => setFeedOnly(true)} />
            Nur im Team-Feed
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/15 px-3 text-sm font-semibold">
            <input type="radio" name={deliveryGroup} checked={!feedOnly} onChange={() => setFeedOnly(false)} />
            Team-Feed und Benachrichtigungen
          </label>
        </fieldset>
        {!feedOnly && <>
          <label className="mt-4 block text-sm font-semibold">
            Für Spieler im Kader
            <textarea className="mt-1 w-full rounded-xl border border-white/15 bg-black/35 p-3 text-sm"
              rows={3} maxLength={500} disabled={publishBusy} value={messages.selected}
              onChange={event => setMessages({ ...messages, selected: event.target.value })} />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Für Spieler außerhalb des Kaders
            <textarea className="mt-1 w-full rounded-xl border border-white/15 bg-black/35 p-3 text-sm"
              rows={3} maxLength={500} disabled={publishBusy} value={messages.notSelected}
              onChange={event => setMessages({ ...messages, notSelected: event.target.value })} />
          </label>
        </>}
        {publishError ? <p role="alert" className="mt-2 text-sm text-red-300">{publishError}</p> : null}
      </Modal>

      {dataLoading ? (
        <p className="text-[14px] text-white/55">Lade Spieler…</p>
      ) : players.length === 0 ? (
        <p className="text-[14px] text-white/55">Keine Spieler im Team.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {renderGroup('ZUGESAGT', grouped.available, 'available')}
          {renderGroup('OFFEN', grouped.open, 'open')}
          {renderGroup('ABGESAGT', grouped.absent, 'absent')}
        </div>
      )}

      {squadError ? <p className="text-[16px] text-red-300/90">{squadError}</p> : null}

      {featuredMatchId ? (
        <Link
          to={matchPreparationPath(featuredMatchId, basePath)}
          className={`inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-3 text-[16px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
        >
          Match-Vorbereitung für nächstes Spiel
        </Link>
      ) : null}

      {!featuredMatchId && onOpenTemplate ? <div className="space-y-3 rounded-xl border sz-club-surface p-4"><p className="text-[16px] text-white/75">Block A und B schon vor dem Spielplan vorbereiten.</p><button type="button" className={`${dsScheduleGlassButtonClass()} min-h-12 w-full !text-[16px]`} onClick={onOpenTemplate}>Grundaufstellung & Blöcke planen</button></div> : <LineupLink slots={slots} loading={slotsLoading} basePath={basePath} />}
    </section>
  );
}
