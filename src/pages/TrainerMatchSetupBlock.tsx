import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import type { PlayerItem } from '../hooks/usePlayers';
import {
  LIVE_FIELD_SLOT_ORDER,
  lineupRowsToSlotMap,
  persistLiveMatchBegin,
  replaceMatchLineupAndBench,
  saveMatchSquadOnly,
} from '../lib/liveMatchService';
import type { FieldSlotId } from '../types/match';

const MATCH_SETUP_STARTERS_MAX = 7;

function emptyMatchSetupStarters(): Record<FieldSlotId, string | null> {
  const o = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) o[s] = null;
  return o;
}

/** UUID/Vergleich: DB oft lowercase, Client kann abweichen — sonst `squad.has(p.id)` false trotz DB-Kader. */
function nid(id: string): string {
  return id.trim().toLowerCase();
}

const trainerRowBase =
  'flex w-full min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors';
const trainerRowUnselected = 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]';
const trainerRowSquad = 'border-red-500/35 bg-red-950/25 text-white';
const trainerRowStarter = 'border-emerald-500/45 bg-emerald-950/35 text-white';
const trainerRowDisabled = 'cursor-not-allowed opacity-45 hover:bg-white/[0.05]';

/** Trainer: Kader + Startelf + Bank; Live starten speichert match_lineup und navigiert zu /app/live. */
export function TrainerMatchSetupBlock({
  matchId,
  players,
  attendanceByPlayerId,
  eventTeamSeasonId = null,
  linkedMatchTeamSeasonId = null,
}: {
  matchId: string;
  players: PlayerItem[];
  /** Nur Anzeige-Filter: wenn mind. eine Zu-/Absage und mind. ein „ja“, nur Zugesagte im Kader-Pool. */
  attendanceByPlayerId?: Record<string, 'yes' | 'no'>;
  /** events.team_season_id (Kontext); kann von matches.team_season_id abweichen. */
  eventTeamSeasonId?: string | null;
  /** matches.team_season_id des verknüpften Spiels (wenn von Parent geladen). */
  linkedMatchTeamSeasonId?: string | null;
}) {
  const navigate = useNavigate();

  const poolPlayers = useMemo(() => {
    const raw = attendanceByPlayerId ?? {};
    const hasRows = Object.keys(raw).length > 0;
    const hasYes = Object.values(raw).some((s) => s === 'yes');
    if (!hasRows || !hasYes) return players;
    return players.filter((p) => raw[(p.id ?? '').toLowerCase()] === 'yes');
  }, [players, attendanceByPlayerId]);

  const sortedPlayers = useMemo(
    () =>
      [...poolPlayers].sort(
        (a, b) =>
          (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) ||
          a.display_name.localeCompare(b.display_name, 'de'),
      ),
    [poolPlayers],
  );

  const [squad, setSquad] = useState<Set<string>>(() => new Set());
  const [startersBySlot, setStartersBySlot] = useState<Record<FieldSlotId, string | null>>(emptyMatchSetupStarters);
  const [loadingLineup, setLoadingLineup] = useState(true);
  const [savingLive, setSavingLive] = useState(false);
  const [savingSquad, setSavingSquad] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);
  const [squadSaveMsg, setSquadSaveMsg] = useState<string | null>(null);
  const [lineupSaveMsg, setLineupSaveMsg] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  /** >0: erneut aus DB laden ohne vollständigen Ladezustand (z. B. nach Speichern). */
  const [lineupReloadTick, setLineupReloadTick] = useState(0);

  useEffect(() => {
    setLineupReloadTick(0);
  }, [matchId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const showFullLoading = lineupReloadTick === 0;
      setLoadingLineup(true);
      if (showFullLoading) setSetupError(null);
      try {
        const [lineupRes, benchRes] = await Promise.all([
          supabase.from('match_lineup').select('slot, player_id').eq('match_id', matchId),
          supabase.from('match_bench').select('player_id').eq('match_id', matchId),
        ]);
        if (cancelled) return;
        if (lineupRes.error || benchRes.error) {
          setSetupError(lineupRes.error?.message ?? benchRes.error?.message ?? 'Aufstellung laden fehlgeschlagen.');
          return;
        }
        const slotMap = lineupRowsToSlotMap(
          (lineupRes.data ?? []) as { slot: FieldSlotId; player_id: string | null }[],
        );
        const nextStarters = emptyMatchSetupStarters();
        for (const s of LIVE_FIELD_SLOT_ORDER) {
          nextStarters[s] = slotMap[s] ?? null;
        }
        /** Kader = UNION aller player_id aus match_lineup + match_bench (nicht nur aus Slot-Map — sonst fehlen Starter, wenn Slot-Strings nicht gemappt werden). */
        const nextSquad = new Set<string>();
        for (const row of (benchRes.data ?? []) as { player_id: string }[]) {
          const pid = String(row.player_id ?? '').trim();
          if (pid) nextSquad.add(nid(pid));
        }
        for (const row of (lineupRes.data ?? []) as { player_id: string | null }[]) {
          const pid = String(row.player_id ?? '').trim();
          if (pid) nextSquad.add(nid(pid));
        }
        setStartersBySlot(nextStarters);
        setSquad(nextSquad);
      } finally {
        if (!cancelled) setLoadingLineup(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, lineupReloadTick]);

  useEffect(() => {
    if (loadingLineup) return;
    const squadUnionIds = [...squad].map(nid).sort();
    const playersIds = [...new Set(players.map((p) => nid(p.id)))].sort();
    const squadIdsNotInPlayersList = squadUnionIds.filter((id) => !playersIds.includes(id));

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('matches').select('team_season_id').eq('id', matchId).maybeSingle();
      if (cancelled) return;
      const matchTeamSeasonIdFromDb =
        data != null ? String((data as { team_season_id: string }).team_season_id) : null;
      console.log('[TrainerMatchSetup] Roster-Pfad: matchId, team_seasons, squadUnion vs players', {
        matchId,
        matchTeamSeasonIdFromDb,
        eventTeamSeasonId,
        linkedMatchTeamSeasonIdProp: linkedMatchTeamSeasonId,
        squadUnionIds,
        playersIds,
        squadIdsNotInPlayersList,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [loadingLineup, squad, players, matchId, eventTeamSeasonId, linkedMatchTeamSeasonId]);

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
    const id = nid(playerId);
    setSquad((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setStartersBySlot((st) => {
          const o = { ...st };
          for (const s of LIVE_FIELD_SLOT_ORDER) {
            if (o[s] != null && nid(String(o[s])) === id) o[s] = null;
          }
          return o;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStarter = (playerId: string) => {
    const id = nid(playerId);
    if (!squad.has(id)) return;
    setStartersBySlot((prev) => {
      const next = { ...prev };
      let isStarter = false;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] != null && nid(String(next[s])) === id) isStarter = true;
      }
      if (isStarter) {
        for (const s of LIVE_FIELD_SLOT_ORDER) {
          if (next[s] != null && nid(String(next[s])) === id) next[s] = null;
        }
        return next;
      }
      const count = LIVE_FIELD_SLOT_ORDER.filter((s) => next[s] != null).length;
      if (count >= MATCH_SETUP_STARTERS_MAX) return prev;
      const emptySlot = LIVE_FIELD_SLOT_ORDER.find((s) => next[s] == null);
      if (!emptySlot) return prev;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] != null && nid(String(next[s])) === id) next[s] = null;
      }
      next[emptySlot] = id;
      return next;
    });
  };

  const squadPlayersSorted = useMemo(
    () =>
      [...players]
        .filter((p) => squad.has(nid(p.id)))
        .sort(
          (a, b) =>
            (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) ||
            a.display_name.localeCompare(b.display_name, 'de'),
        ),
    [players, squad],
  );

  const bankPlayers = useMemo(
    () => squadPlayersSorted.filter((p) => !starterIdSet.has(nid(p.id))),
    [squadPlayersSorted, starterIdSet],
  );

  const onLiveStart = async () => {
    if (starterCount !== MATCH_SETUP_STARTERS_MAX) return;
    setSavingLive(true);
    setSetupError(null);
    const ordered = LIVE_FIELD_SLOT_ORDER.map((s) => startersBySlot[s] ?? null);
    const squadArr = [...squad];
    const { error: lineupErr } = await replaceMatchLineupAndBench(matchId, ordered, squadArr);
    if (lineupErr) {
      setSetupError(lineupErr);
      setSavingLive(false);
      return;
    }
    const { error: liveErr } = await persistLiveMatchBegin(matchId);
    setSavingLive(false);
    if (liveErr) {
      setSetupError(liveErr);
      return;
    }
    navigate(`/app/live?matchId=${encodeURIComponent(matchId)}`);
  };

  const onSaveSquadOnly = async () => {
    setSquadSaveMsg(null);
    setSavingSquad(true);
    const ids = [...squad];
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
    const lineupPlayerIds = LIVE_FIELD_SLOT_ORDER.map((s) => startersBySlot[s] ?? null);
    const squadIds = [...squad];
    const starterSetForBench = new Set(
      lineupPlayerIds.filter((x): x is string => typeof x === 'string' && x.length > 0).map((x) => nid(x)),
    );
    const benchPlayerIds = squadIds.filter((id) => !starterSetForBench.has(id));
    console.log('[TrainerMatchSetup] Aufstellung speichern VOR save', {
      squadIds,
      lineupPlayerIds,
      benchPlayerIds,
    });

    const { error } = await replaceMatchLineupAndBench(matchId, lineupPlayerIds, squadIds);
    setSavingLineup(false);
    if (error) {
      setSetupError(error);
      return;
    }

    const [lr, br] = await Promise.all([
      supabase.from('match_lineup').select('slot, player_id').eq('match_id', matchId),
      supabase.from('match_bench').select('player_id').eq('match_id', matchId),
    ]);
    const lineupRows = lr.data ?? [];
    const benchRows = br.data ?? [];
    const squadFromDb = new Set<string>();
    for (const row of benchRows as { player_id: string }[]) {
      const pid = String(row.player_id ?? '').trim();
      if (pid) squadFromDb.add(nid(pid));
    }
    for (const r of lineupRows as { player_id: string | null }[]) {
      const pid = String(r.player_id ?? '').trim();
      if (pid) squadFromDb.add(nid(pid));
    }
    console.log('[TrainerMatchSetup] Aufstellung speichern NACH save (DB read)', {
      lineupRows,
      benchRows,
      squadFromDb: [...squadFromDb],
    });

    setSetupError(null);
    setLineupSaveMsg('Aufstellung gespeichert.');
    setLineupReloadTick((t) => t + 1);
    window.setTimeout(() => setLineupSaveMsg(null), 3500);
  };

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/45 p-4 shadow-lg">
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
            <div className="flex flex-col gap-2">
              {sortedPlayers.map((p) => {
                const inSquad = squad.has(nid(p.id));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSquad(p.id)}
                    className={`${trainerRowBase} ${inSquad ? trainerRowSquad : trainerRowUnselected}`}
                  >
                    {p.jersey_number != null ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/40 text-base font-black text-white/90">
                        {p.jersey_number}
                      </span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/40 text-sm font-bold text-white/50">
                        –
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-base font-semibold text-white">{p.display_name}</span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                        inSquad ? 'bg-red-600 text-white' : 'bg-white/10 text-white/55'
                      }`}
                    >
                      {inSquad ? 'Im Kader' : 'Nein'}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[52px] w-full rounded-2xl text-sm font-bold"
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
              <div className="flex flex-col gap-2">
                {squadPlayersSorted.map((p) => {
                  const isSt = starterIdSet.has(nid(p.id));
                  const blockMore = !isSt && starterCount >= MATCH_SETUP_STARTERS_MAX;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={blockMore}
                      onClick={() => toggleStarter(p.id)}
                      className={`${trainerRowBase} ${
                        blockMore ? `${trainerRowUnselected} ${trainerRowDisabled}` : isSt ? trainerRowStarter : trainerRowUnselected
                      }`}
                    >
                      {p.jersey_number != null ? (
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black ${
                            isSt ? 'bg-emerald-600/30 text-emerald-200' : 'bg-black/40 text-white/70'
                          }`}
                        >
                          {p.jersey_number}
                        </span>
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/40 text-sm font-bold text-white/50">
                          –
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-base font-semibold text-white">{p.display_name}</span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                          isSt ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/55'
                        }`}
                      >
                        {isSt ? 'Startelf' : 'Bank'}
                      </span>
                    </button>
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
                {bankPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b border-white/5 py-2 last:border-b-0 last:pb-0"
                  >
                    <span className="w-8 text-center text-sm font-black text-white/40">
                      {p.jersey_number != null ? p.jersey_number : '–'}
                    </span>
                    <span className="text-sm font-medium text-white/85">{p.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="secondary"
            className="min-h-[52px] w-full rounded-2xl text-sm font-bold"
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
            {savingLive ? 'Speichern…' : 'Live starten'}
          </Button>
        </div>
      )}
    </div>
  );
}
