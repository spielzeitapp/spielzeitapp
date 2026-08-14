import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import { comparePlayerItems } from '../../lib/rosterPlayer';
import { saveMatchSquadOnly } from '../../lib/liveMatchService';
import {
  canMutateMatchPreparation,
  friendlyMatchLineupWriteError,
  isMatchSquadEditable,
  matchLineupPath,
} from '../../lib/matchPreparationAccess';
import {
  fetchTournamentEventIdForMatch,
  fetchTournamentSquadPlayerIds,
  resolveAttendanceEventIdForMatch,
} from '../../lib/tournamentSquad';
import { fetchTournamentMatchSlots } from '../../lib/tournamentPlan';
import {
  copyTournamentLineupBetweenMatches,
  detectTournamentLineupCopyContext,
  type TournamentLineupCopyContext,
  type TournamentLineupCopyMode,
} from '../../lib/tournamentLineupCopy';
import { MinimumPlaytimeMatchSettings } from '../../components/live/MinimumPlaytimeMatchSettings';
import { MatchdayFeedAutomationSettings } from '../../components/match/MatchdayFeedAutomationSettings';
import {
  DEFAULT_MINIMUM_PLAYTIME_MINUTES,
  DEFAULT_PLANNED_MATCH_MINUTES,
} from '../../lib/minimumPlaytime';
import { supabase } from '../../lib/supabaseClient';
import { normalizeOefbImportedTeamName } from '../../lib/oefbTeamNameNormalize';
import { MatchPlayerRow } from '../../components/match/MatchPlayerRow';
import { premiumPlayerDisplayName } from '../../lib/premiumPlayerCard';
import {
  dsBrandKickerClass,
  dsPageAtmosphereClass,
  dsPageContentClass,
  dsPageHeaderClass,
  dsPageHeroGlowClass,
  dsPageShellClass,
  dsPageSubtitleClass,
  dsPageTitleClass,
  dsPrimaryCtaClass,
  dsSecondaryCtaClass,
  dsSectionLabelClass,
  dsStatusChipClass,
  dsStickyCtaBarClass,
  DS_LIST_GAP,
  DS_SECTION_GAP,
  type DsChipTone,
} from '../../lib/premiumDesignSystem';
import { useDemoMode } from '../../demo/DemoContext';
import { useInternalBasePath } from '../../demo/demoPaths';
import { getDemoTrainingParticipationPct } from '../../demo/demoPlayers';
import { dbStatusToTrainingAttendance } from '../../lib/trainingAttendance';
import { useActiveTeamSeason } from '../../hooks/useActiveTeamSeason';
import { normalizeRole } from '../../lib/roles';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  status: string | null;
  live_started_at: string | null;
  minimum_playtime_enabled: boolean | null;
  minimum_playtime_minutes: number | null;
  planned_match_minutes: number | null;
  auto_matchday_feed_enabled: boolean | null;
};

type PrepStatus = 'available' | 'open' | 'absent';

function normalizeAttendanceStatus(value: unknown): 'yes' | 'no' | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'yes' || raw === 'dabei' || raw === 'attending' || raw === 'confirmed' || raw === 'present') return 'yes';
  if (raw === 'no' || raw === 'abwesend' || raw === 'absent' || raw === 'declined') return 'no';
  return null;
}

function playerStatusFromAttendance(value: 'yes' | 'no' | null): PrepStatus {
  if (value === 'yes') return 'available';
  if (value === 'no') return 'absent';
  return 'open';
}

