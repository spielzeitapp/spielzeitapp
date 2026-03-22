import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { Card } from '../app/components/ui/Card';

const API = '/api/notifications';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  type: string;
  created_at: string;
};

/** Interne App-Links: /termine → Spielplan */
function resolveAppPath(link: string | null | undefined): string | null {
  if (link == null || !String(link).trim()) return null;
  const p = String(link).trim();
  if (p.startsWith('/app/')) return p;
  if (p === '/termine' || p === 'termine') return '/app/schedule';
  const sub = p.startsWith('/') ? p : `/${p}`;
  return `/app${sub}`;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { selectedTeamSeason } = useSession();
  const teamId = selectedTeamSeason?.team?.id ?? null;

  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.access_token || !teamId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ team_id: String(teamId) });
      const res = await fetch(`${API}?${q.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        notifications?: NotificationRow[];
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        setItems([]);
        setError(data.error || 'Nachrichten konnten nicht geladen werden.');
        return;
      }
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      setItems([]);
      setError('Nachrichten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onItemClick = (n: NotificationRow) => {
    const target = resolveAppPath(n.link);
    if (target) navigate(target);
  };

  return (
    <div
      className="page notifications-page min-h-[60vh] w-full px-4 py-6"
      style={{
        background:
          'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[560px] space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Nachrichten</h1>

        {!teamId && (
          <p className="text-sm text-amber-200/90">Kein Team ausgewählt.</p>
        )}

        {loading && teamId && (
          <p className="text-sm text-white/60">Laden…</p>
        )}

        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && teamId && items && items.length === 0 && (
          <p className="text-sm text-white/70">Noch keine Nachrichten vorhanden.</p>
        )}

        {!loading && items && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((n) => {
              const href = resolveAppPath(n.link);
              const interactive = Boolean(href);
              return (
                <li key={n.id}>
                  <Card
                    className={`text-white transition-colors ${
                      interactive
                        ? 'cursor-pointer hover:border-white/25 hover:bg-white/[0.07]'
                        : ''
                    }`}
                    onClick={() => {
                      if (interactive) onItemClick(n);
                    }}
                    onKeyDown={(e) => {
                      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onItemClick(n);
                      }
                    }}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                  >
                    <div className="text-xs text-[var(--text-sub)]">{formatWhen(n.created_at)}</div>
                    <h2 className="mt-1 text-base font-semibold text-[var(--text-main)]">{n.title}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-sub)]">{n.message}</p>
                    {interactive && (
                      <p className="mt-2 text-xs text-[var(--primary)]">Tippen zum Öffnen</p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
