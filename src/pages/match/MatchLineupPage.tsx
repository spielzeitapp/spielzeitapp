import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import type { PlayerItem } from '../../hooks/usePlayers';
import { LeibchenJersey } from '../../components/match/LeibchenJersey';
import {
  fetchLineupForLiveMatch,
  LIVE_FIELD_SLOT_ORDER,
  persistLiveMatchBegin,
  replaceMatchLineupAndBench,
} from '../../lib/liveMatchService';
import { supabase } from '../../lib/supabaseClient';
import type { FieldSlotId } from '../../types/match';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
};

type LocationState = {
  selectedPlayers?: string[];
} | null;

const SLOT_LABELS: Record<FieldSlotId, string> = {
  GK: 'GK',
  LB: 'LV',
  RB: 'RV',
  CM: 'ZM',
  LW: 'LA',
  RW: 'RA',
  ST: 'ST',
};

function emptySlots(): Record<FieldSlotId, string | null> {
  return {
    GK: null,
    LB: null,
    RB: null,
    CM: null,
    LW: null,
    RW: null,
    ST: null,
  };
}

const normalizeId = (id: string | null | undefined): string | null => {
  const v = String(id ?? '').trim();
  return v.length > 0 ? v : null;
};

function playerFamilyName(p: PlayerItem): string {
  const ln = (p.last_name ?? '').trim();
  if (ln) return ln;
  const parts = p.display_name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : p.display_name;
}

/** Kurz-Label für Bank (ohne Slot); längere Positionsbezeichnungen kürzen. */
function benchPositionLabel(p: PlayerItem): string {
  const pos = (p.position ?? '').trim();
  if (!pos) return '–';
  if (pos.length <= 3) return pos.toUpperCase();
  return pos.slice(0, 2).toUpperCase();
}

