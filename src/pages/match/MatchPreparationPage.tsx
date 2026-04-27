import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import { useMatchAvailability } from '../../hooks/useMatchAvailability';
import { supabase } from '../../lib/supabaseClient';

type MatchRowLite = {
  id: string;
  team_season_id: string;
  opponent: string | null;
};

type PrepStatus = 'available' | 'open' | 'absent';

function playerStatusFromAvailability(value: 'yes' | 'no' | null): PrepStatus {
  if (value === 'yes') return 'available';
  if (value === 'no') return 'absent';
  return 'open';
}

function statusBadge(status: PrepStatus): React.ReactNode {
  if (status === 'open') {
    return <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">? Offen</span>;
  }
  if (status === 'available') {
    return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">✓ Dabei</span>;
  }
  return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300">✖ Abgesagt</span>;
}

export const MatchPreparationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('matchId')?.trim() || null;
  const [matchRow, setMatchRow] = useState<MatchRowLite | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

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
  const { getAvailability, loading: availLoading, error: availError } = useMatchAvailability(matchId);

  const grouped = useMemo(() => {
    const sorted = [...players].sort(
      (a, b) => (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) || a.display_name.localeCompare(b.display_name, 'de'),
    );
    const available: typeof sorted = [];
    const open: typeof sorted = [];
    const absent: typeof sorted = [];
    for (const p of sorted) {
      const st = playerStatusFromAvailability(getAvailability(p.id));
      if (st === 'available') available.push(p);
      else if (st === 'open') open.push(p);
      else absent.push(p);
    }
    return { available, open, absent };
  }, [players, getAvailability]);

  const togglePlayer = (playerId: string, status: PrepStatus) => {
    if (status === 'absent') return;
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      return [...prev, playerId];
    });
  };

  const selectedSet = useMemo(() => new Set(selectedPlayers), [selectedPlayers]);

  const renderSection = (title: string, list: typeof players, status: PrepStatus) => (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">{title}</h2>
      {list.length === 0 ? <p className="text-sm text-white/45">Keine Spieler</p> : null}
      <div className="space-y-2">
        {list.map((p) => {
          const selected = selectedSet.has(p.id);
          const disabled = status === 'absent';
          const shell =
            status === 'available'
              ? 'border-emerald-600/45 bg-emerald-950/30'
              : status === 'open'
                ? 'border-amber-500/45 bg-amber-950/25'
                : 'border-red-700/45 bg-red-950/25 opacity-60';
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => togglePlayer(p.id, status)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${shell} ${
                selected ? 'ring-2 ring-red-500/60' : ''
              } ${disabled ? 'cursor-not-allowed' : 'hover:bg-white/[0.04]'}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{p.jersey_number ?? '–'}</p>
                <p className="truncate text-sm text-white">{p.display_name || 'Spieler'}</p>
              </div>
              <div className="flex items-center gap-2">
                {selected ? <span className="text-emerald-300">✓</span> : null}
                {statusBadge(status)}
              </div>
            </button>
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

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] pb-32 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">SpielzeitApp</p>
            <h1 className="text-lg font-bold">Match Vorbereitung</h1>
            <p className="text-sm text-white/60">{matchRow?.opponent ? `vs. ${matchRow.opponent}` : 'Spiel'}</p>
          </div>
          <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
            Trainer
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-4">
        {(playersLoading || availLoading) && <p className="text-sm text-white/55">Lade Spieler und Status…</p>}
        {(playersError || availError) && <p className="text-sm text-red-400">{playersError ?? availError}</p>}

        {renderSection('Verfügbar', grouped.available, 'available')}
        {renderSection('Offen', grouped.open, 'open')}
        {renderSection('Abgesagt', grouped.absent, 'absent')}

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Matchkader</h2>
          {selectedPlayers.length === 0 ? (
            <p className="text-sm text-white/45">Noch keine Spieler ausgewählt.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedPlayers.map((id) => {
                const p = players.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="rounded-full border border-red-500/35 bg-red-950/35 px-3 py-1 text-xs font-semibold text-red-200"
                  >
                    {p?.jersey_number ?? '–'} {p?.display_name ?? id}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <span className="text-xs text-white/60">{selectedPlayers.length} ausgewählt</span>
          <button
            type="button"
            disabled={selectedPlayers.length === 0}
            onClick={() =>
              navigate(`/app/aufstellung?matchId=${encodeURIComponent(matchId)}`, {
                state: { selectedPlayers },
              })
            }
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Weiter zur Aufstellung
          </button>
        </div>
      </div>
    </div>
  );
};
