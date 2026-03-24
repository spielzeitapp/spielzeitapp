import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
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

function isTeamPushType(t: string): boolean {
  return t === 'manual_push' || t === 'team_push';
}

/** Ohne angehängten Pfad (Team-Push: URL in content oder link). */
function listBodyPreview(m: MessageRow): string {
  const rawBody = (m.body ?? '').trim();
  if (rawBody) return rawBody;
  const raw = (m.content ?? '').trim();
  if (!isTeamPushType(m.type)) return raw || (m.title ?? '').trim();
  const idx = raw.lastIndexOf('\n\n');
  if (idx === -1) return raw || (m.title ?? '').trim();
  const tail = raw.slice(idx + 2).trim();
  if (tail.startsWith('/')) return raw.slice(0, idx).trim() || (m.title ?? '').trim();
  return raw || (m.title ?? '').trim();
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
  const { user } = useAuth();
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
    } catch (e) {
      console.warn('[MessagesPage] load', e);
      setItems([]);
      setError('Nachrichten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    void supabase
      .from('messages')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(({ error }) => {
        if (error) console.warn('[MessagesPage] mark all read', error.message ?? error);
        else notifyMessagesReadChanged();
      });
  }, [user?.id]);

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

  const onDelete = useCallback(async (e: React.MouseEvent, m: MessageRow) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id || m.user_id !== user.id) return;
    const { error } = await supabase.from('messages').delete().eq('id', m.id).eq('user_id', user.id);
    if (error) {
      console.warn('[MessagesPage] delete', error.message ?? error);
      return;
    }
    setItems((prev) => (prev ? prev.filter((x) => x.id !== m.id) : prev));
    setReadSet((prev) => {
      const next = new Set(prev);
      next.delete(m.id);
      writeReadSet(next);
      return next;
    });
    notifyMessagesReadChanged();
  }, [user?.id]);

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
                    className={`transition-colors ${
                      isRead
                        ? 'text-white/80 hover:border-white/20 hover:bg-white/[0.06]'
                        : 'border border-red-500/25 bg-red-950/25 text-white hover:border-red-500/35 hover:bg-red-950/35'
                    }`}
                  >
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-pointer text-left"
                        onClick={() => onOpen(m)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') onOpen(m);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-[var(--text-sub)]">{formatWhen(m.created_at)}</div>
                          {!isRead && (
                            <div className="shrink-0 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
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
                      </button>
                      <button
                        type="button"
                        className="shrink-0 self-start rounded-lg p-2 text-white/35 transition-colors hover:bg-white/10 hover:text-red-300"
                        aria-label="Nachricht löschen"
                        onClick={(e) => void onDelete(e, m)}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
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