export const MatchLineupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('matchId')?.trim() || null;
  const routeState = (location.state ?? null) as LocationState;
  const selectedFromState = useMemo(
    () => [...new Set((routeState?.selectedPlayers ?? []).map((id) => normalizeId(id)).filter((id): id is string => Boolean(id)))],
    [routeState?.selectedPlayers],
  );

  const [matchRow, setMatchRow] = useState<MatchRowLite | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [lineupLoading, setLineupLoading] = useState(true);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [squadIds, setSquadIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<FieldSlotId, string | null>>(emptySlots);
  const [selectedBankPlayerId, setSelectedBankPlayerId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingLineup, setSavingLineup] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [assignFlashSlot, setAssignFlashSlot] = useState<FieldSlotId | null>(null);
  const assignFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const { data, error } = await supabase
        .from('matches')
        .select('id, team_season_id, opponent')
        .eq('id', matchId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setMatchRow(null);
        setMatchError(error?.message ?? 'Spiel nicht gefunden.');
      } else {
        setMatchRow(data as MatchRowLite);
      }
      setMatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const teamSeasonId = matchRow?.team_season_id ?? null;
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId);
  const playersById = useMemo(() => {
    const map = new Map<string, (typeof players)[number]>();
    for (const p of players) map.set(p.id, p);
    return map;
  }, [players]);

  useEffect(() => {
    let cancelled = false;
    if (!matchId) {
      setLineupLoading(false);
      setLineupError('Keine Match-ID übergeben.');
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      setLineupLoading(true);
      setLineupError(null);

      const initialSlots = emptySlots();
      let initialSquad = selectedFromState;

      const { data, error } = await fetchLineupForLiveMatch(matchId);
      if (cancelled) return;
      if (error) {
        setLineupError(error);
      } else {
        for (let i = 0; i < LIVE_FIELD_SLOT_ORDER.length; i += 1) {
          initialSlots[LIVE_FIELD_SLOT_ORDER[i]] = data.startingPlayerIds[i] ?? null;
        }
        if (initialSquad.length === 0) {
          initialSquad = data.squadPlayerIds;
        }
      }

      setSlots(initialSlots);
      setSquadIds([...new Set(initialSquad)]);
      setLineupLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId, selectedFromState]);

  useEffect(() => {
    if (!selectedBankPlayerId) return;
    if (!squadIds.includes(selectedBankPlayerId)) {
      setSelectedBankPlayerId(null);
    }
  }, [selectedBankPlayerId, squadIds]);

  useEffect(() => {
    return () => {
      if (assignFlashTimerRef.current) clearTimeout(assignFlashTimerRef.current);
    };
  }, []);

  const starterCount = useMemo(
    () => LIVE_FIELD_SLOT_ORDER.filter((slot) => Boolean(slots[slot])).length,
    [slots],
  );

  const starterSet = useMemo(() => {
    const set = new Set<string>();
    for (const slot of LIVE_FIELD_SLOT_ORDER) {
      const pid = slots[slot];
      if (pid) set.add(pid);
    }
    return set;
  }, [slots]);

  const bankIds = useMemo(
    () => squadIds.filter((id) => !starterSet.has(id)),
    [squadIds, starterSet],
  );

  const hasSquad = squadIds.length > 0;

  const onTapBankPlayer = (playerId: string) => {
    setSelectedBankPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const onTapSlot = (slot: FieldSlotId) => {
    setSaveMsg(null);
    setSaveError(null);
    const wasOccupied = Boolean(slots[slot]);
    const bankPick = selectedBankPlayerId;
    setSlots((prev) => {
      const next = { ...prev };
      if (next[slot]) {
        next[slot] = null;
        return next;
      }
      if (!selectedBankPlayerId) return prev;
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        if (next[s] === selectedBankPlayerId) next[s] = null;
      }
      next[slot] = selectedBankPlayerId;
      return next;
    });
    if (!wasOccupied && bankPick) {
      if (assignFlashTimerRef.current) clearTimeout(assignFlashTimerRef.current);
      setAssignFlashSlot(slot);
      assignFlashTimerRef.current = setTimeout(() => {
        setAssignFlashSlot(null);
        assignFlashTimerRef.current = null;
      }, 480);
    }
    if (selectedBankPlayerId) setSelectedBankPlayerId(null);
  };

  const saveLineup = async (): Promise<boolean> => {
    if (!matchId) return false;
    setSaveMsg(null);
    setSaveError(null);
    setSavingLineup(true);
    const ordered = LIVE_FIELD_SLOT_ORDER.map((slot) => slots[slot] ?? null);
    const { error } = await replaceMatchLineupAndBench(matchId, ordered, squadIds);
    setSavingLineup(false);
    if (error) {
      setSaveError(error);
      return false;
    }
    setSaveMsg('Aufstellung gespeichert.');
    return true;
  };

  const onStartLive = async () => {
    if (!matchId || starterCount < 7) return;
    setSaveMsg(null);
    setSaveError(null);
    setStartingLive(true);
    const saved = await saveLineup();
    if (!saved) {
      setStartingLive(false);
      return;
    }
    const { error } = await persistLiveMatchBegin(matchId);
    setStartingLive(false);
    if (error) {
      setSaveError(error);
      return;
    }
    navigate(`/app/live?matchId=${encodeURIComponent(matchId)}`);
  };

  if (matchLoading || lineupLoading) {
    return <div className="min-h-[100dvh] p-4 text-sm text-white/60">Lade Aufstellung…</div>;
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

  if (!hasSquad) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0a] px-4 py-6 text-white">
        <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[36px] w-fit items-center rounded-lg border border-white/15 bg-white/[0.05] px-2.5 text-xs font-semibold text-white/90 hover:bg-white/[0.09]"
          >
            ← Zurück
          </button>
          <h1 className="text-lg font-bold">AUFSTELLUNG</h1>
          <p className="text-sm text-white/70">Bitte zuerst Matchkader in der Match-Vorbereitung auswählen.</p>
          <button
            type="button"
            onClick={() => navigate(`/app/match-preparation?matchId=${encodeURIComponent(matchId)}`)}
            className="min-h-[48px] rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500"
          >
            Zur Match-Vorbereitung
          </button>
          {lineupError ? <p className="text-xs text-red-400">{lineupError}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-1 inline-flex min-h-[36px] items-center rounded-lg border border-white/15 bg-white/[0.05] px-2.5 text-xs font-semibold text-white/90 hover:bg-white/[0.09]"
            >
              ← Zurück
            </button>
            <h1 className="text-lg font-bold">AUFSTELLUNG</h1>
            <p className="truncate text-sm text-white/60">{matchRow?.opponent ? `vs. ${matchRow.opponent}` : 'Spiel'}</p>
          </div>
          <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
            Trainer
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-3 pb-[17rem]">
        {playersError ? <p className="text-sm text-red-400">{playersError}</p> : null}
        {lineupError ? <p className="text-sm text-red-400">{lineupError}</p> : null}
        {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
        {saveMsg ? <p className="text-sm text-emerald-300">{saveMsg}</p> : null}

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070b0a] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {/* Dezenter Spielfeld-Look (Linien ~8 % Opazität) */}
          <div
            className="pointer-events-none absolute inset-0 text-white"
            style={{ opacity: 0.12 }}
            aria-hidden
          >
            <svg className="h-full w-full" viewBox="0 0 360 520" preserveAspectRatio="xMidYMid slice">
              <rect x="0" y="0" width="360" height="520" fill="none" />
              <line x1="180" y1="0" x2="180" y2="520" stroke="currentColor" strokeWidth="1.35" />
              <circle cx="180" cy="260" r="52" fill="none" stroke="currentColor" strokeWidth="1.35" />
              <circle cx="180" cy="260" r="3.5" fill="currentColor" />
              <rect x="95" y="380" width="170" height="140" fill="none" stroke="currentColor" strokeWidth="1.35" />
              <line x1="95" y1="430" x2="265" y2="430" stroke="currentColor" strokeWidth="1.35" />
              <rect x="95" y="0" width="170" height="140" fill="none" stroke="currentColor" strokeWidth="1.35" />
              <line x1="95" y1="90" x2="265" y2="90" stroke="currentColor" strokeWidth="1.35" />
            </svg>
          </div>

          <div className="relative z-10 space-y-2 px-1 pb-1 pt-1">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/90">Startelf</h2>
              <span className="text-xs font-medium text-white/55">{starterCount}/7</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {LIVE_FIELD_SLOT_ORDER.map((slot) => {
                const playerId = slots[slot];
                const player = playerId ? playersById.get(playerId) : null;
                const empty = !player;
                const dropHint = empty && Boolean(selectedBankPlayerId);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onTapSlot(slot)}
                    className={[
                      'relative flex min-h-[12.5rem] flex-col items-center justify-start rounded-xl px-0 py-0.5 pb-0.5 pt-0.5 transition-all duration-300 ease-out active:scale-[0.98] sm:min-h-[13rem]',
                      empty
                        ? dropHint
                          ? 'border-2 border-dashed border-emerald-400/55 bg-black/35 shadow-[0_0_18px_rgba(16,185,129,0.22)]'
                          : 'border border-dashed border-white/25 bg-black/30 hover:bg-black/40'
                        : 'border border-white/10 bg-black/35 shadow-none',
                      assignFlashSlot === slot ? 'ring-2 ring-emerald-400/60 ring-offset-2 ring-offset-[#070b0a]' : '',
                    ].join(' ')}
                  >
                    <span className="mb-0 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                      {SLOT_LABELS[slot]}
                    </span>
                    {player ? (
                      <div className="flex min-h-0 flex-1 items-center justify-center pb-1 pt-0.5">
                        <span className="-translate-y-1 transition-transform duration-300 ease-out">
                          <LeibchenJersey
                            lastName={playerFamilyName(player)}
                            number={player.jersey_number}
                            position={SLOT_LABELS[slot]}
                            variant={slot === 'GK' ? 'goalkeeper' : 'field'}
                            size="large"
                            assignFlash={assignFlashSlot === slot}
                          />
                        </span>
                      </div>
                    ) : (
                      <div className="min-h-[6rem] flex-1" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors duration-300">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/85">Bank</h2>
          <div className="-mx-1 overflow-x-auto pb-1 pl-1 pr-1 [-webkit-overflow-scrolling:touch]">
            <div className="flex min-w-min flex-nowrap gap-2 transition-opacity duration-300">
              {bankIds.map((id) => {
                const p = playersById.get(id);
                if (!p) return null;
                const isSelected = selectedBankPlayerId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onTapBankPlayer(id)}
                    className={[
                      'shrink-0 rounded-xl px-1.5 py-1.5 transition-all duration-300 ease-out active:scale-95',
                      isSelected
                        ? 'border-2 border-emerald-400/80 bg-emerald-950/25 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                        : 'border border-white/12 bg-black/35 hover:border-white/20 hover:bg-black/45',
                    ].join(' ')}
                  >
                    <div className="flex flex-col items-center">
                      <LeibchenJersey
                        lastName={playerFamilyName(p)}
                        number={p.jersey_number}
                        position={benchPositionLabel(p)}
                        variant="field"
                        size="compact"
                        selected={isSelected}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {bankIds.length === 0 ? <p className="text-xs text-white/50">Keine Spieler auf der Bank.</p> : null}
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/85">Startaufstellung Liste</h2>
          <div className="space-y-1.5">
            {LIVE_FIELD_SLOT_ORDER.map((slot) => {
              const pid = slots[slot];
              const p = pid ? playersById.get(pid) : null;
              return (
                <div
                  key={`row-${slot}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
                >
                  <span className="text-xs font-semibold text-white/75">{SLOT_LABELS[slot]}</span>
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    {p ? (
                      <>
                        <LeibchenJersey
                          lastName={playerFamilyName(p)}
                          number={p.jersey_number}
                          position={SLOT_LABELS[slot]}
                          variant={slot === 'GK' ? 'goalkeeper' : 'field'}
                          size="compact"
                          className="!h-[3.6rem] !w-[2.85rem]"
                        />
                        <span className="truncate text-xs text-white/85">{p.display_name}</span>
                      </>
                    ) : (
                      <span className="text-xs text-white/55">frei</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <div
        className="fixed inset-x-0 z-[70] border-t border-white/10 bg-gradient-to-t from-black via-black/96 to-black/88 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium text-white/55">Startelf: {starterCount}/7</span>
          <div className="flex w-full items-stretch justify-end gap-2 sm:w-auto">
            <button
              type="button"
              disabled={savingLineup || startingLive}
              onClick={() => void saveLineup()}
              className="min-h-[44px] flex-1 rounded-xl border border-white/25 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
            >
              {savingLineup ? 'Speichern…' : 'Aufstellung speichern'}
            </button>
            <button
              type="button"
              disabled={starterCount < 7 || savingLineup || startingLive}
              onClick={() => void onStartLive()}
              className="min-h-[44px] flex-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-[0_2px_12px_rgba(220,38,38,0.45)] transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial"
            >
              {startingLive ? 'Starte…' : 'Live starten'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

