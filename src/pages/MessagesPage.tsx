import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { Card } from '../app/components/ui/Card';
import { supabase } from '../lib/supabaseClient';

type MessageRow = {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  content: string | null;
  type: string;
  event_id: string | null;
  created_at: string;
  read: boolean;
};

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

const READ_STORAGE_KEY = 'spz_read_messages';

function readReadSet(): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeReadSet(set: Set<string>): void {
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedTeamSeason } = useSession();
  const teamId = selectedTeamSeason?.team?.id ?? null;
  const [needsRelogin, setNeedsRelogin] = useState(false);

  const [items, setItems] = useState<MessageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [readSet, setReadSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setReadSet(readReadSet());
  }, []);

  const load = useCallback(async () => {
    if (!teamId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        setNeedsRelogin(true);
        setItems([]);
        setLoading(false);
        return;
      }
      setNeedsRelogin(false);

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', user.data.user.id)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) {
        setItems([]);
        setError(error.message || 'Nachrichten konnten nicht geladen werden.');
        return;
      }
      setItems(Array.isArray(data) ? (data as MessageRow[]) : []);
    } catch {
      setItems([]);
      setError('Nachrichten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => {
    if (!items) return 0;
    let c = 0;
    for (const m of items) {
      if (!readSet.has(m.id)) c += 1;
    }
    return c;
  }, [items, readSet]);

  const onOpen = (m: MessageRow) => {
    const next = new Set(readSet);
    next.add(m.id);
    setReadSet(next);
    writeReadSet(next);
    navigate(`/app/nachrichten/${m.id}`);
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Nachrichten</h1>
            <p className="text-sm text-white/60">Neueste zuerst</p>
          </div>
          {unreadCount > 0 && (
            <div className="rounded-full bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-200">
              {unreadCount} neu
            </div>
          )}
        </div>

        {!teamId && <p className="text-sm text-amber-200/90">Kein Team ausgewählt.</p>}
        {needsRelogin && (
          <div className="text-center text-gray-400 mt-10">Bitte neu einloggen</div>
        )}
        {loading && teamId && <p className="text-sm text-white/60">Laden…</p>}
        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && teamId && items && items.length === 0 && (
          <div className="text-center text-gray-400 mt-10">Noch keine Nachrichten vorhanden</div>
        )}

        {!loading && items && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((m) => {
              const isRead = readSet.has(m.id);
              return (
                <li key={m.id}>
                  <Card
                    className={`cursor-pointer transition-colors ${
                      isRead
                        ? 'text-white/80 hover:border-white/20 hover:bg-white/[0.06]'
                        : 'border border-red-500/25 bg-red-950/25 text-white hover:border-red-500/35 hover:bg-red-950/35'
                    }`}
                    onClick={() => onOpen(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onOpen(m);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-[var(--text-sub)]">{formatWhen(m.created_at)}</div>
                      {!isRead && (
                        <div className="rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Neu
                        </div>
                      )}
                    </div>
                    <h2 className={`mt-1 font-semibold ${isRead ? 'text-white/90' : 'text-white'}`}>
                      {m.title}
                    </h2>
                    <p className={`mt-2 whitespace-pre-wrap text-sm text-gray-300 ${isRead ? '' : 'text-red-100'}`}>
                      {m.body ?? m.content ?? ''}
                    </p>
                    <div className="mt-2 text-xs text-gray-500">{formatWhen(m.created_at)}</div>
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

