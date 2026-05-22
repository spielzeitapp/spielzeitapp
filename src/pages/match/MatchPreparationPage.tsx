import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import { comparePlayerItems } from '../../lib/rosterPlayer';
import { saveMatchSquadOnly } from '../../lib/liveMatchService';
import { supabase } from '../../lib/supabaseClient';
import { MatchPlayerRow } from '../../components/match/MatchPlayerRow';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
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
  const [matchRow, setMatchRow] = useState<MatchRowLite | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [restoredSelectedPlayers, setRestoredSelectedPlayers] = useState<string[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [attendanceByPlayerId, setAttendanceByPlayerId] = useState<Record<string, 'yes' | 'no'>>({});

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setMatchLoading(false);
      setMatchError('Keine Match-ID übergeben.');
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      setMatchLoading(true);
      setMatchError(null);
      const [{ data, error }, lineupRes, benchRes] = await Promise.all([
        supabase.from('matches').select('id, team_season_id, opponent').eq('id', matchId).maybeSingle(),
        supabase.from('match_lineup').select('player_id').eq('match_id', matchId),
        supabase.from('match_bench').select('player_id').eq('match_id', matchId),
      ]);
      if (cancelled) return;
      if (error || !data) {
        setMatchRow(null);
        setMatchError(error?.message ?? 'Spiel nicht gefunden.');
      } else {
        setMatchRow(data as MatchRowLite);
        const restored = new Set<string>();
        for (const row of (lineupRes.data ?? []) as Array<{ player_id: string | null }>) {
          if (row.player_id) restored.add(row.player_id);
        }
        for (const row of (benchRes.data ?? []) as Array<{ player_id: string | null }>) {
          if (row.player_id) restored.add(row.player_id);
        }
        const restoredList = [...restored];
        setRestoredSelectedPlayers(restoredList);
        setSelectedPlayers(restoredList);
      }
      setMatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const teamSeasonId = matchRow?.team_season_id ?? null;
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId);
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
    void (async () => {
      setAttendanceLoading(true);
      setAttendanceError(null);
      const { data: events, error: eventsErr } = await supabase
        .from('events')
        .select('id, starts_at')
        .eq('match_id', matchId)
        .order('starts_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (eventsErr) {
        setAttendanceByPlayerId({});
        setAttendanceError(eventsErr.message);
        setAttendanceLoading(false);
        return;
      }
      const eventId = events?.[0]?.id ?? null;
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
  }, [matchId]);

  const getAttendance = (playerId: string): 'yes' | 'no' | null => attendanceByPlayerId[playerId.toLowerCase()] ?? null;

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
  }, [players, attendanceByPlayerId]);

  const summary = useMemo(
    () => ({
      yes: grouped.available.length,
      open: grouped.open.length,
      no: grouped.absent.length,
      selected: selectedPlayers.filter((id) => grouped.available.some((p) => p.id === id)).length,
    }),
    [grouped.available, grouped.open.length, grouped.absent.length, selectedPlayers],
  );

  useEffect(() => {
    if (selectionInitialized) return;
    if (playersLoading || attendanceLoading) return;
    if (players.length === 0) return;
    const initial = new Set<string>();
    for (const restoredId of restoredSelectedPlayers) {
      if (getAttendance(restoredId) === 'yes') initial.add(restoredId);
    }
    for (const p of players) {
      if (getAttendance(p.id) === 'yes') initial.add(p.id);
    }
    setSelectedPlayers([...initial]);
    setSelectionInitialized(true);
  }, [
    selectionInitialized,
    playersLoading,
    attendanceLoading,
    players,
    restoredSelectedPlayers,
    attendanceByPlayerId,
  ]);

  const togglePlayer = (playerId: string, status: PrepStatus) => {
    if (status !== 'available') return;
    setSelectionInitialized(true);
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      return [...prev, playerId];
    });
  };

  const selectablePlayerIds = useMemo(() => new Set(grouped.available.map((p) => p.id)), [grouped.available]);
  const selectedPlayersAvailableOnly = useMemo(
    () => selectedPlayers.filter((id) => selectablePlayerIds.has(id)),
    [selectedPlayers, selectablePlayerIds],
  );
  const selectedSet = useMemo(() => new Set(selectedPlayersAvailableOnly), [selectedPlayersAvailableOnly]);

  const renderSection = (title: string, list: typeof players, status: PrepStatus) => (
    <section className="space-y-1.5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{title}</h2>
      {list.length === 0 ? <p className="text-xs text-white/45">Keine Spieler</p> : null}
      <div className="space-y-1">
        {list.map((p) => {
          const selected = selectedSet.has(p.id);
          const disabled = status !== 'available';
          return (
            <div key={p.id} className={disabled ? "opacity-70" : ""}>
              <MatchPlayerRow
                player={p}
                selected={selected}
                status={status === "available" ? "yes" : status === "absent" ? "no" : "open"}
                rightLabel={
                  status === "absent"
                    ? "Abwesend"
                    : status === "open"
                      ? "Offen"
                      : selected
                        ? "✓ Im Kader"
                        : "Auswählen"
                }
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

  if (matchError || !matchId) {
    return (
      <div className="min-h-[100dvh] p-4 text-white">
        <p className="text-sm text-red-400">{matchError ?? 'Ungültiger Aufruf.'}</p>
        <Link to="/app/termine" className="mt-3 inline-block text-sm font-semibold text-red-300 underline">
          Zurück zu Termine
        </Link>
      </div>
    );
  }

  const onContinueToLineup = async () => {
    if (!matchId || selectedPlayersAvailableOnly.length === 0 || persisting) return;
    setPersistError(null);
    setPersisting(true);
    const { error } = await saveMatchSquadOnly(matchId, selectedPlayersAvailableOnly);
    setPersisting(false);
    if (error) {
      setPersistError(error);
      return;
    }
    navigate(`/app/match-lineup?matchId=${encodeURIComponent(matchId)}`, {
      state: { selectedPlayers: selectedPlayersAvailableOnly },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-1 inline-flex min-h-[36px] items-center rounded-lg border border-white/15 bg-white/[0.05] px-2.5 text-xs font-semibold text-white/90 hover:bg-white/[0.09]"
            >
              ← Zurück
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">SpielzeitApp</p>
            <h1 className="text-lg font-bold">MATCH VORBEREITUNG</h1>
            <p className="text-sm text-white/60">{matchRow?.opponent ? `vs. ${matchRow.opponent}` : 'Spiel'}</p>
          </div>
          <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
            Trainer
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-3 pb-48">
        {(playersLoading || attendanceLoading) ? <p className="text-sm text-white/55">Lade Spieler und Status…</p> : null}
        {(playersError || attendanceError) ? <p className="text-sm text-red-400">{playersError ?? attendanceError}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-emerald-500/25 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-200/90">
            Zugesagt {summary.yes}
          </span>
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-white/55">
            Offen {summary.open}
          </span>
          <span className="rounded-full border border-red-500/22 bg-red-950/35 px-2.5 py-0.5 text-[10px] font-semibold text-red-200/85">
            Abgesagt {summary.no}
          </span>
          <span className="rounded-full border border-white/12 bg-black/50 px-2.5 py-0.5 text-[10px] font-semibold text-white/70">
            Ausgewählt {summary.selected}
          </span>
        </div>

        {renderSection('Verfügbar', grouped.available, 'available')}
        {renderSection('Offen', grouped.open, 'open')}
        {renderSection('Abgesagt', grouped.absent, 'absent')}

        <section className="space-y-1.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Matchkader: {selectedPlayersAvailableOnly.length} Spieler</h2>
          {selectedPlayersAvailableOnly.length === 0 ? (
            <p className="text-xs text-white/45">Noch keine Spieler ausgewählt.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedPlayersAvailableOnly.map((id) => {
                const p = players.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="rounded-full border border-red-500/35 bg-red-950/35 px-2.5 py-0.5 text-[11px] font-semibold text-red-200"
                  >
                    {p?.jersey_number ?? '–'} {p?.display_name ?? id}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <div
        className="fixed inset-x-0 z-[70] border-t border-white/[0.06] bg-gradient-to-t from-black via-black/95 to-black/80 px-4 py-2.5 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-white/50">
            Ausgewählt: {selectedPlayersAvailableOnly.length}
          </span>
          <button
            type="button"
            disabled={selectedPlayersAvailableOnly.length === 0 || persisting}
            onClick={() => void onContinueToLineup()}
            className="rounded-[18px] border border-red-500/25 bg-gradient-to-r from-red-700/90 via-red-600/95 to-red-800/90 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(127,29,29,0.28)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {persisting ? 'Speichern…' : 'Weiter zur Aufstellung'}
          </button>
        </div>
        {persistError ? <p className="mx-auto mt-1 max-w-xl text-xs text-red-400">{persistError}</p> : null}
      </div>
    </div>
  );
};
