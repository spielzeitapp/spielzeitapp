import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import type { PlayerItem } from '../../hooks/usePlayers';
import { LeibchenJersey } from '../../components/match/LeibchenJersey';
import { LineupFormationPitch } from '../../components/match/LineupFormationPitch';
import { PitchPlayerMarker } from '../../components/match/PitchPlayerMarker';
import {
  fetchLineupForLiveMatch,
  LIVE_FIELD_SLOT_ORDER,
  replaceMatchLineupAndBench,
  updateMatchRow,
} from '../../lib/liveMatchService';
import {
  isU11FormationId,
  labelForSlotInFormation,
  readStoredU11Formation,
  U11_FORMATION_CHOICES,
  U11_FORMATION_DB_FALLBACK,
  writeStoredU11Formation,
  type U11FormationId,
} from '../../lib/matchFormations';
import { supabase } from '../../lib/supabaseClient';
import type { FieldSlotId } from '../../types/match';
import { getPositionLabel } from '../../lib/positionLabels';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  u11_formation_id: string | null;
};

type LocationState = {
  selectedPlayers?: string[];
} | null;

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

function benchPositionLabel(p: PlayerItem): string {
  const mapped = getPositionLabel(p.position) || '';
  if (!mapped) return '–';
  return mapped.toUpperCase();
}

