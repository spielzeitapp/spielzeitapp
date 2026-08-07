import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Users } from 'lucide-react';
import { usePlayers } from '../../hooks/usePlayers';
import { comparePlayerItems } from '../../lib/rosterPlayer';
import { matchLineupPath, matchPreparationPath } from '../../lib/matchPreparationAccess';
import { dsScheduleGlassButtonClass, dsSectionLabelClass, dsStatusChipClass, DS_LIST_GAP } from '../../lib/premiumDesignSystem';
import { MatchPlayerRow } from '../match/MatchPlayerRow';
import {
  fetchTournamentSquadPlayerIds,
  saveTournamentSquad,
} from '../../lib/tournamentSquad';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { pickFeaturedTournamentSlot } from './tournamentCenterUtils';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import { useDemoMode } from '../../demo/DemoContext';
import { useInternalBasePath } from '../../demo/demoPaths';

type Props = {
  tournamentEventId: string;
  teamSeasonId: string;
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  canManage?: boolean;
};

function normalizeAttendanceStatus(value: unknown): 'yes' | 'no' | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'yes' || raw === 'dabei' || raw === 'attending' || raw === 'confirmed' || raw === 'present') return 'yes';
  if (raw === 'no' || raw === 'abwesend' || raw === 'absent' || raw === 'declined') return 'no';
  return null;
}

type PrepStatus = 'available' | 'open' | 'absent';

function playerStatusFromAttendance(value: 'yes' | 'no' | null): PrepStatus {
  if (value === 'yes') return 'available';
  if (value === 'no') return 'absent';
  return 'open';
}

