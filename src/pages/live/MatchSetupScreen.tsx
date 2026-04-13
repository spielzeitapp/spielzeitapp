import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { usePlayers } from '../../hooks/usePlayers';
import { type LiveMatchSetupPayload } from '../../lib/liveMatchSetup';
import { persistLiveMatchBegin, replaceMatchLineupAndBench, upsertMatchForSetup } from '../../lib/liveMatchService';
import { playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';

/** @deprecated Nutze RosterPlayer — nur für ältere Imports. */
export type SetupPlayer = RosterPlayer;

const MAX_STARTERS = 7;

function sortRoster(list: RosterPlayer[]): RosterPlayer[] {
  return [...list].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

function idSet(arr: string[]): Set<string> {
  return new Set(arr);
}

/** Payload für späteren Supabase-Insert (matches + match_lineup + …) */
export type MatchSetupSnapshot = LiveMatchSetupPayload;

const inputClass =
  'mt-1 w-full min-h-[52px] rounded-2xl border border-white/15 bg-black/50 px-4 text-base text-white placeholder:text-white/35 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40';
const sectionTitle = 'text-xs font-bold uppercase tracking-[0.2em] text-white/45';

export const MatchSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const { selectedTeamSeasonId, selectedTeamSeason } = useSession();
  const { players, loading: playersLoading, error: playersError } = usePlayers(selectedTeamSeasonId);

  const roster = useMemo(
    () => sortRoster(players.map(playerItemToRoster)),
    [players],
  );
  const teamLabel = selectedTeamSeason?.team?.name ?? 'Team';

  const [opponent, setOpponent] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchTime, setMatchTime] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [locationNote, setLocationNote] = useState('');
  const [hasCreatedMatch, setHasCreatedMatch] = useState(false);
  const [savedMatchId, setSavedMatchId] = useState<string | null>(null);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [selectedSquadPlayerIds, setSelectedSquadPlayerIds] = useState<string[]>([]);
  const [selectedStartingPlayerIds, setSelectedStartingPlayerIds] = useState<string[]>([]);

  useEffect(() => {
    if (players.length === 0) return;
    const valid = new Set(players.map((p) => p.id));
    setSelectedSquadPlayerIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      if (next.length === 0) return players.map((p) => p.id);
      return next;
    });
    setSelectedStartingPlayerIds((prev) => prev.filter((id) => valid.has(id)));
  }, [players]);

  const squadSet = useMemo(() => idSet(selectedSquadPlayerIds), [selectedSquadPlayerIds]);
  const startingSet = useMemo(() => idSet(selectedStartingPlayerIds), [selectedStartingPlayerIds]);

  const squadPlayers = useMemo(
    () => roster.filter((p) => squadSet.has(p.id)),
    [roster, squadSet],
  );

  const startingCount = selectedStartingPlayerIds.length;
  const slotsLeft = MAX_STARTERS - startingCount;

  const toggleSquad = useCallback(
    (id: string) => {
      setSelectedSquadPlayerIds((prev) => {
        const s = new Set(prev);
        if (s.has(id)) {
          s.delete(id);
          setSelectedStartingPlayerIds((st) => st.filter((x) => x !== id));
          return [...s];
        }
        s.add(id);
        return [...s];
      });
    },
    [],
  );

  const toggleStarting = useCallback(
    (id: string) => {
      if (!squadSet.has(id)) return;
      setSelectedStartingPlayerIds((prev) => {
        const s = new Set(prev);
        if (s.has(id)) {
          s.delete(id);
          return [...s];
        }
        if (s.size >= MAX_STARTERS) return prev;
        s.add(id);
        return [...s];
      });
    },
    [squadSet],
  );

  const bankPlayers = useMemo(
    () => squadPlayers.filter((p) => !startingSet.has(p.id)),
    [squadPlayers, startingSet],
  );

  const startersOrdered = useMemo(
    () =>
      selectedStartingPlayerIds
        .map((id) => roster.find((p) => p.id === id))
        .filter(Boolean) as RosterPlayer[],
    [selectedStartingPlayerIds, roster],
  );

  const canGoLive =
    opponent.trim().length > 0 &&
    matchDate.trim().length > 0 &&
    matchTime.trim().length > 0 &&
    selectedStartingPlayerIds.length === MAX_STARTERS;

  const buildSnapshot = (): MatchSetupSnapshot => ({
    opponent: opponent.trim(),
    matchDate,
    matchTime,
    isHome,
    locationNote: locationNote.trim(),
    squadPlayerIds: [...selectedSquadPlayerIds],
    startingPlayerIds: [...selectedStartingPlayerIds],
  });

  const persistMatchAndLineup = useCallback(async (): Promise<string | null> => {
    if (!selectedTeamSeasonId) {
      setSetupError('Keine Mannschaftssaison.');
      return null;
    }
    if (!opponent.trim() || !matchDate.trim() || !matchTime.trim()) {
      setSetupError('Gegner, Datum und Uhrzeit sind Pflicht.');
      return null;
    }
    if (selectedSquadPlayerIds.length === 0) {
      setSetupError('Mindestens ein Spieler im Kader.');
      return null;
    }
    setSetupSaving(true);
    setSetupError(null);
    const { matchId, error: upErr } = await upsertMatchForSetup({
      matchId: savedMatchId,
      teamSeasonId: selectedTeamSeasonId,
      opponent: opponent.trim(),
      matchDate,
      matchTime,
      locationNote: locationNote.trim(),
    });
    if (upErr || !matchId) {
      setSetupSaving(false);
      setSetupError(upErr ?? 'Match speichern fehlgeschlagen.');
      return null;
    }
    setSavedMatchId(matchId);
    const { error: lineErr } = await replaceMatchLineupAndBench(
      matchId,
      selectedStartingPlayerIds,
      selectedSquadPlayerIds,
    );
    setSetupSaving(false);
    if (lineErr) {
      setSetupError(lineErr);
      return null;
    }
    setHasCreatedMatch(true);
    return matchId;
  }, [
    selectedTeamSeasonId,
    opponent,
    matchDate,
    matchTime,
    locationNote,
    savedMatchId,
    selectedStartingPlayerIds,
    selectedSquadPlayerIds,
  ]);

  const onSave = async () => {
    await persistMatchAndLineup();
  };

  const onLiveMatch = async () => {
    if (!canGoLive) return;
    const id = await persistMatchAndLineup();
    if (!id) return;
    const { error } = await persistLiveMatchBegin(id);
    if (error) {
      setSetupError(error);
      return;
    }
    navigate(`/live?matchId=${id}`);
  };

  const onCreateMatch = () => {
    setHasCreatedMatch(true);
    console.info('[MatchSetup] match basis gespeichert ( MVP lokal )', buildSnapshot());
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] pb-40 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f0f0f]/95 px-4 py-4 backdrop-blur-md">
        <div className="relative mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute right-0 top-0 min-h-[44px] min-w-[44px] rounded-xl px-3 text-sm font-semibold text-white/60 hover:text-white"
          >
            Abbrechen
          </button>
          <h1 className="pr-20 text-xl font-bold tracking-tight">Match vorbereiten</h1>
          <p className="mt-1 text-sm text-white/50">{teamLabel}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-5">
        {playersLoading && roster.length === 0 && (
          <p className="text-center text-sm text-white/55">Spieler werden geladen…</p>
        )}
        {playersError && (
          <p className="text-center text-sm text-red-400" role="alert">
            {playersError}
          </p>
        )}
        {!playersLoading && !playersError && selectedTeamSeasonId && roster.length === 0 && (
          <p className="text-center text-sm text-white/55">
            Keine aktiven Spieler für diese Mannschaftssaison. Lege Spieler unter Team an.
          </p>
        )}
        {!selectedTeamSeasonId && (
          <p className="text-center text-sm text-white/55">Keine Mannschaftssaison gewählt.</p>
        )}
        {setupError && (
          <p className="text-center text-sm text-amber-400" role="alert">
            {setupError}
          </p>
        )}

        {/* Match Basis */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <h2 className={sectionTitle}>Match</h2>
            {hasCreatedMatch && (
              <span className="rounded-full bg-emerald-600/25 px-3 py-1 text-xs font-bold text-emerald-400">
                Angelegt
              </span>
            )}
          </div>

          <label className="mt-4 block text-sm font-medium text-white/70" htmlFor="setup-opponent">
            Gegner
          </label>
          <input
            id="setup-opponent"
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="z. B. SV Nachbardorf"
            className={inputClass}
            autoComplete="off"
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-white/70" htmlFor="setup-date">
                Datum
              </label>
              <input
                id="setup-date"
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70" htmlFor="setup-time">
                Uhrzeit
              </label>
              <input
                id="setup-time"
                type="time"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <p className="mt-4 text-sm font-medium text-white/70">Heim / Auswärts</p>
          <div className="mt-2 flex rounded-2xl bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setIsHome(true)}
              className={`min-h-[52px] flex-1 rounded-xl text-base font-bold transition-colors ${
                isHome ? 'bg-red-600 text-white shadow-md' : 'text-white/55 active:bg-white/5'
              }`}
            >
              Heim
            </button>
            <button
              type="button"
              onClick={() => setIsHome(false)}
              className={`min-h-[52px] flex-1 rounded-xl text-base font-bold transition-colors ${
                !isHome ? 'bg-red-600 text-white shadow-md' : 'text-white/55 active:bg-white/5'
              }`}
            >
              Auswärts
            </button>
          </div>

          <label className="mt-4 block text-sm font-medium text-white/45" htmlFor="setup-note">
            Ort / Notiz (optional)
          </label>
          <input
            id="setup-note"
            type="text"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            placeholder="Später: Spielort oder Hinweise"
            className={inputClass}
          />

          <button
            type="button"
            onClick={onCreateMatch}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-base font-bold text-white active:bg-white/15"
          >
            {hasCreatedMatch ? 'Matchdaten aktualisieren' : 'Match anlegen'}
          </button>
        </section>

        {/* Kader */}
        <section>
          <div className="mb-2 flex items-end justify-between gap-2">
            <h2 className={`${sectionTitle} !mb-0`}>Kader</h2>
            <p className="text-sm font-semibold text-white/60">
              {selectedSquadPlayerIds.length} von {roster.length} im Kader
            </p>
          </div>
          <ul className="space-y-2">
            {roster.map((p) => {
              const inSquad = squadSet.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggleSquad(p.id)}
                    className={`flex min-h-[64px] w-full items-center gap-4 rounded-2xl border px-4 text-left transition-colors active:scale-[0.99] ${
                      inSquad
                        ? 'border-red-500/40 bg-red-950/35'
                        : 'border-white/10 bg-white/[0.03] opacity-60'
                    }`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/40 text-lg font-black text-white">
                      {p.number}
                    </span>
                    <span className="min-w-0 flex-1 text-lg font-semibold">{p.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-2 text-sm font-bold ${
                        inSquad ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {inSquad ? 'Im Kader' : 'Nein'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Startelf */}
        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h2 className={`${sectionTitle} !mb-0`}>
              Startelf ({startingCount}/{MAX_STARTERS})
            </h2>
            {startingCount >= MAX_STARTERS ? (
              <span className="text-sm font-bold text-emerald-400">Startelf vollständig</span>
            ) : (
              <span className="text-sm font-semibold text-amber-400/90">
                Noch {slotsLeft} {slotsLeft === 1 ? 'Platz' : 'Plätze'} frei
              </span>
            )}
          </div>
          {squadPlayers.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
              Wähle zuerst Spieler für den Kader.
            </p>
          ) : (
            <ul className="space-y-2">
              {squadPlayers.map((p) => {
                const isStarter = startingSet.has(p.id);
                const blockMore = !isStarter && startingCount >= MAX_STARTERS;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={blockMore}
                      onClick={() => toggleStarting(p.id)}
                      className={`flex min-h-[64px] w-full items-center gap-4 rounded-2xl border px-4 text-left transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
                        isStarter
                          ? 'border-emerald-500/50 bg-emerald-950/40'
                          : 'border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-black ${
                          isStarter ? 'bg-emerald-600/30 text-emerald-300' : 'bg-black/40 text-white/70'
                        }`}
                      >
                        {p.number}
                      </span>
                      <span className="min-w-0 flex-1 text-lg font-semibold">{p.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-2 text-sm font-bold ${
                          isStarter ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/55'
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
        </section>

        {/* Mini-Feld */}
        {startersOrdered.length > 0 && (
          <section>
            <h2 className={`mb-3 ${sectionTitle}`}>Vorschau Startelf</h2>
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/30 to-black/80 px-3 py-6">
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
                <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
              </div>
              <div className="relative flex flex-wrap justify-center gap-2">
                {startersOrdered.map((p) => (
                  <div
                    key={p.id}
                    className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-emerald-500/60 bg-emerald-600/20 text-center shadow-md"
                    title={p.name}
                  >
                    <span className="text-xs font-black text-emerald-300">{p.number}</span>
                    <span className="max-w-[52px] truncate px-0.5 text-[9px] font-bold leading-tight text-white">
                      {p.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, MAX_STARTERS - startersOrdered.length) }).map(
                  (_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/15 bg-black/30 text-xs text-white/25"
                    >
                      —
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>
        )}

        {/* Bank */}
        {bankPlayers.length > 0 && (
          <section>
            <h2 className={`mb-3 ${sectionTitle}`}>Bank</h2>
            <ul className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2">
              {bankPlayers.map((p) => (
                <li
                  key={p.id}
                  className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-2 text-white/80"
                >
                  <span className="w-8 text-center text-sm font-black text-white/45">{p.number}</span>
                  <span className="font-medium">{p.name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0f0f0f]/98 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <button
            type="button"
            disabled={!canGoLive || setupSaving}
            onClick={() => void onLiveMatch()}
            className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-lg shadow-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.99]"
          >
            {setupSaving ? 'Speichern…' : 'Live Match starten'}
          </button>
          <button
            type="button"
            disabled={setupSaving || !selectedTeamSeasonId}
            onClick={() => void onSave()}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-white/20 text-base font-semibold text-white/90 active:bg-white/5 disabled:opacity-40"
          >
            {setupSaving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default MatchSetupScreen;
