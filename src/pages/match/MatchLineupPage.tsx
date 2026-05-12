import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Settings } from 'lucide-react';
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

const HOME_CLUB_LOGO = `${import.meta.env.BASE_URL}logos/nsg-goelsental.png`;
const HOME_CLUB_TAG = 'NSG';

function opponentAbbrev(opponent: string | null): string {
  if (!opponent?.trim()) return '—';
  const words = opponent
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 4);
  }
  return opponent.trim().slice(0, 3).toUpperCase();
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
      <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-[10.75rem] pt-1.5 sm:gap-2 sm:px-3 sm:pb-[26rem] sm:pt-2">
        <div className="flex min-h-[2.75rem] items-center gap-2 border-b border-white/[0.06] pb-2 pt-0.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md py-1 pl-0.5 pr-1 text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white active:scale-[0.98]"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} />
            <span className="text-[11px] font-medium leading-none text-white/65">Zurück</span>
          </button>
          <h1 className="min-w-0 shrink truncate text-base font-black uppercase tracking-[0.12em] text-white sm:text-lg">Aufstellung</h1>
          <div className="ml-auto flex min-w-0 max-w-[52%] items-center justify-end gap-1 sm:max-w-[55%] sm:gap-1.5">
            <img
              src={HOME_CLUB_LOGO}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/18 ring-offset-0"
              width={24}
              height={24}
            />
            <span className="shrink-0 text-[11px] font-black tracking-wide text-white/92 sm:text-xs">{HOME_CLUB_TAG}</span>
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/32">vs</span>
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-900 text-[8px] font-black leading-none text-white/95 ring-1 ring-white/15"
              aria-hidden
            >
              {opponentAbbrev(matchRow?.opponent ?? null).slice(0, 3)}
            </div>
            <span className="min-w-0 truncate text-[11px] font-black tracking-wide text-white/88 sm:text-xs" title={matchRow?.opponent ?? undefined}>
              {opponentAbbrev(matchRow?.opponent ?? null)}
            </span>
          </div>
        </div>

        <div
          className="flex h-10 w-full shrink-0 overflow-hidden rounded-lg border border-white/[0.1] bg-zinc-950/95 p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="tablist"
          aria-label="Aufstellungsansicht"
        >
          <button
            type="button"
            role="tab"
            aria-selected={lineupViewMode === 'list'}
            onClick={() => setLineupViewMode('list')}
            className={[
              'min-h-9 flex-1 rounded-[7px] px-2 text-center text-sm font-bold transition-all',
              lineupViewMode === 'list'
                ? 'bg-red-600 text-white shadow-[0_0_14px_rgba(220,38,38,0.38)]'
                : 'bg-transparent text-white/78 hover:bg-white/[0.05] hover:text-white',
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
              'min-h-9 flex-1 rounded-[7px] px-2 text-center text-sm font-bold transition-all',
              lineupViewMode === 'pitch'
                ? 'bg-red-600 text-white shadow-[0_0_14px_rgba(220,38,38,0.38)]'
                : 'bg-transparent text-white/78 hover:bg-white/[0.05] hover:text-white',
            ].join(' ')}
          >
            Spielfeld
          </button>
        </div>

        <div className="-mx-1 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:-mx-0">
          <div className="flex min-h-9 flex-nowrap items-center gap-1.5 px-0.5 py-0.5">
            <span className="flex shrink-0 items-center justify-center pl-0.5 text-white/38" title="Formation">
              <Settings className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </span>
            <span className="sr-only">Formation</span>
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
                    'h-9 shrink-0 rounded-lg border px-3 text-xs font-bold leading-none transition-colors',
                    active
                      ? 'border-red-500/55 bg-red-600/22 text-white'
                      : 'border-white/10 bg-black/50 text-white/82 hover:border-white/18 hover:bg-black/60',
                  ].join(' ')}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>
        {playersError ? <p className="text-sm text-red-400">{playersError}</p> : null}
        {lineupError ? <p className="text-sm text-red-400">{lineupError}</p> : null}
        {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
        {saveMsg ? <p className="text-sm text-emerald-300">{saveMsg}</p> : null}

        {lineupViewMode === 'pitch' ? (
          <>
            <section className="relative -mt-0.5 rounded-2xl border border-white/[0.07] bg-zinc-950/40 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_28px_rgba(0,0,0,0.55)] sm:p-1.5">
              <span
                className="pointer-events-none absolute right-2 top-2 z-[3] rounded-md border border-white/12 bg-black/80 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white/95 sm:right-2.5 sm:top-2.5 sm:text-xs"
                aria-label={`Belegte Startplätze ${starterCount} von 7`}
              >
                {starterCount}/7
              </span>
              <div className="sm:mx-0">
                <LineupFormationPitch
                  formationId={formationId}
                  slots={slots}
                  interactive
                  onSlotTap={onTapSlot}
                  selectedBankPlayerId={selectedBankPlayerId}
                  assignFlashSlot={assignFlashSlot}
                  className="max-h-[min(68dvh,42rem)] w-full sm:max-h-[min(46rem,74vh)]"
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

            <section className="rounded-xl border border-white/[0.08] bg-black/42 px-1.5 py-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.42)] sm:px-2 sm:py-2">
              <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                <h2 className="text-[9px] font-black uppercase tracking-[0.14em] text-white/72 sm:text-[10px]">Ersatzbank</h2>
                <span className="text-[10px] font-semibold tabular-nums text-white/42 sm:text-[11px]">
                  {bankIds.length} {bankIds.length === 1 ? 'Spieler' : 'Spieler'}
                </span>
              </div>
              <div className="-mx-0.5 overflow-x-auto pb-0.5 pl-0.5 pr-0.5 [-webkit-overflow-scrolling:touch]">
                <div className="flex min-w-min flex-nowrap items-end gap-1">
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
                          'shrink-0 rounded-lg px-0.5 py-0.5 transition-all active:scale-[0.99]',
                          isSelected
                            ? 'border border-emerald-400/70 bg-emerald-950/26 shadow-[0_0_10px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/40'
                            : 'border border-white/9 bg-black/38 hover:border-white/16',
                        ].join(' ')}
                      >
                        <div className="flex w-[3.65rem] max-w-[3.65rem] flex-col items-center sm:w-[3.85rem] sm:max-w-[3.85rem]">
                          <LeibchenJersey
                            lastName={mobileLineupName(playerFamilyName(p))}
                            number={p.jersey_number}
                            position={posLabel}
                            variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                            size="compact"
                            className="!h-[2.85rem] !w-[2.25rem] sm:!h-[3rem] sm:!w-[2.4rem]"
                            showBackPrint={false}
                            pitchStyleBack
                            selected={isSelected}
                          />
                          <span className="mt-0.5 w-full truncate text-center text-[10px] font-semibold leading-tight text-white/80 sm:text-[11px]">
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
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/[0.08] bg-black/40 p-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.38)] sm:p-2">
            <div className="grid min-h-[13.5rem] grid-cols-2 gap-1.5 sm:min-h-[15rem] sm:gap-2">
              <div className="flex min-h-0 min-w-0 flex-col gap-1">
                <h2 className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-white/75 sm:text-[10px]">Startaufstellung</h2>
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
                          className="flex min-h-[4.75rem] w-full shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-gradient-to-br from-red-950/32 via-black/80 to-black/92 px-1.5 py-1 text-left transition-all hover:border-red-500/35 active:scale-[0.99] sm:min-h-[5rem]"
                        >
                          <div className="pointer-events-none shrink-0">
                            <LeibchenJersey
                              lastName={shortName}
                              number={p.jersey_number ?? '–'}
                              position={posLabel}
                              variant={isGk ? 'goalkeeper' : 'field'}
                              size="compact"
                              pitchStyleBack
                              className="!h-[3.35rem] !w-[2.65rem] sm:!h-[3.5rem] sm:!w-[2.75rem]"
                            />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden py-0.5">
                            <p className="truncate text-[13px] font-bold leading-snug text-white sm:text-sm">{shortName}</p>
                            <span className="inline-flex w-fit rounded border border-red-500/32 bg-red-950/42 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-red-100/88 sm:text-[9px]">
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
                        className="flex min-h-[3.75rem] w-full shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-white/16 bg-black/45 px-1.5 py-1 text-center transition-all active:scale-[0.99] hover:border-white/24 sm:min-h-[4rem]"
                      >
                        <span className="text-[9px] font-black uppercase tracking-wide text-white/44 sm:text-[10px]">{posLabel}</span>
                        <span className="text-[11px] font-semibold text-white/48">Frei</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col gap-1 border-l border-white/[0.07] pl-1.5 sm:pl-2">
                <h2 className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-white/75 sm:text-[10px]">Ersatzbank</h2>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                  {bankIds.length === 0 ? (
                    <p className="text-[10px] text-white/48">Keine Bankspieler.</p>
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
                            'flex min-h-[4.75rem] w-full shrink-0 items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition-all active:scale-[0.99] sm:min-h-[5rem]',
                            'bg-gradient-to-br from-emerald-950/22 via-black/80 to-black/92',
                            isSelected
                              ? 'border-emerald-400/85 shadow-[0_0_12px_rgba(16,185,129,0.28)] ring-1 ring-emerald-400/48'
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
                              className="!h-[3.35rem] !w-[2.65rem] sm:!h-[3.5rem] sm:!w-[2.75rem]"
                            />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden py-0.5">
                            <p className="truncate text-[13px] font-bold leading-snug text-white sm:text-sm">{shortName}</p>
                            <span className="inline-flex w-fit rounded border border-amber-500/28 bg-amber-950/38 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-amber-100/88 sm:text-[9px]">
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
        className="fixed inset-x-0 z-[70] border-t border-white/[0.09] bg-gradient-to-t from-black via-black/97 to-black/90 px-3 py-2 shadow-[0_-6px_20px_rgba(0,0,0,0.42)] backdrop-blur-md"
        style={{
          bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 4px)' : 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mx-auto flex max-w-xl flex-col gap-1.5">
          <span className="text-[10px] font-medium tabular-nums text-white/48">Startaufstellung {starterCount}/7</span>
          <div className="flex w-full items-stretch gap-2">
            <button
              type="button"
              disabled={savingLineup || startingLive}
              onClick={() => void saveLineup()}
              className="flex h-10 min-h-10 flex-1 items-center justify-center rounded-lg border border-white/22 bg-white/[0.06] px-2 text-[11px] font-semibold leading-tight text-white/95 transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
            >
              {savingLineup ? 'Speichern…' : 'Aufstellung speichern'}
            </button>
            <button
              type="button"
              disabled={starterCount < 7 || savingLineup || startingLive}
              onClick={() => void onStartLive()}
              className="flex h-10 min-h-10 flex-1 items-center justify-center rounded-lg bg-red-600 px-2 text-[11px] font-bold leading-tight text-white shadow-[0_0_14px_rgba(220,38,38,0.28)] transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
            >
              {startingLive ? 'Starte…' : 'Zum Liveticker'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

