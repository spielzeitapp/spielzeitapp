import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

type LiveMatchRow = {
  id: string;
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
  const [noLiveMatch, setNoLiveMatch] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setNoLiveMatch(false);

      const { data, error } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'live')
        .order('match_date', { ascending: false })
        .limit(1)
        .single<LiveMatchRow>();

      if (cancelled) return;

      if (error) {
        // PGRST116 = no rows
        if ((error as any).code === 'PGRST116') {
          setNoLiveMatch(true);
        } else {
          setError('Fehler beim Laden des Live-Spiels.');
        }
        setLoading(false);
        return;
      }

      if (data?.id) {
        navigate(`/app/match/${data.id}`, { replace: true });
        return;
      }

      // Fallback: kein Live-Match gefunden
      setNoLiveMatch(true);
      setLoading(false);
    };

    load().catch(() => {
      if (cancelled) return;
      setError('Fehler beim Laden des Live-Spiels.');
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
        <Link to="/app/schedule" className="btn btn-primary btn--sm inline-block mt-2">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  if (noLiveMatch) {
    return (
      <div className="page space-y-4 pb-4">
        <h1 className="headline">Kein Live-Spiel aktiv</h1>
        <p className="text-sm text-[var(--text-sub)]">
          Starte ein Match im Spielplan oder im Match-Detail.
        </p>
        <Link to="/app/schedule" className="btn btn-primary btn--sm inline-block mt-2">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  // Fallback – sollte praktisch nie erreicht werden
  return (
    <div className="page space-y-4 pb-4">
      <h1 className="headline">Live</h1>
      <p className="text-sm text-[var(--text-sub)]">
        Es konnte kein Live-Spiel gefunden werden.
      </p>
      <Link to="/app/schedule" className="btn btn-primary btn--sm inline-block mt-2">
        Zum Spielplan
      </Link>
    </div>
  );
};

