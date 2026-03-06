import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../types/match';
import { listMatches } from '../services/matchService';

export const HomePage: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listMatches();
        if (!cancelled) {
          setMatches(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Fehler beim Laden der Spiele');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page home-page space-y-4 pb-4">
      <section>
        <h1 className="headline mb-1">Spiele</h1>
        <p className="subline">Übersicht der anstehenden und vergangenen Matches</p>
      </section>

      {loading && <p className="text-sm text-[var(--text-sub)]">Lade Spiele...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && matches.length === 0 && (
        <p className="text-sm text-[var(--text-sub)]">Keine Spiele vorhanden.</p>
      )}

      <section className="matchCarousel">
        {matches
          .slice()
          .sort(
            (a, b) =>
              new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime(),
          )
          .map((match) => {
          const kickoff = new Date(match.kickoffISO);
          const dateStr = kickoff.toLocaleDateString(undefined, { dateStyle: 'medium' });
          const timeStr = kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

          return (
            <div className="matchCarouselItem" key={match.id}>
              <Link
                to={`/match/${match.id}`}
                className="block matchcard transition-transform hover:translate-y-0.5 active:scale-[0.99]"
              >
                <div className="matchgrid">
                  <div className="matchmeta matchmeta--team">
                    <p className="text-sm font-medium text-[var(--text-main)]">
                      {match.home.shortName ?? match.home.name}
                    </p>
                    <span className="matchcard__score">{match.score.home}</span>
                  </div>
                  <div className="matchmeta">
                    <span className="matchcard__time">{timeStr}</span>
                    <p className="text-xs text-[var(--text-sub)] mt-0.5">{dateStr}</p>
                    <p className="text-xs text-[var(--text-sub)] mt-0.5">{match.status}</p>
                  </div>
                  <div className="matchmeta matchmeta--opponent">
                    <p className="text-sm font-medium text-[var(--text-main)]">
                      {match.away.shortName ?? match.away.name}
                    </p>
                    <span className="matchcard__score">{match.score.away}</span>
                  </div>
                </div>
              </Link>
            </div>
          );
          })}
      </section>
    </div>
  );
};
