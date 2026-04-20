import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LiveMatchScreen } from './live/LiveMatchScreen';

type LiveMatchRow = {
  id: string;
  opponent: string | null;
  match_date: string | null;
};

/**
 * Haupt-Liveticker unter /app/live: roter LiveMatchScreen für alle Rollen (Trainer vs. Zuschauer nur Berechtigung).
 * Ohne ?matchId: bei genau einem live-Match wird derselbe Screen genutzt (intern erste Live-Zeile); bei mehreren zuerst Auswahl.
 */
export const LivePage: React.FC = () => {
  const { id: idFromRoute } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const matchIdParam =
    searchParams.get('matchId')?.trim() || idFromRoute?.trim() || null;

  const [loading, setLoading] = useState(!matchIdParam);
  const [error, setError] = useState<string | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveMatchRow[] | null>(null);

  useEffect(() => {
    if (matchIdParam) {
      setLoading(false);
      setLiveMatches(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('matches')
        .select('id, opponent, match_date')
        .eq('status', 'live')
        .order('match_date', { ascending: false })
        .returns<LiveMatchRow[]>();

      if (cancelled) return;
      if (err) {
        setError('Fehler beim Laden der Live-Spiele.');
        setLiveMatches([]);
        setLoading(false);
        return;
      }
      setLiveMatches(data ?? []);
      setLoading(false);
    })().catch(() => {
      if (cancelled) return;
      setError('Fehler beim Laden der Live-Spiele.');
      setLiveMatches([]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matchIdParam]);

  if (matchIdParam) {
    return <LiveMatchScreen />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] text-white">
        <p className="text-sm text-white/60">Lade Live-Status…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0a] p-4 text-white">
        <p className="text-sm text-red-400">{error}</p>
        <Link to="/app/termine" className="mt-4 inline-block text-sm font-semibold text-red-400 underline">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  const rows = liveMatches ?? [];
  if (rows.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0a] p-4 text-white">
        <h1 className="text-lg font-bold text-white">Live</h1>
        <p className="mt-3 text-sm text-white/65">Aktuell kein Livespiel.</p>
        <p className="mt-1 text-sm text-white/45">Sobald ein Spiel auf LIVE steht, erscheint der Liveticker hier.</p>
        <Link
          to="/app/termine"
          className="mt-5 inline-block rounded-xl border border-red-500/40 bg-red-950/35 px-4 py-2.5 text-sm font-semibold text-red-200"
        >
          Zum Spielplan
        </Link>
      </div>
    );
  }

  if (rows.length === 1) {
    return <LiveMatchScreen />;
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] p-4 text-white">
      <h1 className="text-lg font-bold text-white">Live</h1>
      <p className="mt-2 text-sm text-white/60">Mehrere Livespiele aktiv – wähle ein Spiel aus.</p>
      <div className="mt-4 space-y-3">
        {rows.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-red-500/25 bg-zinc-950/90 p-4 shadow-[0_6px_28px_rgba(0,0,0,0.35)]"
          >
            <p className="text-sm font-semibold text-white">{m.opponent?.trim() || 'Gegner'}</p>
            <p className="text-xs text-white/45">
              {m.match_date ? new Date(m.match_date).toLocaleString('de-AT') : '—'}
            </p>
            <Link
              to={`/app/live?matchId=${encodeURIComponent(m.id)}`}
              className="mt-3 inline-block rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500"
            >
              Zum Liveticker
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

