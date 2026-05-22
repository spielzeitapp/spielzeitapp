import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import type { PlayerItem } from '../hooks/usePlayers';
import { LIVE_FIELD_SLOT_ORDER, replaceMatchLineupAndBench, saveMatchSquadOnly } from '../lib/liveMatchService';
import { comparePlayerItems } from '../lib/rosterPlayer';
import { MatchPlayerRow } from '../components/match/MatchPlayerRow';
import type { FieldSlotId } from '../types/match';

const MATCH_SETUP_STARTERS_MAX = 7;

function emptyMatchSetupStarters(): Record<FieldSlotId, string | null> {
  const o = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) o[s] = null;
  return o;
}

const normalizeId = (id: string | null | undefined): string | null => {
  const v = String(id ?? '').trim();
  return v.length > 0 ? v : null;
};

const trainerRowBase =
  'flex w-full min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors';
const trainerRowUnselected = 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]';
const trainerRowSquad = 'border-red-500/35 bg-red-950/25 text-white';
const trainerRowStarter = 'border-emerald-500/45 bg-emerald-950/35 text-white';
const trainerRowDisabled = 'cursor-not-allowed opacity-45 hover:bg-white/[0.05]';

/** Trainer: Kader + Startelf + Bank; „Zum Liveticker“ speichert nur Aufstellung und navigiert (kein Match-Start in der DB). */
export function TrainerMatchSetupBlock({
  matchId,
  players,
  attendanceByPlayerId,
}: {
  matchId: string;
  players: PlayerItem[];
  /** Nur Anzeige-Filter: wenn mind. eine Zu-/Absage und mind. ein „ja“, nur Zugesagte im Kader-Pool. */
  attendanceByPlayerId?: Record<string, 'yes' | 'no'>;
}) {
  const navigate = useNavigate();

  const poolPlayers = useMemo(() => {
    const raw = attendanceByPlayerId ?? {};
    const hasRows = Object.keys(raw).length > 0;
    const hasYes = Object.values(raw).some((s) => s === 'yes');
    if (!hasRows || !hasYes) return players;
    return players.filter((p) => {
      const playerId = normalizeId(p.id);
      return playerId ? raw[playerId] === 'yes' : false;
    });
  }, [players, attendanceByPlayerId]);

  const sortedPlayers = useMemo(
    () =>
      [...poolPlayers].sort(comparePlayerItems),
    [poolPlayers],
  );

  const sortedAllPlayers = useMemo(
    () => [...players].sort(comparePlayerItems),
    [players],
  );

  const [squad, setSquad] = useState<Set<string>>(() => new Set());
  const [startersBySlot, setStartersBySlot] = useState<Record<FieldSlotId, string | null>>(emptyMatchSetupStarters);
  const [benchIdSet, setBenchIdSet] = useState<Set<string>>(() => new Set());
  const [loadingLineup, setLoadingLineup] = useState(true);
  const [savingLive, setSavingLive] = useState(false);
  const [savingSquad, setSavingSquad] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);
  const [squadSaveMsg, setSquadSaveMsg] = useState<string | null>(null);
  const [lineupSaveMsg, setLineupSaveMsg] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  /** >0: erneut aus DB laden ohne vollständigen Ladezustand (z. B. nach Speichern). */
  const [lineupReloadTick, setLineupReloadTick] = useState(0);

  const validPlayerIds = useMemo(
    () => new Set(players.map((p) => normalizeId(p.id)).filter((id): id is string => Boolean(id))),
    [players],
  );

  useEffect(() => {
    setLineupReloadTick(0);
  }, [matchId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const showFullLoading = lineupReloadTick === 0;
      if (showFullLoading) {
        setLoadingLineup(true);
        setSetupError(null);
      }
      const [lineupRes, benchRes] = await Promise.all([
        supabase.from('match_lineup').select('slot, player_id').eq('match_id', matchId),
        supabase.from('match_bench').select('player_id').eq('match_id', matchId),
      ]);
      if (cancelled) return;
      if (lineupRes.error || benchRes.error) {
        setSetupError(lineupRes.error?.message ?? benchRes.error?.message ?? 'Aufstellung laden fehlgeschlagen.');
        if (showFullLoading) setLoadingLineup(false);
        return;
      }
      const nextStarters = emptyMatchSetupStarters();
      const usedLineupPlayers = new Set<string>();
      for (const r of (lineupRes.data ?? []) as { slot: FieldSlotId; player_id: string | null }[]) {
        const slot = String(r.slot ?? '').trim().toUpperCase();
        const pid = normalizeId(r.player_id);
        if (LIVE_FIELD_SLOT_ORDER.includes(slot as any) && pid) {
          if (usedLineupPlayers.has(pid)) {
            console.warn('[TrainerMatchSetupBlock] duplicate lineup player ignored', { matchId, playerId: pid, slot });
            continue;
          }
          usedLineupPlayers.add(pid);
          nextStarters[slot as any] = pid;
        }
      }
      const nextBenchIds = new Set<string>();
      for (const row of (benchRes.data ?? []) as { player_id: string }[]) {
        const id = normalizeId(row.player_id);
        if (id && !usedLineupPlayers.has(id)) nextBenchIds.add(id);
      }

      const nextSquad = new Set<string>(nextBenchIds);
      for (const r of (lineupRes.data ?? []) as { slot: FieldSlotId; player_id: string | null }[]) {
        const id = normalizeId(r.player_id);
        if (id) nextSquad.add(id);
      }
      const lineupIdsFromDb = [...new Set(
        ((lineupRes.data ?? []) as { player_id: string | null }[])
          .map((r) => normalizeId(r.player_id))
          .filter((id): id is string => Boolean(id)),
      )];
      const benchIdsFromDb = [...nextBenchIds];
      const squadIdsFromDb = [...nextSquad];
      const allPlayerIdsFromPlayers = [...new Set(
        players
          .map((p) => normalizeId(p.id))
          .filter((id): id is string => Boolean(id)),
      )];
      const playersIdSet = new Set(allPlayerIdsFromPlayers);
      const missingLineupIds = lineupIdsFromDb.filter((id) => !playersIdSet.has(id));
      const missingBenchIds = benchIdsFromDb.filter((id) => !playersIdSet.has(id));
      console.log('[TrainerMatchSetupBlock][reload-debug]', {
        matchId,
        lineupIdsFromDb,
        benchIdsFromDb,
        squadIdsFromDb,
        allPlayerIdsFromPlayers,
        missingLineupIds,
        missingBenchIds,
      });
      setStartersBySlot(nextStarters);
      setBenchIdSet(nextBenchIds);
      setSquad(nextSquad);
      if (showFullLoading) setLoadingLineup(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, lineupReloadTick, players]);

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
    const pid = normalizeId(playerId);
    if (!pid) return;
    setSquad((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
        setBenchIdSet((prevBench) => {
          const nextBench = new Set(prevBench);
          nextBench.delete(pid);
          return nextBench;
        });
        setStartersBySlot((st) => {
          const o = { ...st };
          for (const s of LIVE_FIELD_SLOT_ORDER) {
            if (o[s] === pid) o[s] = null;
          }
          return o;
        });
      } else {
        next.add(pid);
        setBenchIdSet((prevBench) => {
          const nextBench = new Set(prevBench);
          nextBench.add(pid);
          return nextBench;
        });
      }
      return next;
    });
  };

  const toggleStarter = (playerId: string) => {
    const pid = normalizeId(playerId);
    if (!pid) return;
    if (!squad.has(pid)) return;
    setStartersBySlot((prev) => {
      const next = { ...prev };
      let isStarter = false;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] === pid) isStarter = true;
      }
      if (isStarter) {
        for (const s of LIVE_FIELD_SLOT_ORDER) {
          if (next[s] === pid) next[s] = null;
        }
        setBenchIdSet((prevBench) => {
          const nextBench = new Set(prevBench);
          nextBench.add(pid);
          return nextBench;
        });
        return next;
      }
      const count = LIVE_FIELD_SLOT_ORDER.filter((s) => next[s] != null).length;
      if (count >= MATCH_SETUP_STARTERS_MAX) return prev;
      const emptySlot = LIVE_FIELD_SLOT_ORDER.find((s) => next[s] == null);
      if (!emptySlot) return prev;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] === pid) next[s] = null;
      }
      next[emptySlot] = pid;
      setBenchIdSet((prevBench) => {
        const nextBench = new Set(prevBench);
        nextBench.delete(pid);
        return nextBench;
      });
      return next;
    });
  };

  const squadPlayersSorted = useMemo(
    () =>
      sortedAllPlayers.filter((p) => {
        const playerId = normalizeId(p.id);
        return playerId ? squad.has(playerId) : false;
      }),
    [sortedAllPlayers, squad],
  );

  const starterPlayersSorted = useMemo(
    () =>
      sortedAllPlayers.filter((p) => {
        const playerId = normalizeId(p.id);
        return playerId ? starterIdSet.has(playerId) : false;
      }),
    [sortedAllPlayers, starterIdSet],
  );

  const bankPlayers = useMemo(
    () =>
      sortedAllPlayers.filter((p) => {
        const playerId = normalizeId(p.id);
        return playerId ? benchIdSet.has(playerId) : false;
      }),
    [sortedAllPlayers, benchIdSet],
  );

  const onLiveStart = async () => {
    if (starterCount !== MATCH_SETUP_STARTERS_MAX) return;
    setSavingLive(true);
    setSetupError(null);
    const ordered = LIVE_FIELD_SLOT_ORDER.map((s) => startersBySlot[s] ?? null);
    const squadArr = [...squad].filter((pid) => validPlayerIds.has(pid));
    const { error: lineupErr } = await replaceMatchLineupAndBench(matchId, ordered, squadArr);
    setSavingLive(false);
    if (lineupErr) {
      setSetupError(lineupErr);
      return;
    }
    navigate(`/app/live?matchId=${encodeURIComponent(matchId)}`);
  };

  const onSaveSquadOnly = async () => {
    setSquadSaveMsg(null);
    setSavingSquad(true);
    const ids = [...squad].filter((pid) => validPlayerIds.has(pid));
    const { error } = await saveMatchSquadOnly(matchId, ids);
    setSavingSquad(false);
    if (error) {
      setSquadSaveMsg(error);
      return;
    }
    setSquadSaveMsg('Kader gespeichert.');
    setLineupReloadTick((t) => t + 1);
    window.setTimeout(() => setSquadSaveMsg(null), 3500);
  };

  const onSaveLineupAndBench = async () => {
    setLineupSaveMsg(null);
    setSavingLineup(true);
    setSetupError(null);
    const ordered = LIVE_FIELD_SLOT_ORDER.map((s) => startersBySlot[s] ?? null);
    const squadArr = [...squad].filter((pid) => validPlayerIds.has(pid));
    console.log('[TrainerMatchSetupBlock][save-lineup-click]', {
      matchId,
      ordered,
      squadArr,
    });
    const { error } = await replaceMatchLineupAndBench(matchId, ordered, squadArr);
    setSavingLineup(false);
    if (error) {
      setSetupError(error);
      return;
    }
    setSetupError(null);
    setLineupSaveMsg('Aufstellung gespeichert.');
    window.setTimeout(() => setLineupSaveMsg(null), 3500);
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/45 p-4 shadow-lg">
      {loadingLineup && <p className="text-sm text-white/55">Lade gespeicherte Aufstellung…</p>}
      {setupError && (
        <p className="text-sm text-red-400" role="alert">
          {setupError}
        </p>
      )}

      {!loadingLineup && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/45">Matchkader</p>
              <p className="text-xs text-white/50">Tippe eine Zeile, um den Spieler für dieses Spiel zu wählen.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              {sortedPlayers.map((p) => {
                const playerId = normalizeId(p.id);
                const inSquad = playerId ? squad.has(playerId) : false;
                return (
                  <MatchPlayerRow
                    key={playerId ?? String(p.id)}
                    player={p}
                    selected={inSquad}
                    rightLabel={inSquad ? '✓ Im Kader' : 'Nein'}
                    status={inSquad ? 'yes' : 'open'}
                    onClick={() => playerId && toggleSquad(playerId)}
                  />
                );
              })}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[48px] w-full rounded-2xl text-sm font-bold"
              disabled={savingSquad || savingLive || savingLineup}
              onClick={() => void onSaveSquadOnly()}
            >
              {savingSquad ? 'Speichern…' : 'Kader speichern'}
            </Button>
            {squadSaveMsg && (
              <p
                className={`text-center text-xs font-medium ${squadSaveMsg.includes('gespeichert') ? 'text-emerald-300' : 'text-red-400'}`}
                role="status"
              >
                {squadSaveMsg}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/45">
                Startelf ({starterCount}/{MATCH_SETUP_STARTERS_MAX})
              </p>
              <p className="text-xs text-white/50">Nur Kader-Spieler. Maximal sieben in der Startelf.</p>
            </div>
            {squadPlayersSorted.length === 0 ? (
              <p className="text-sm text-white/55">Zuerst Spieler im Matchkader auswählen.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {squadPlayersSorted.map((p) => {
                  const playerId = normalizeId(p.id);
                  const isSt = playerId ? starterIdSet.has(playerId) : false;
                  const blockMore = !isSt && starterCount >= MATCH_SETUP_STARTERS_MAX;
                  return (
                    <div className={blockMore ? 'pointer-events-none opacity-50' : ''}>
                      <MatchPlayerRow
                        key={playerId ?? String(p.id)}
                        player={p}
                        tone="matchday"
                        selected={isSt}
                        rightLabel={isSt ? 'Startelf' : 'Bank'}
                        status={isSt ? 'yes' : 'open'}
                        onClick={() => playerId && toggleStarter(playerId)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/45">Bank</p>
            {bankPlayers.length === 0 ? (
              <p className="text-sm text-white/55">Keine Spieler auf der Bank (alle in der Startelf oder kein Kader).</p>
            ) : (
              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/30 p-3">
                {bankPlayers.map((p) => {
                  const playerId = normalizeId(p.id);
                  return (
                  <MatchPlayerRow
                    key={playerId ?? String(p.id)}
                    player={p}
                    tone="matchday"
                    rightLabel="Bank"
                    status="open"
                  />
                  );
                })}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] w-full rounded-2xl text-sm font-bold"
            disabled={savingLive || savingSquad || savingLineup}
            onClick={() => void onSaveLineupAndBench()}
          >
            {savingLineup ? 'Speichern…' : 'Aufstellung speichern'}
          </Button>
          {lineupSaveMsg && (
            <p
              className={`text-center text-xs font-medium ${lineupSaveMsg.includes('gespeichert') ? 'text-emerald-300' : 'text-red-400'}`}
              role="status"
            >
              {lineupSaveMsg}
            </p>
          )}
          <p className="text-center text-xs text-white/45">
            „Aufstellung speichern“: Startelf + Bank. „Kader speichern“: nur Bank (Startelf in der DB unverändert).
          </p>

          <Button
            type="button"
            variant="primary"
            className="min-h-[52px] w-full rounded-2xl text-base font-bold"
            disabled={savingLive || savingSquad || savingLineup || starterCount !== MATCH_SETUP_STARTERS_MAX}
            onClick={() => void onLiveStart()}
          >
            {savingLive ? 'Speichern…' : 'Zum Liveticker'}
          </Button>
        </div>
      )}
    </div>
  );
}
