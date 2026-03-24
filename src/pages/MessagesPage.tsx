import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { Card } from '../app/components/ui/Card';
import { supabase } from '../lib/supabaseClient';
import {
  countUnreadMessages,
  notifyMessagesReadChanged,
  readReadSet,
  writeReadSet,
} from '../lib/messagesReadState';

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

/** Ohne angehängten Pfad (manual_push speichert URL in content). */
function listBodyPreview(m: MessageRow): string {
  const raw = (m.body ?? m.content ?? '').trim();
  if (m.type !== 'manual_push') return raw;
  const idx = raw.lastIndexOf('\n\n');
  if (idx === -1) return raw;
  const tail = raw.slice(idx + 2).trim();
  if (tail.startsWith('/')) return raw.slice(0, idx).trim();
  return raw;
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

export const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  useSession();
  const [needsRelogin, setNeedsRelogin] = useState(false);

  const [items, setItems] = useState<MessageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [readSet, setReadSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setReadSet(readReadSet());
  }, []);

  const load = useCallback(async () => {
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
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[MessagesPage] load', error.message ?? error);
        setItems([]);
        setError('Nachrichten konnten nicht geladen werden.');
        return;
      }
      const rows = Array.isArray(data) ? (data as MessageRow[]) : [];
      setItems(rows);

      if (rows.some((m) => m.read !== true)) {
        const { error: updErr } = await supabase
          .from('messages')
          .update({ read: true })
          .eq('user_id', user.data.user.id)
          .eq('read', false);
        if (updErr) {
          console.warn('[MessagesPage] mark all read', updErr.message ?? updErr);
        } else {
          setItems(rows.map((m) => ({ ...m, read: true })));
          notifyMessagesReadChanged();
        }
      }
    } catch (e) {
      console.warn('[MessagesPage] load', e);
      setItems([]);
      setError('Nachrichten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => {
    if (!items) return 0;
    return countUnreadMessages(items, readSet);
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

        {needsRelogin && (
          <div className="text-center text-gray-400 mt-10">Bitte neu einloggen</div>
        )}
        {loading && <p className="text-sm text-white/60">Laden…</p>}
        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && items && items.length === 0 && (
          <div className="text-center text-gray-400 mt-10">Noch keine Nachrichten vorhanden</div>
        )}

        {!loading && items && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((m) => {
              const isRead = m.read === true || readSet.has(m.id);
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
                    <p className={`mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-gray-300 ${isRead ? '' : 'text-red-100'}`}>
                      {listBodyPreview(m)}
                    </p>
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

