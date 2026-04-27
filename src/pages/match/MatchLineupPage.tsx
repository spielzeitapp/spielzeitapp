import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
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

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-3 pb-52">
        {playersError ? <p className="text-sm text-red-400">{playersError}</p> : null}
        {lineupError ? <p className="text-sm text-red-400">{lineupError}</p> : null}
        {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
        {saveMsg ? <p className="text-sm text-emerald-300">{saveMsg}</p> : null}

        <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/85">Startelf</h2>
            <span className="text-xs text-white/60">{starterCount}/7</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LIVE_FIELD_SLOT_ORDER.map((slot) => {
              const playerId = slots[slot];
              const player = playerId ? playersById.get(playerId) : null;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onTapSlot(slot)}
                  className={`min-h-[84px] rounded-xl border px-2 py-2 text-left ${
                    player
                      ? 'border-emerald-500/45 bg-emerald-950/35'
                      : 'border-white/15 bg-black/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/60">{SLOT_LABELS[slot]}</p>
                  {player ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-white">{player.display_name}</p>
                      <p className="text-xs text-white/65">#{player.jersey_number ?? '–'} · Tippen zum Entfernen</p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-white/50">{selectedBankPlayerId ? 'Tippen zum Zuweisen' : 'frei'}</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/85">Bank</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bankIds.map((id) => {
              const p = playersById.get(id);
              if (!p) return null;
              const isSelected = selectedBankPlayerId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTapBankPlayer(id)}
                  className={`rounded-xl border px-2 py-2 text-left ${
                    isSelected ? 'border-red-400 bg-red-900/35' : 'border-white/15 bg-black/25 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="rounded-lg bg-[repeating-linear-gradient(90deg,#dc2626_0,#dc2626_10px,#111827_10px,#111827_20px)] p-2">
                    <p className="text-lg font-black leading-none text-white">{p.jersey_number ?? '–'}</p>
                    <p className="mt-1 truncate text-[11px] font-semibold text-white/95">{p.display_name}</p>
                  </div>
                </button>
              );
            })}
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
                <div key={`row-${slot}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                  <span className="text-xs font-semibold text-white/75">{SLOT_LABELS[slot]}</span>
                  <span className="text-xs text-white/85">{p ? `${p.display_name}` : 'frei'}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <div
        className="fixed inset-x-0 z-[70] border-t border-white/10 bg-gradient-to-t from-black to-black/92 px-4 py-2.5 backdrop-blur"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <span className="text-xs text-white/60">Startelf: {starterCount}/7</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={savingLineup || startingLive}
              onClick={() => void saveLineup()}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingLineup ? 'Speichern…' : 'Aufstellung speichern'}
            </button>
            <button
              type="button"
              disabled={starterCount < 7 || savingLineup || startingLive}
              onClick={() => void onStartLive()}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {startingLive ? 'Starte…' : 'Live starten'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

