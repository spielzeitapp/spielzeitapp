import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerItem } from '../../../hooks/usePlayers';
import type { FieldSlotId } from '../../../types/match';
import { supabase } from '../../../lib/supabaseClient';
import { LIVE_FIELD_SLOT_ORDER, replaceMatchLineupAndBench } from '../../../lib/liveMatchService';
import { Card, CardTitle } from '../../../app/components/ui/Card';
import { Button } from '../../../app/components/ui/Button';

const MAX_STARTERS = 7;

function emptyStarters(): Record<FieldSlotId, string | null> {
  const o = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) {
    o[s] = null;
  }
  return o;
}

function sortPlayers(list: PlayerItem[]): PlayerItem[] {
  return [...list].sort(
    (a, b) =>
      (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) ||
      a.display_name.localeCompare(b.display_name, 'de'),
  );
}

function playerLabelNum(p: PlayerItem): string {
  return p.jersey_number != null ? String(p.jersey_number) : '–';
}

export type TrainerMatchLineupMvpProps = {
  matchId: string;
  players: PlayerItem[];
  onFieldSynced: (startersBySlot: Record<FieldSlotId, string | null>) => void;
  onLineupPersisted: () => void;
};

export const TrainerMatchLineupMvp: React.FC<TrainerMatchLineupMvpProps> = ({
  matchId,
  players,
  onFieldSynced,
  onLineupPersisted,
}) => {
  const navigate = useNavigate();
  const [squadSet, setSquadSet] = useState<Set<string>>(() => new Set());
  const [startersBySlot, setStartersBySlot] = useState<Record<FieldSlotId, string | null>>(emptyStarters);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const validPlayerIds = useMemo(() => new Set(players.map((p) => p.id)), [players]);
  const sortedPlayers = useMemo(() => sortPlayers(players), [players]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);

      const [lineupRes, benchRes] = await Promise.all([
        supabase.from('match_lineup').select('slot, player_id').eq('match_id', matchId),
        supabase.from('match_bench').select('player_id').eq('match_id', matchId),
      ]);

      if (cancelled) return;

      if (lineupRes.error) {
        setLoadError(lineupRes.error.message);
        setLoading(false);
        return;
      }
      if (benchRes.error) {
        setLoadError(benchRes.error.message);
        setLoading(false);
        return;
      }

      const nextStarters = emptyStarters();
      for (const r of (lineupRes.data ?? []) as { slot: FieldSlotId; player_id: string | null }[]) {
        if (LIVE_FIELD_SLOT_ORDER.includes(r.slot) && r.player_id) {
          nextStarters[r.slot] = r.player_id;
        }
      }

      const benchIds = ((benchRes.data ?? []) as { player_id: string }[]).map((x) => x.player_id);
      const squad = new Set<string>();
      for (const id of benchIds) {
        if (id) squad.add(id);
      }
      for (const slot of LIVE_FIELD_SLOT_ORDER) {
        const pid = nextStarters[slot];
        if (pid) squad.add(pid);
      }

      setStartersBySlot(nextStarters);
      setSquadSet(squad);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (validPlayerIds.size === 0) return;
    setSquadSet((prev) => new Set([...prev].filter((id) => validPlayerIds.has(id))));
    setStartersBySlot((prev) => {
      const next = { ...prev };
      for (const s of LIVE_FIELD_SLOT_ORDER) {
        const pid = next[s];
        if (pid && !validPlayerIds.has(pid)) next[s] = null;
      }
      return next;
    });
  }, [players, validPlayerIds]);

  const startingCount = useMemo(
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

  const squadPlayers = useMemo(
    () => sortedPlayers.filter((p) => squadSet.has(p.id)),
    [sortedPlayers, squadSet],
  );

  const bankPlayers = useMemo(
    () => squadPlayers.filter((p) => !starterIdSet.has(p.id)),
    [squadPlayers, starterIdSet],
  );

  const toggleSquad = useCallback((id: string) => {
    setSquadSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setStartersBySlot((st) => {
          const o = { ...st };
          for (const s of LIVE_FIELD_SLOT_ORDER) {
            if (o[s] === id) o[s] = null;
          }
          return o;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleStarting = useCallback(
    (id: string) => {
      if (!squadSet.has(id)) return;
      setStartersBySlot((prev) => {
        const next = { ...prev };
        let isStarter = false;
        for (const s of LIVE_FIELD_SLOT_ORDER) {
          if (next[s] === id) isStarter = true;
        }
        if (isStarter) {
          for (const s of LIVE_FIELD_SLOT_ORDER) {
            if (next[s] === id) next[s] = null;
          }
          return next;
        }
        const count = LIVE_FIELD_SLOT_ORDER.filter((s) => next[s] != null).length;
        if (count >= MAX_STARTERS) return prev;
        const emptySlot = LIVE_FIELD_SLOT_ORDER.find((s) => next[s] == null);
        if (!emptySlot) return prev;
        for (const s of LIVE_FIELD_SLOT_ORDER) {
          if (next[s] === id) next[s] = null;
        }
        next[emptySlot] = id;
        return next;
      });
    },
    [squadSet],
  );

  const persist = useCallback(async (): Promise<string | null> => {
    setSaveError(null);
    setSaving(true);
    try {
      const startingOrdered = LIVE_FIELD_SLOT_ORDER.map((s) => startersBySlot[s] ?? null);
      const squadArr = [...squadSet].filter((pid) => validPlayerIds.has(pid));
      const { error } = await replaceMatchLineupAndBench(matchId, startingOrdered, squadArr);
      if (error) return error;
      onFieldSynced(startersBySlot);
      onLineupPersisted();
      return null;
    } finally {
      setSaving(false);
    }
  }, [matchId, onFieldSynced, onLineupPersisted, squadSet, startersBySlot, validPlayerIds]);

  const slotsLeft = MAX_STARTERS - startingCount;
  const canGoLive = startingCount === MAX_STARTERS;

  const sectionHint = 'text-sm text-[var(--text-sub)]';

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-[var(--muted)]">Kader und Aufstellung werden geladen…</p>}
      {loadError && (
        <p className="text-sm text-red-600" role="alert">
          {loadError}
        </p>
      )}
      {saveError && (
        <p className="text-sm text-red-600" role="alert">
          {saveError}
        </p>
      )}

      {!loading && (
        <>
          <Card>
            <CardTitle>Matchkader</CardTitle>
            <p className={`mt-1 ${sectionHint}`}>Spieler für dieses Match auswählen</p>
            <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
              {squadSet.size} {squadSet.size === 1 ? 'Spieler' : 'Spieler'} im Kader
            </p>
            <ul className="mt-3 space-y-2">
              {sortedPlayers.map((p) => {
                const inSquad = squadSet.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggleSquad(p.id)}
                      className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors active:scale-[0.99] ${
                        inSquad
                          ? 'border-red-500/40 bg-red-950/25'
                          : 'border-[var(--border)] bg-black/20 opacity-70'
                      }`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/40 text-base font-black text-[var(--text-main)]">
                        {playerLabelNum(p)}
                      </span>
                      <span className="min-w-0 flex-1 text-base font-semibold text-[var(--text-main)]">
                        {p.display_name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-2 text-sm font-bold ${
                          inSquad ? 'bg-emerald-600 text-white' : 'bg-white/10 text-[var(--text-sub)]'
                        }`}
                      >
                        {inSquad ? 'Im Kader' : 'Nein'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardTitle>Startelf</CardTitle>
            <p className={`mt-1 ${sectionHint}`}>Genau 7 Spieler auswählen</p>
            <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
              {startingCount >= MAX_STARTERS ? (
                <span className="text-emerald-400">Startelf vollständig (7/7)</span>
              ) : (
                <>
                  Noch {slotsLeft} {slotsLeft === 1 ? 'Platz' : 'Plätze'} frei
                </>
              )}
            </p>
            {squadPlayers.length === 0 ? (
              <p className="mt-3 rounded-xl border border-[var(--border)] bg-black/15 p-4 text-sm text-[var(--text-sub)]">
                Wähle zuerst Spieler für den Matchkader.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {squadPlayers.map((p) => {
                  const isStarter = starterIdSet.has(p.id);
                  const blockMore = !isStarter && startingCount >= MAX_STARTERS;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={blockMore}
                        onClick={() => toggleStarting(p.id)}
                        className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
                          isStarter
                            ? 'border-emerald-500/50 bg-emerald-950/35'
                            : 'border-[var(--border)] bg-black/15'
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-black ${
                            isStarter ? 'bg-emerald-600/30 text-emerald-300' : 'bg-black/40 text-[var(--text-sub)]'
                          }`}
                        >
                          {playerLabelNum(p)}
                        </span>
                        <span className="min-w-0 flex-1 text-base font-semibold text-[var(--text-main)]">
                          {p.display_name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-3 py-2 text-sm font-bold ${
                            isStarter ? 'bg-emerald-600 text-white' : 'bg-white/10 text-[var(--text-sub)]'
                          }`}
                        >
                          {isStarter ? 'Startelf' : 'Bank'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Bank</CardTitle>
            <p className={`mt-1 ${sectionHint}`}>Kader ohne Startelf</p>
            {bankPlayers.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-sub)]">Keine Spieler auf der Bank.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {bankPlayers.map((p) => (
                  <li key={p.id} className="flex min-h-[48px] items-center gap-3 py-2">
                    <span className="w-9 text-center text-sm font-black text-[var(--text-sub)]">
                      {playerLabelNum(p)}
                    </span>
                    <span className="font-medium text-[var(--text-main)]">{p.display_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Aktuelle Aufstellung</CardTitle>
            <p className={`mt-1 ${sectionHint}`}>Vorschau der 7 Startplätze</p>
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 to-black/60 px-2 py-5">
              <div className="pointer-events-none absolute inset-0 opacity-25">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/25" />
                <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
              </div>
              <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LIVE_FIELD_SLOT_ORDER.map((slot) => {
                  const pid = startersBySlot[slot];
                  const pl = pid ? players.find((x) => x.id === pid) : null;
                  return (
                    <div
                      key={slot}
                      className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center ${
                        pl
                          ? 'border-emerald-500/45 bg-emerald-600/15'
                          : 'border-dashed border-white/15 bg-black/25'
                      }`}
                    >
                      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-white/40">{slot}</span>
                      {pl ? (
                        <>
                          <span className="mt-1 text-sm font-black text-emerald-300">{playerLabelNum(pl)}</span>
                          <span className="max-w-full truncate text-xs font-semibold text-[var(--text-main)]">
                            {pl.display_name.split(' ')[0]}
                          </span>
                        </>
                      ) : (
                        <span className="mt-2 text-xs text-white/30">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-3 pt-1">
            <Button
              type="button"
              variant="primary"
              className="min-h-[52px] w-full text-base font-bold"
              disabled={saving}
              onClick={async () => {
                const err = await persist();
                if (err) setSaveError(err);
              }}
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[52px] w-full border-emerald-500/40 bg-emerald-600/20 text-base font-bold text-emerald-100 hover:bg-emerald-600/30"
              disabled={saving || !canGoLive}
              onClick={async () => {
                const err = await persist();
                if (err) {
                  setSaveError(err);
                  return;
                }
                navigate(`/live?matchId=${matchId}`);
              }}
            >
              Live starten
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