function LineupLink({
  slots,
  loading,
  basePath = '/app',
}: {
  slots: TournamentMatchSlotView[];
  loading: boolean;
  basePath?: '/app' | '/demo';
}) {
  const featured = pickFeaturedTournamentSlot(slots);
  const matchId = featured?.match_id?.trim() ?? '';
  const hasLineup = Boolean(featured?.has_lineup);
  const opponent = featured?.opponent_name ?? null;

  if (loading) return null;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-red-300/80" strokeWidth={2.25} aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">Aufstellung</span>
        </span>
        <span className={dsStatusChipClass(hasLineup ? 'present' : 'neutral')}>
          {hasLineup ? 'Vorbereitet' : 'Offen'}
        </span>
      </div>
      <p className="text-[11px] leading-snug text-white/50">
        {opponent
          ? `Formation und Startelf für vs ${opponent}.`
          : 'Formation, Startaufstellung und Ersatzspieler für das nächste Turnierspiel.'}
      </p>
      {!matchId ? (
        <p className="mt-2 text-[11px] text-white/40">Zuerst Turnierspiel anlegen oder importieren.</p>
      ) : (
        <Link
          to={matchLineupPath(matchId, basePath)}
          className={`mt-2 inline-flex min-h-[32px] w-full items-center justify-center rounded-full px-3 text-[11px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
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
  slots,
  loading: slotsLoading = false,
  canManage = false,
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
  const [attendanceByPlayerId, setAttendanceByPlayerId] = useState<Record<string, 'yes' | 'no'>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(true);

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
        const byPlayer: Record<string, 'yes' | 'no'> = {};
        if (data) {
          for (const [pid, status] of Object.entries(data.availabilityByPlayerId ?? {})) {
            const n = normalizeAttendanceStatus(status);
            if (n) byPlayer[pid.toLowerCase()] = n;
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
        const byPlayer: Record<string, 'yes' | 'no'> = {};
        for (const row of (data ?? []) as Array<{ player_id: string | null; status: unknown }>) {
          const pid = String(row.player_id ?? '').toLowerCase();
          if (!pid) continue;
          const status = normalizeAttendanceStatus(row.status);
          if (status) byPlayer[pid] = status;
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
    (playerId: string): 'yes' | 'no' | null => {
      const key = playerId.toLowerCase();
      const explicit = attendanceByPlayerId[key];
      if (explicit) return explicit;
      const player = players.find((p) => p.id.toLowerCase() === key);
      if (player?.is_injured) return 'no';
      return null;
    },
    [attendanceByPlayerId, players],
  );

  const squadSet = useMemo(() => new Set(squadIds), [squadIds]);

  const grouped = useMemo(() => {
    const sorted = [...players].sort(comparePlayerItems);
    const available: typeof sorted = [];
    const open: typeof sorted = [];
    const absent: typeof sorted = [];
    for (const p of sorted) {
      const st = playerStatusFromAttendance(getAttendance(p.id));
      if (st === 'available') available.push(p);
      else if (st === 'open') open.push(p);
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
    const { error } = await saveTournamentSquad(tournamentEventId, nextIds);
    setSaveBusy(false);
    if (error) {
      setSquadError(error);
      return false;
    }
    setSquadIds(nextIds);
    return true;
  };

  const toggleSquadPlayer = (playerId: string) => {
    if (saveBusy || getAttendance(playerId) === 'no') return;
    const next = squadSet.has(playerId)
      ? squadIds.filter((id) => id !== playerId)
      : [...squadIds, playerId];
    void persistSquad(next);
  };

  if (!canManage) return null;

  const dataLoading = slotsLoading || playersLoading || squadLoading || attendanceLoading;
  const featured = pickFeaturedTournamentSlot(slots);
  const featuredMatchId = featured?.match_id?.trim() ?? '';

  const renderGroup = (title: string, list: typeof players, status: PrepStatus) => (
    <section className="flex flex-col gap-1">
      <p className={`${dsSectionLabelClass()} !text-[9px]`}>{title}</p>
      {list.length === 0 ? (
        <p className="text-[11px] text-white/42">Keine Spieler</p>
      ) : (
        <div className={`flex flex-col ${DS_LIST_GAP}`}>
          {list.map((p) => {
            const inSquad = squadSet.has(p.id);
            const disabled = saveBusy || status === 'absent';
            return (
              <div key={p.id} className={disabled ? 'opacity-70' : ''}>
                <MatchPlayerRow
                  player={p}
                  selected={inSquad}
                  status={status === 'available' ? 'yes' : status === 'absent' ? 'no' : 'open'}
                  rightLabel={inSquad ? 'Im Kader' : undefined}
                  onClick={disabled ? undefined : () => toggleSquadPlayer(p.id)}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <section id="tournament-squad-section" className={TC_CARD}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-2`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`${TC_SECTION_LABEL} inline-flex items-center gap-1.5`}>
            <Users className="h-3.5 w-3.5 text-red-300/80" strokeWidth={2.25} aria-hidden />
            Turnierkader
          </p>
          <span className={dsStatusChipClass(squadIds.length > 0 ? 'present' : 'open')}>
            {squadIds.length} Spieler im Turnierkader
          </span>
        </div>

        <p className="text-[11px] leading-snug text-white/50">
          Einmal für das gesamte Turnier festlegen. Die Match-Vorbereitung einzelner Spiele nutzt diesen Kader als
          Vorauswahl — bestehende Spiel-Kader bleiben unverändert.
        </p>

        <div className="flex flex-wrap gap-1.5">
          <span className={dsStatusChipClass('present')}>✅ Zugesagt: {attendanceSummary.yes}</span>
          <span className={dsStatusChipClass('absent')}>❌ Abgesagt: {attendanceSummary.no}</span>
          <span className={dsStatusChipClass('open')}>❓ Offen: {attendanceSummary.open}</span>
        </div>

        {dataLoading ? (
          <p className="text-[12px] text-white/55">Lade Spieler…</p>
        ) : players.length === 0 ? (
          <p className="text-[12px] text-white/55">Keine Spieler im Team.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {renderGroup('ZUGESAGT', grouped.available, 'available')}
            {renderGroup('OFFEN', grouped.open, 'open')}
            {renderGroup('ABGESAGT', grouped.absent, 'absent')}
          </div>
        )}

        {squadError ? <p className="text-[11px] text-red-300/90">{squadError}</p> : null}

        {featuredMatchId ? (
          <Link
            to={matchPreparationPath(featuredMatchId)}
            className={`inline-flex min-h-[32px] w-full items-center justify-center rounded-full px-3 text-[11px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
          >
            Match-Vorbereitung für nächstes Spiel
          </Link>
        ) : null}

        <LineupLink slots={slots} loading={slotsLoading} basePath={basePath} />
      </div>
    </section>
  );
}