function mobileLineupName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : name || '—';
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
  const [formationId, setFormationId] = useState<U11FormationId>(U11_FORMATION_DB_FALLBACK);
  const [isMobile, setIsMobile] = useState(false);
  const [lineupViewMode, setLineupViewMode] = useState<'pitch' | 'list'>('pitch');

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
        .select('id, team_season_id, opponent, u11_formation_id')
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
        const used = new Set<string>();
        for (let i = 0; i < LIVE_FIELD_SLOT_ORDER.length; i += 1) {
          const pid = data.startingPlayerIds[i] ?? null;
          if (!pid || used.has(pid)) {
            initialSlots[LIVE_FIELD_SLOT_ORDER[i]] = null;
            continue;
          }
          used.add(pid);
          initialSlots[LIVE_FIELD_SLOT_ORDER[i]] = pid;
        }
        if (initialSquad.length === 0) {
          initialSquad = data.squadPlayerIds.filter((id, idx, arr) => arr.indexOf(id) === idx);
        }
      }

      setSlots(initialSlots);
      const dedupSquad = [...new Set(initialSquad)];
      setSquadIds(dedupSquad);
      setLineupLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId, selectedFromState]);

  useEffect(() => {
    if (!matchId || !matchRow) return;
    const fromDb = matchRow.u11_formation_id;
    if (isU11FormationId(fromDb)) {
      setFormationId(fromDb);
      return;
    }
    const stored = readStoredU11Formation(matchId);
    if (stored) {
      setFormationId(stored);
      return;
    }
    setFormationId(U11_FORMATION_DB_FALLBACK);
  }, [matchId, matchRow]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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
    if (error) {
      setSavingLineup(false);
      setSaveError(error);
      return false;
    }
    const { error: formationErr } = await updateMatchRow(matchId, { u11_formation_id: formationId });
    setSavingLineup(false);
    if (formationErr) {
      setSaveError(formationErr);
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
    setStartingLive(false);
    if (!saved) {
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
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-[#050505] via-[#120808] to-[#0a0606] text-white">
      <style>{`@media (max-width: 639px){ nav[aria-label="Hauptnavigation"]{ display:none !important; } }`}</style>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/94 px-2 py-0.5 backdrop-blur sm:px-3 sm:py-1">
        <div className="mx-auto flex max-w-xl items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-8 shrink-0 items-center rounded-md border border-white/12 bg-white/[0.04] px-1.5 text-[10px] font-semibold text-white/88 hover:bg-white/[0.08] sm:min-h-8 sm:px-2 sm:text-[11px]"
          >
            ← Termin
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[10px] font-black uppercase tracking-[0.14em] text-white sm:text-[11px]">Aufstellung</h1>
            {matchRow?.opponent ? (
              <p className="truncate text-[8px] leading-tight text-white/38 sm:text-[9px]">vs. {matchRow.opponent}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/termine')}
            className="inline-flex h-8 min-h-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-1.5 text-white/72 hover:bg-white/[0.08] hover:text-white"
            aria-label="Termine – Spieler oder Termin"
            title="Termine"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <div
            className="inline-flex h-8 min-h-8 w-[10.5rem] shrink-0 items-stretch overflow-hidden rounded-md border border-white/12 bg-black/70 p-px sm:w-[11rem]"
            role="tablist"
            aria-label="Aufstellungsansicht"
          >
            <button
              type="button"
              role="tab"
              aria-selected={lineupViewMode === 'list'}
              onClick={() => setLineupViewMode('list')}
              className={[
                'flex-1 px-1.5 text-center text-[10px] font-bold leading-tight transition-colors sm:text-[11px]',
                lineupViewMode === 'list'
                  ? 'rounded-[5px] bg-red-600 text-white'
                  : 'rounded-[5px] text-white/42 hover:bg-white/[0.06] hover:text-white/75',
              ].join(' ')}
            >
              Liste
            </button>
            <span className="w-px shrink-0 self-stretch bg-white/10" aria-hidden />
            <button
              type="button"
              role="tab"
              aria-selected={lineupViewMode === 'pitch'}
              onClick={() => setLineupViewMode('pitch')}
              className={[
                'flex-1 px-1.5 text-center text-[10px] font-bold leading-tight transition-colors sm:text-[11px]',
                lineupViewMode === 'pitch'
                  ? 'rounded-[5px] bg-red-600 text-white'
                  : 'rounded-[5px] text-white/42 hover:bg-white/[0.06] hover:text-white/75',
              ].join(' ')}
            >
              Spielfeld
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-0.5 overflow-y-auto px-1 py-0.5 pb-[9.75rem] sm:gap-1 sm:px-2 sm:pb-[28rem]">
        {playersError ? <p className="text-sm text-red-400">{playersError}</p> : null}
        {lineupError ? <p className="text-sm text-red-400">{lineupError}</p> : null}
        {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
        {saveMsg ? <p className="text-sm text-emerald-300">{saveMsg}</p> : null}

        <div className="-mx-0.5 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <div className="flex flex-nowrap items-center gap-0.5 px-0.5 py-0">
            <span className="shrink-0 pl-0.5 text-[7px] font-bold uppercase tracking-wider text-white/28">Form</span>
            {U11_FORMATION_CHOICES.map((id) => {
              const active = formationId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFormationId(id);
                    if (matchId) writeStoredU11Formation(matchId, id);
                  }}
                  className={[
                    'shrink-0 rounded border px-1 py-[3px] text-[8px] font-bold leading-none transition-all sm:px-1.5 sm:text-[9px]',
                    active
                      ? 'border-red-500/75 bg-red-500/20 text-white shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                      : 'border-white/10 bg-black/40 text-white/68 hover:border-white/18',
                  ].join(' ')}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>

        {lineupViewMode === 'pitch' ? (
          <>
            <section className="relative p-0 sm:rounded-xl sm:border sm:border-white/[0.08] sm:bg-black/40 sm:p-1.5 sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:ring-1 sm:ring-red-950/28">
              <span
                className="pointer-events-none absolute right-1.5 top-1.5 z-[3] rounded border border-white/12 bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/90 shadow-sm sm:right-2 sm:top-2"
                aria-label={`Belegte Startplätze ${starterCount} von 7`}
              >
                {starterCount}/7
              </span>
              <div className="-mx-0.5 sm:mx-0">
                <LineupFormationPitch
                  formationId={formationId}
                  slots={slots}
                  interactive
                  onSlotTap={onTapSlot}
                  selectedBankPlayerId={selectedBankPlayerId}
                  assignFlashSlot={assignFlashSlot}
                  className="max-h-[min(72dvh,36rem)] w-full sm:max-h-[min(42rem,70vh)]"
                  renderSlotContent={({ label, labelDx, labelDy, playerId, flash, isGk, emphasize }) => {
                    const player = playerId ? playersById.get(playerId) : null;
                    if (!player) return null;
                    return (
                      <div className="pointer-events-none">
                        <PitchPlayerMarker
                          lastName={playerFamilyName(player)}
                          number={player.jersey_number}
                          positionBadge={getPositionLabel(label) || label}
                          variant={isGk ? 'goalkeeper' : 'field'}
                          mode="pitch"
                          nameOffsetX={labelDx}
                          nameOffsetY={labelDy}
                          assignFlash={flash}
                          emphasize={emphasize}
                        />
                      </div>
                    );
                  }}
                />
              </div>
            </section>

            <section className="rounded-lg border border-white/[0.08] bg-black/35 px-1 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)] sm:rounded-xl sm:px-1.5 sm:py-1.5 sm:ring-1 sm:ring-red-950/30">
              <div className="mb-0.5 flex items-center justify-between gap-2 px-0.5">
                <h2 className="text-[9px] font-black uppercase tracking-[0.14em] text-white/75">Ersatzbank</h2>
                <span className="text-[9px] font-semibold tabular-nums text-white/38">{bankIds.length}</span>
              </div>
              <div className="-mx-0.5 overflow-x-auto pb-0.5 pl-0.5 pr-0.5 [-webkit-overflow-scrolling:touch]">
                <div className="flex min-w-min flex-nowrap items-end gap-0.5">
                  {bankIds.map((id) => {
                    const p = playersById.get(id);
                    if (!p) return null;
                    const isSelected = selectedBankPlayerId === id;
                    const posLabel = benchPositionLabel(p);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onTapBankPlayer(id)}
                        className={[
                          'shrink-0 rounded-md px-0.5 py-0.5 transition-all active:scale-[0.98]',
                          isSelected
                            ? 'border border-emerald-400/70 bg-emerald-950/25 shadow-[0_0_10px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/40'
                            : 'border border-white/8 bg-black/28 hover:border-white/15',
                        ].join(' ')}
                      >
                        <div className="flex w-[3.35rem] max-w-[3.35rem] flex-col items-center sm:w-[3.5rem] sm:max-w-[3.5rem]">
                          <LeibchenJersey
                            lastName={mobileLineupName(playerFamilyName(p))}
                            number={p.jersey_number}
                            position={posLabel}
                            variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                            size="compact"
                            className="!h-[2.35rem] !w-[1.85rem] sm:!h-[2.55rem] sm:!w-[2rem]"
                            showBackPrint={false}
                            pitchStyleBack
                            selected={isSelected}
                          />
                          <span className="mt-0.5 w-full truncate text-center text-[8px] font-semibold leading-tight text-white/65">
                            {mobileLineupName(playerFamilyName(p))}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {bankIds.length === 0 ? <p className="px-0.5 text-[10px] text-white/45">Keine Spieler auf der Bank.</p> : null}
            </section>
          </>
        ) : (
          <section className="min-h-0 flex-1 rounded-lg border border-white/[0.08] bg-black/35 p-1.5 sm:rounded-xl sm:p-2">
            <div
              className="grid max-h-[min(72dvh,36rem)] min-h-[14rem] grid-cols-2 gap-1.5 sm:max-h-[min(75dvh,40rem)] sm:gap-2"
              style={{ minHeight: 'min(50dvh, 17rem)' }}
            >
              <div className="flex min-h-0 min-w-0 flex-col gap-1">
                <h2 className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-white/75">Startaufstellung</h2>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                  {LIVE_FIELD_SLOT_ORDER.map((slot) => {
                    const pid = slots[slot];
                    const p = pid ? playersById.get(pid) : null;
                    const posLabel = getPositionLabel(labelForSlotInFormation(formationId, slot)) || '—';
                    const isGk = slot === 'GK';
                    if (p) {
                      const shortName = mobileLineupName(playerFamilyName(p));
                      return (
                        <button
                          key={`list-f-${slot}`}
                          type="button"
                          onClick={() => onTapSlot(slot)}
                          className="flex h-[4.5rem] min-h-[4.25rem] w-full shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.1] bg-gradient-to-br from-red-950/35 via-black/78 to-black/92 px-1.5 py-1 text-left transition-all hover:border-red-500/32 active:scale-[0.99]"
                        >
                          <div className="pointer-events-none shrink-0">
                            <LeibchenJersey
                              lastName={shortName}
                              number={p.jersey_number ?? '–'}
                              position={posLabel}
                              variant={isGk ? 'goalkeeper' : 'field'}
                              size="compact"
                              pitchStyleBack
                              className="!h-[2.85rem] !w-[2.25rem] sm:!h-[3.1rem] sm:!w-[2.5rem]"
                            />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden">
                            <p className="truncate text-[12px] font-bold leading-tight text-white">{shortName}</p>
                            <span className="inline-flex w-fit rounded-md border border-red-500/30 bg-red-950/45 px-1 py-px text-[7px] font-bold uppercase tracking-wide text-red-100/90">
                              {posLabel}
                            </span>
                          </div>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={`list-f-${slot}`}
                        type="button"
                        onClick={() => onTapSlot(slot)}
                        className="flex h-[4.5rem] min-h-[4.25rem] w-full shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/14 bg-black/40 px-1.5 py-1 text-center transition-all active:scale-[0.99] hover:border-white/22"
                      >
                        <span className="text-[9px] font-black uppercase tracking-wide text-white/40">{posLabel}</span>
                        <span className="mt-0.5 text-[10px] font-semibold text-white/45">Frei</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col gap-1 border-l border-white/[0.06] pl-1.5 sm:pl-2">
                <h2 className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-white/75">Ersatzbank</h2>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                  {bankIds.length === 0 ? (
                    <p className="text-[11px] text-white/48">Keine Bankspieler.</p>
                  ) : (
                    bankIds.map((id) => {
                      const p = playersById.get(id);
                      if (!p) return null;
                      const posLabel = benchPositionLabel(p);
                      const shortName = mobileLineupName(playerFamilyName(p));
                      const isSelected = selectedBankPlayerId === id;
                      return (
                        <button
                          key={`list-b-${id}`}
                          type="button"
                          onClick={() => onTapBankPlayer(id)}
                          className={[
                            'flex h-[4.5rem] min-h-[4.25rem] w-full shrink-0 items-center gap-1.5 rounded-xl border px-1.5 py-1 text-left transition-all active:scale-[0.99]',
                            'bg-gradient-to-br from-emerald-950/22 via-black/78 to-black/92',
                            isSelected
                              ? 'border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.32)] ring-1 ring-emerald-400/50'
                              : 'border-white/[0.1] hover:border-emerald-500/28',
                          ].join(' ')}
                        >
                          <div className="pointer-events-none shrink-0">
                            <LeibchenJersey
                              lastName={shortName}
                              number={p.jersey_number ?? '–'}
                              position={posLabel}
                              variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                              size="compact"
                              pitchStyleBack
                              className="!h-[2.85rem] !w-[2.25rem] sm:!h-[3.1rem] sm:!w-[2.5rem]"
                            />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden">
                            <p className="truncate text-[12px] font-bold leading-tight text-white">{shortName}</p>
                            <span className="inline-flex w-fit rounded-md border border-amber-500/28 bg-amber-950/40 px-1 py-px text-[7px] font-bold uppercase tracking-wide text-amber-100/90">
                              Bank
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <div
        className="fixed inset-x-0 z-[70] border-t border-white/10 bg-gradient-to-t from-black via-black/96 to-black/88 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
        style={{
          bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 4px)' : 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium text-white/55">Startaufstellung: {starterCount}/7</span>
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
              {startingLive ? 'Starte…' : 'Zum Liveticker'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

