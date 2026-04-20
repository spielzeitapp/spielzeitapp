import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

type LiveMatchRow = {
  id: string;
  opponent: string | null;
  match_date: string | null;
};

/**
 * /live als Shortcut:
 * - Sucht beim Mount das aktuell laufende Match (status = 'live').
 * - Wenn gefunden → sofort Redirect auf /match/:id.
 * - Wenn keins gefunden → Hinweis + Link zum Spielplan.
 * - Keine eigene Live-Logik/UI mehr hier.
 */
export const LivePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveMatchRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setLiveMatches([]);

      const { data, error } = await supabase
        .from('matches')
        .select('id, opponent, match_date')
        .eq('status', 'live')
        .order('match_date', { ascending: false })
        .returns<LiveMatchRow[]>();

      if (cancelled) return;

      if (error) {
        setError('Fehler beim Laden der Live-Spiele.');
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      setLiveMatches(rows);

      if (rows.length === 1 && rows[0]?.id) {
        navigate(`/app/match/${rows[0].id}`, { replace: true });
        return;
      }
      setLoading(false);
    };

    load().catch(() => {
      if (cancelled) return;
      setError('Fehler beim Laden der Live-Spiele.');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="page space-y-4 pb-4">
        <h1 className="headline">Live</h1>
        <p className="text-sm text-[var(--text-sub)]">Lade Live-Status…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page space-y-4 pb-4">
        <h1 className="headline">Live</h1>
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/app/termine" className="btn btn-primary btn--sm inline-block mt-2">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  if (liveMatches.length === 0) {
    return (
      <div className="page space-y-4 pb-4">
        <h1 className="headline">Aktuell kein Livespiel</h1>
        <p className="text-sm text-[var(--text-sub)]">
          Sobald ein Spiel auf LIVE steht, erscheint es hier.
        </p>
        <Link to="/app/termine" className="btn btn-primary btn--sm inline-block mt-2">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  return (
    <div className="page space-y-4 pb-4">
      <h1 className="headline">Live</h1>
      <p className="text-sm text-[var(--text-sub)]">Mehrere Livespiele aktiv – wähle ein Spiel aus.</p>
      <div className="space-y-3">
        {liveMatches.map((m) => (
          <div key={m.id} className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
            <p className="text-sm font-semibold text-[var(--text-main)]">{m.opponent?.trim() || 'Gegner'}</p>
            <p className="text-xs text-[var(--text-sub)]">{m.match_date ? new Date(m.match_date).toLocaleString('de-AT') : '—'}</p>
            <Link to={`/app/match/${m.id}`} className="btn btn-primary btn--sm inline-block mt-3">
              Zum Livespiel
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