export const MatchPreparationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('matchId')?.trim() || null;
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const basePath = useInternalBasePath();
  const { role: roleFromHook } = useActiveTeamSeason();
  const canManage = isDemo || canMutateMatchPreparation(normalizeRole(roleFromHook));
  const [matchRow, setMatchRow] = useState<MatchRowLite | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [restoredSelectedPlayers, setRestoredSelectedPlayers] = useState<string[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [attendanceByPlayerId, setAttendanceByPlayerId] = useState<Record<string, 'yes' | 'no'>>({});
  const [lineupPlayerIds, setLineupPlayerIds] = useState<Set<string>>(() => new Set());
  const [lineupRemoveConfirm, setLineupRemoveConfirm] = useState<{ playerId: string; name: string } | null>(
    null,
  );
  const [squadSaveBusy, setSquadSaveBusy] = useState(false);
  const [tournamentSquadIds, setTournamentSquadIds] = useState<string[]>([]);
  const [tournamentEventId, setTournamentEventId] = useState<string | null>(null);
  const [tournamentContextReady, setTournamentContextReady] = useState(false);
  const [lineupCopyContext, setLineupCopyContext] = useState<TournamentLineupCopyContext | null>(null);
  const [lineupCopyBusy, setLineupCopyBusy] = useState(false);
  const [lineupCopyError, setLineupCopyError] = useState<string | null>(null);
  const [lineupCopyConfirm, setLineupCopyConfirm] = useState(false);

  // Eltern/Fans: Direct-Route Guard → read-only Aufstellung
  useEffect(() => {
    if (isDemo || !matchId || matchLoading) return;
    if (canManage) return;
    navigate(`${basePath}/match-lineup?matchId=${encodeURIComponent(matchId)}`, { replace: true });
  }, [isDemo, matchId, matchLoading, canManage, navigate, basePath]);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setMatchLoading(false);
      setMatchError('Keine Match-ID übergeben.');
      return () => {
        cancelled = true;
      };
    }

    if (isDemo && demo) {
      const lite = demo.getDemoMatch(matchId);
      const prep = demo.getDemoMatchPrep(matchId);
      if (!lite || !prep) {
        setMatchRow(null);
        setMatchError('Spiel nicht gefunden.');
        setMatchLoading(false);
        return () => {
          cancelled = true;
        };
      }
      setMatchRow({
        id: lite.id,
        team_season_id: lite.team_season_id,
        opponent: lite.opponent,
        status: lite.status,
        live_started_at: lite.live_started_at,
        minimum_playtime_enabled: lite.minimum_playtime_enabled,
        minimum_playtime_minutes: lite.minimum_playtime_minutes,
        planned_match_minutes: lite.planned_match_minutes,
        auto_matchday_feed_enabled: lite.auto_matchday_feed_enabled,
      });
      setRestoredSelectedPlayers(prep.squadPlayerIds);
      setSelectedPlayers(prep.squadPlayerIds);
      setSelectionInitialized(true);
      const onField = new Set<string>();
      for (const pid of Object.values(prep.slots)) {
        if (pid) onField.add(pid);
      }
      setLineupPlayerIds(onField);
      setMatchLoading(false);
      setMatchError(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setMatchLoading(true);
      setMatchError(null);
      const [{ data, error }, lineupRes, benchRes] = await Promise.all([
        supabase
          .from('matches')
          .select(
            'id, team_season_id, opponent, status, live_started_at, minimum_playtime_enabled, minimum_playtime_minutes, planned_match_minutes, auto_matchday_feed_enabled',
          )
          .eq('id', matchId)
          .maybeSingle(),
        supabase.from('match_lineup').select('player_id, slot').eq('match_id', matchId),
        supabase.from('match_bench').select('player_id').eq('match_id', matchId),
      ]);
      if (cancelled) return;
      if (error || !data) {
        setMatchRow(null);
        setMatchError(error?.message ?? 'Spiel nicht gefunden.');
      } else {
        setMatchRow(data as MatchRowLite);
        const restored = new Set<string>();
        const onLineup = new Set<string>();
        for (const row of (lineupRes.data ?? []) as Array<{ player_id: string | null; slot?: string | null }>) {
          if (row.player_id) {
            restored.add(row.player_id);
            if (String(row.slot ?? '').trim()) onLineup.add(row.player_id);
          }
        }
        for (const row of (benchRes.data ?? []) as Array<{ player_id: string | null }>) {
          if (row.player_id) restored.add(row.player_id);
        }
        const restoredList = [...restored];
        setRestoredSelectedPlayers(restoredList);
        setSelectedPlayers(restoredList);
        setLineupPlayerIds(onLineup);
      }
      setMatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, isDemo, demo]);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setTournamentSquadIds([]);
      setTournamentEventId(null);
      setTournamentContextReady(true);
      return () => {
        cancelled = true;
      };
    }
    setTournamentContextReady(false);
    void (async () => {
      const eventId = await fetchTournamentEventIdForMatch(matchId);
      if (cancelled) return;
      setTournamentEventId(eventId);
      if (!eventId) {
        setTournamentSquadIds([]);
        setTournamentContextReady(true);
        return;
      }
      const { data } = await fetchTournamentSquadPlayerIds(eventId);
      if (!cancelled) {
        setTournamentSquadIds(data);
        setTournamentContextReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    let cancelled = false;
    if (!matchId || !tournamentEventId || !canManage) {
      setLineupCopyContext(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const slotsRes = await fetchTournamentMatchSlots(tournamentEventId);
      if (cancelled || slotsRes.error) return;
      const target =
        slotsRes.data.find((s) => (s.match_id ?? '').trim() === matchId) ?? null;
      if (!target) {
        setLineupCopyContext(null);
        return;
      }
      const ctx = await detectTournamentLineupCopyContext(slotsRes.data, target);
      if (!cancelled) setLineupCopyContext(ctx);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, tournamentEventId, canManage, restoredSelectedPlayers.length]);

  const runPrepLineupCopy = async (mode: TournamentLineupCopyMode) => {
    if (!lineupCopyContext || !matchId) return;
    const sourceMatchId = lineupCopyContext.sourceSlot.match_id?.trim() ?? '';
    if (!sourceMatchId) return;
    if (lineupCopyContext.targetHasExistingLineup && !lineupCopyConfirm) {
      setLineupCopyConfirm(true);
      return;
    }
    setLineupCopyBusy(true);
    setLineupCopyError(null);
    const result = await copyTournamentLineupBetweenMatches({
      sourceMatchId,
      targetMatchId: matchId,
      mode,
      tournamentEventId: tournamentEventId ?? undefined,
      replaceExisting: lineupCopyConfirm || lineupCopyContext.targetHasExistingLineup,
    });
    setLineupCopyBusy(false);
    if (result.error) {
      setLineupCopyError(result.error);
      return;
    }
    setLineupCopyConfirm(false);
    if (mode === 'squad_only') {
      const { data } = await fetchTournamentSquadPlayerIds(tournamentEventId!);
      setSelectedPlayers(data);
      setRestoredSelectedPlayers(data);
      return;
    }
    navigate(matchLineupPath(matchId, basePath), {
      state: result.formationId ? { formationId: result.formationId } : undefined,
    });
  };

  const teamSeasonId = matchRow?.team_season_id ?? null;
  const { players: livePlayers, loading: playersLoadingLive, error: playersErrorLive } = usePlayers(
    isDemo ? null : teamSeasonId,
  );
  const players = isDemo && demo ? demo.players : livePlayers;
  const playersLoading = isDemo ? false : playersLoadingLive;
  const playersError = isDemo ? null : playersErrorLive;
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setAttendanceByPlayerId({});
      setAttendanceLoading(false);
      setAttendanceError(null);
      return () => {
        cancelled = true;
      };
    }

    if (isDemo && demo) {
      const lite = demo.getDemoMatch(matchId);
      const eventId = lite?.event_id;
      if (!eventId) {
        setAttendanceByPlayerId({});
        setAttendanceLoading(false);
        return () => {
          cancelled = true;
        };
      }
      const bucket = demo.getAttendanceByEventIds([eventId])[eventId];
      const byPlayer: Record<string, 'yes' | 'no'> = {};
      for (const [pid, raw] of Object.entries(bucket?.availabilityByPlayerId ?? {})) {
        const ui = dbStatusToTrainingAttendance(raw);
        const key = pid.toLowerCase();
        if (ui === 'present') byPlayer[key] = 'yes';
        else if (ui === 'absent' || ui === 'sick' || ui === 'injured' || ui === 'external') byPlayer[key] = 'no';
      }
      setAttendanceByPlayerId(byPlayer);
      setAttendanceLoading(false);
      setAttendanceError(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      const eventId = await resolveAttendanceEventIdForMatch(matchId);
      if (cancelled) return;
      if (!eventId) {
        setAttendanceByPlayerId({});
        setAttendanceLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('event_attendance')
        .select('player_id, status')
        .eq('event_id', eventId);
      if (cancelled) return;
      if (error) {
        setAttendanceByPlayerId({});
        setAttendanceError(error.message);
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
  }, [matchId, isDemo, demo, demo?.attendanceRows]);

  const getAttendance = (playerId: string): 'yes' | 'no' | null => {
    const key = playerId.toLowerCase();
    const explicit = attendanceByPlayerId[key];
    if (explicit) return explicit;
    const player = players.find((p) => p.id.toLowerCase() === key);
    if (player?.is_injured && matchRow && !matchRow.live_started_at) {
      return 'no';
    }
    return null;
  };

  const squadEditable = useMemo(
    () =>
      canManage &&
      (matchRow
        ? isMatchSquadEditable({ status: matchRow.status, live_started_at: matchRow.live_started_at })
        : true),
    [matchRow, canManage],
  );

  const tournamentSquadSet = useMemo(() => new Set(tournamentSquadIds), [tournamentSquadIds]);

  const sortWithSquadPreference = useCallback(
    (list: typeof players) =>
      [...list].sort((a, b) => {
        const aIn = tournamentSquadSet.has(a.id) ? 0 : 1;
        const bIn = tournamentSquadSet.has(b.id) ? 0 : 1;
        if (aIn !== bIn) return aIn - bIn;
        return comparePlayerItems(a, b);
      }),
    [tournamentSquadSet],
  );

  const grouped = useMemo(() => {
    const sorted = sortWithSquadPreference(players);
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
  }, [players, attendanceByPlayerId, sortWithSquadPreference]);

  const selectedPlayersForSquad = useMemo(
    () => selectedPlayers.filter((id) => getAttendance(id) !== 'no'),
    [selectedPlayers, attendanceByPlayerId],
  );
  const selectedSet = useMemo(() => new Set(selectedPlayersForSquad), [selectedPlayersForSquad]);

  const summary = useMemo(
    () => ({
      yes: grouped.available.length,
      open: grouped.open.length,
      no: grouped.absent.length,
      selected: selectedPlayersForSquad.length,
    }),
    [grouped.available.length, grouped.open.length, grouped.absent.length, selectedPlayersForSquad.length],
  );

  useEffect(() => {
    if (selectionInitialized) return;
    if (matchLoading || playersLoading || attendanceLoading || !tournamentContextReady) return;
    if (players.length === 0) return;

    if (restoredSelectedPlayers.length > 0) {
      setSelectedPlayers(restoredSelectedPlayers.filter((id) => getAttendance(id) !== 'no'));
      setSelectionInitialized(true);
      return;
    }

    // Turnierspiel: Turnierkader ist die Basis für ALLE eigenen Spiele (auch Spiel 2+).
    if (tournamentSquadIds.length > 0) {
      setSelectedPlayers(tournamentSquadIds.filter((id) => getAttendance(id) !== 'no'));
      setSelectionInitialized(true);
      return;
    }

    // Demo: Seed-Kader aus Prep behalten, falls Match schon geladen.
    if (isDemo && demo && matchId) {
      const prep = demo.getDemoMatchPrep(matchId);
      if (prep && prep.squadPlayerIds.length > 0) {
        setSelectedPlayers(prep.squadPlayerIds.filter((id) => getAttendance(id) !== 'no'));
        setRestoredSelectedPlayers(prep.squadPlayerIds);
        setSelectionInitialized(true);
        return;
      }
    }

    const initial = new Set<string>();
    for (const p of players) {
      if (getAttendance(p.id) === 'yes') initial.add(p.id);
    }
    setSelectedPlayers([...initial]);
    setSelectionInitialized(true);
  }, [
    selectionInitialized,
    matchLoading,
    playersLoading,
    attendanceLoading,
    tournamentContextReady,
    players,
    restoredSelectedPlayers,
    attendanceByPlayerId,
    tournamentSquadIds,
    isDemo,
    demo,
    matchId,
  ]);

  const persistSquadSelection = async (nextSquadIds: string[]): Promise<boolean> => {
    if (!matchId) return false;
    if (!canManage) {
      setPersistError('Keine Berechtigung zum Speichern des Kaders.');
      return false;
    }
    setPersistError(null);
    setSquadSaveBusy(true);
    if (isDemo && demo) {
      demo.setDemoMatchSquad(matchId, nextSquadIds);
      setSquadSaveBusy(false);
      setRestoredSelectedPlayers(nextSquadIds);
      setLineupPlayerIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (nextSquadIds.includes(id)) next.add(id);
        }
        return next;
      });
      return true;
    }
    const { error } = await saveMatchSquadOnly(matchId, nextSquadIds);
    setSquadSaveBusy(false);
    if (error) {
      setPersistError(friendlyMatchLineupWriteError(error));
      console.warn('[MatchPreparation] squad save failed', { matchId, error });
      return false;
    }
    setRestoredSelectedPlayers(nextSquadIds);
    setLineupPlayerIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (nextSquadIds.includes(id)) next.add(id);
      }
      return next;
    });
    return true;
  };

  const applyRemoveFromSquad = (playerId: string) => {
    setSelectionInitialized(true);
    setSelectedPlayers((prev) => prev.filter((id) => id !== playerId));
    setLineupPlayerIds((prev) => {
      if (!prev.has(playerId)) return prev;
      const next = new Set(prev);
      next.delete(playerId);
      return next;
    });
  };

  const togglePlayer = (playerId: string, status: PrepStatus) => {
    if (!squadEditable || status === 'absent') return;
    setSelectionInitialized(true);
    if (selectedSet.has(playerId)) {
      if (lineupPlayerIds.has(playerId)) {
        const p = players.find((x) => x.id === playerId);
        setLineupRemoveConfirm({
          playerId,
          name: premiumPlayerDisplayName(p ?? { display_name: 'Spieler' }),
        });
        return;
      }
      const nextSquad = selectedPlayersForSquad.filter((id) => id !== playerId);
      applyRemoveFromSquad(playerId);
      void persistSquadSelection(nextSquad);
      return;
    }
    setSelectedPlayers((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
  };

  const confirmRemoveFromLineupAndSquad = async () => {
    if (!lineupRemoveConfirm || !matchId) return;
    const { playerId } = lineupRemoveConfirm;
    const nextSquad = selectedPlayersForSquad.filter((id) => id !== playerId);
    setLineupRemoveConfirm(null);
    applyRemoveFromSquad(playerId);
    await persistSquadSelection(nextSquad);
  };

  const renderSection = (title: string, list: typeof players, status: PrepStatus) => (
    <section className={`flex flex-col ${DS_SECTION_GAP}`}>
      <h2 className={dsSectionLabelClass()}>{title}</h2>
      {list.length === 0 ? <p className="text-xs text-white/42">Keine Spieler</p> : null}
      <div className={`flex flex-col ${DS_LIST_GAP}`}>
        {list.map((p) => {
          const selected = selectedSet.has(p.id);
          const disabled = !squadEditable || status === 'absent';
          const trainPct = isDemo ? getDemoTrainingParticipationPct(p.id) : null;
          return (
            <div key={p.id} className={disabled ? 'opacity-70' : ''}>
              <MatchPlayerRow
                player={p}
                selected={selected}
                status={status === 'available' ? 'yes' : status === 'absent' ? 'no' : 'open'}
                rightLabel={
                  status === 'absent' ? 'Abwesend' : selected ? '✓ IM KADER' : 'NICHT IM KADER'
                }
                metricHint={trainPct != null ? `Training ${trainPct} %` : null}
                onClick={disabled ? undefined : () => togglePlayer(p.id, status)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );

  if (matchLoading) {
    return <div className="min-h-[100dvh] p-4 text-sm text-white/60">Lade Match…</div>;
  }

  if (!canManage && matchId) {
    return <div className="min-h-[100dvh] p-4 text-sm text-white/60">Weiterleitung…</div>;
  }

  if (matchError || !matchId) {
    return (
      <div className="min-h-[100dvh] p-4 text-white">
        <p className="text-sm text-red-400">{matchError ?? 'Ungültiger Aufruf.'}</p>
        <Link to={`${basePath}/termine`} className="mt-3 inline-block text-sm font-semibold text-red-300 underline">
          Zurück zu Termine
        </Link>
      </div>
    );
  }

  const onContinueToLineup = async () => {
    if (!matchId || selectedPlayersForSquad.length === 0 || persisting || squadSaveBusy) return;
    setPersistError(null);
    setPersisting(true);
    const ok = await persistSquadSelection(selectedPlayersForSquad);
    setPersisting(false);
    if (!ok) return;
    navigate(`${basePath}/match-lineup?matchId=${encodeURIComponent(matchId)}`, {
      state: { selectedPlayers: selectedPlayersForSquad },
    });
  };

  return (
    <div className={dsPageShellClass()}>
      <div className={dsPageAtmosphereClass()} aria-hidden />
      <header className={`${dsPageHeaderClass()} relative overflow-hidden`}>
        <div className={dsPageHeroGlowClass()} aria-hidden />
        <div className="relative mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-2 inline-flex min-h-[36px] items-center rounded-[14px] border border-transparent bg-[rgba(18,18,22,0.88)] px-2.5 text-xs font-semibold text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_14px_rgba(255,40,40,0.05)] hover:bg-[rgba(22,14,16,0.92)]"
            >
              ← Zurück
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400/90">SpielzeitApp</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight">Match-Vorbereitung</h1>
            <p className="mt-1 text-sm text-white/55">
              {matchRow?.opponent
                ? `vs. ${normalizeOefbImportedTeamName(matchRow.opponent) || matchRow.opponent}`
                : 'Spiel'}
            </p>
          </div>
          <span className={dsStatusChipClass('selected')}>Trainer</span>
        </div>
      </header>

      <main className={dsPageContentClass(`mx-auto max-w-xl flex flex-col ${DS_SECTION_GAP} px-4 py-5 pb-48`)}>
        {(playersLoading || attendanceLoading) ? <p className="text-sm text-white/55">Lade Spieler und Status…</p> : null}
        {(playersError || attendanceError) ? <p className="text-sm text-red-400">{playersError ?? attendanceError}</p> : null}
        {!squadEditable ? (
          <p className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
            Kader ist gesperrt — Änderungen nur noch über Live-Wechsel.
          </p>
        ) : null}
        {tournamentEventId && tournamentSquadIds.length > 0 && restoredSelectedPlayers.length === 0 ? (
          <p className="rounded-xl border border-purple-500/20 bg-purple-950/20 px-3 py-2 text-xs text-purple-100/90">
            Turnierkader als Vorauswahl — du kannst die Auswahl pro Spiel anpassen.
          </p>
        ) : null}
        {canManage && lineupCopyContext && lineupCopyContext.sourceStarterCount > 0 ? (
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/30 px-3 py-3">
            <p className="text-[13px] font-bold text-purple-50">Aufstellung vom letzten Spiel übernehmen?</p>
            <p className="mt-1 text-[11px] leading-snug text-purple-100/75">
              Formation, Startelf und Bank werden übernommen — ohne erneute Spielerauswahl.
            </p>
            {lineupCopyConfirm ? (
              <p className="mt-2 text-[11px] text-amber-100/90">
                Bestehende Aufstellung wird ersetzt — erneut tippen zum Bestätigen.
              </p>
            ) : null}
            {lineupCopyError ? <p className="mt-2 text-[11px] text-red-300">{lineupCopyError}</p> : null}
            <div className="mt-2.5 flex flex-col gap-1.5">
              <button
                type="button"
                disabled={lineupCopyBusy}
                onClick={() => void runPrepLineupCopy('full')}
                className={`${dsPrimaryCtaClass()} min-h-[44px] w-full text-[13px] font-bold disabled:opacity-60`}
              >
                {lineupCopyBusy ? 'Wird übernommen…' : 'Komplette Aufstellung übernehmen'}
              </button>
              <button
                type="button"
                disabled={lineupCopyBusy}
                onClick={() => void runPrepLineupCopy('starters')}
                className={`${dsSecondaryCtaClass()} min-h-[40px] w-full text-[12px] font-semibold disabled:opacity-60`}
              >
                Nur Startelf
              </button>
              <button
                type="button"
                disabled={lineupCopyBusy}
                onClick={() => void runPrepLineupCopy('bench')}
                className={`${dsSecondaryCtaClass()} min-h-[40px] w-full text-[12px] font-semibold disabled:opacity-60`}
              >
                Nur Ersatzspieler
              </button>
              <button
                type="button"
                disabled={lineupCopyBusy || !tournamentEventId}
                onClick={() => void runPrepLineupCopy('squad_only')}
                className={`${dsSecondaryCtaClass()} min-h-[40px] w-full text-[12px] font-semibold disabled:opacity-60`}
              >
                Mit Turnierkader neu aufstellen
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['present', `Zugesagt ${summary.yes}`],
              ['open', `Offen ${summary.open}`],
              ['absent', `Abgesagt ${summary.no}`],
              ['neutral', `Ausgewählt ${summary.selected}`],
            ] as const
          ).map(([tone, label]) => (
            <span key={tone} className={dsStatusChipClass(tone as DsChipTone)}>
              {label}
            </span>
          ))}
        </div>

        {renderSection('Verfügbar', grouped.available, 'available')}
        {renderSection('Offen', grouped.open, 'open')}
        {renderSection('Abgesagt', grouped.absent, 'absent')}

        {matchId && matchRow && !isDemo ? (
          <MinimumPlaytimeMatchSettings
            matchId={matchId}
            plannedMinutes={matchRow.planned_match_minutes ?? DEFAULT_PLANNED_MATCH_MINUTES}
            enabled={Boolean(matchRow.minimum_playtime_enabled)}
            minutes={matchRow.minimum_playtime_minutes ?? DEFAULT_MINIMUM_PLAYTIME_MINUTES}
            onSaved={(patch) =>
              setMatchRow((prev) =>
                prev
                  ? {
                      ...prev,
                      planned_match_minutes: patch.plannedMinutes,
                      minimum_playtime_enabled: patch.enabled,
                      minimum_playtime_minutes: patch.minutes,
                    }
                  : prev,
              )
            }
          />
        ) : null}

        {matchId && matchRow && !isDemo ? (
          <MatchdayFeedAutomationSettings
            matchId={matchId}
            enabled={matchRow.auto_matchday_feed_enabled === true}
            onSaved={(nextEnabled) =>
              setMatchRow((prev) =>
                prev ? { ...prev, auto_matchday_feed_enabled: nextEnabled } : prev,
              )
            }
          />
        ) : null}

        <section className={`flex flex-col ${DS_SECTION_GAP}`}>
          <h2 className={dsSectionLabelClass()}>Matchkader: {selectedPlayersForSquad.length} Spieler</h2>
          {selectedPlayersForSquad.length === 0 ? (
            <p className="text-xs text-white/45">Noch keine Spieler ausgewählt.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedPlayersForSquad.map((id) => {
                const p = players.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="rounded-full border border-red-500/35 bg-red-950/35 px-2.5 py-0.5 text-[11px] font-semibold text-red-200"
                  >
                    {premiumPlayerDisplayName(p ?? { display_name: id })}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <div
        className={dsStickyCtaBarClass()}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-white/45">
            Ausgewählt: {selectedPlayersForSquad.length}
          </span>
          <button
            type="button"
            disabled={selectedPlayersForSquad.length === 0 || persisting || squadSaveBusy || !squadEditable}
            onClick={() => void onContinueToLineup()}
            className={dsPrimaryCtaClass()}
          >
            {persisting || squadSaveBusy ? 'Speichern…' : 'Weiter zur Aufstellung'}
          </button>
        </div>
        {persistError ? <p className="mx-auto mt-1 max-w-xl text-xs text-red-400">{persistError}</p> : null}
      </div>

      {lineupRemoveConfirm ? (
        <div
          className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lineup-remove-confirm-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.96)] p-4 shadow-xl">
            <h2 id="lineup-remove-confirm-title" className="text-base font-bold text-white">
              Spieler entfernen
            </h2>
            <p className="mt-2 text-sm leading-snug text-white/70">
              Dieser Spieler befindet sich in der Aufstellung. Aus Kader entfernen?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={squadSaveBusy}
                onClick={() => setLineupRemoveConfirm(null)}
                className={`flex-1 min-h-11 ${dsSecondaryCtaClass()}`}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={squadSaveBusy}
                onClick={() => void confirmRemoveFromLineupAndSquad()}
                className={`flex-1 min-h-11 ${dsPrimaryCtaClass()}`}
              >
                {squadSaveBusy ? 'Entfernen…' : 'Entfernen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
