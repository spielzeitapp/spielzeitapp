import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../app/components/ui/Card';
import { useNotificationsInboxRealtime } from '../hooks/useNotificationsInboxRealtime';
import { formatDateTimeMediumDeVienna } from '../lib/notifications/format';
import {
  fetchTeamIdsForUser,
  notificationsInboxOrFilter,
} from '../lib/notifications/inboxScope';
import { supabase } from '../lib/supabaseClient';
import { notifyNotificationsReadChanged } from '../lib/notificationsReadState';

type NotificationRow = {
  id: string;
  user_id: string | null;
  team_id?: string | null;
  event_id: string | null;
  title: string;
  message: string;
  link: string | null;
  type?: string | null;
  read: boolean;
  created_at: string;
};

/** Interne App-Links: /termine → Spielplan */
function resolveAppPath(link: string | null | undefined): string | null {
  if (link == null || !String(link).trim()) return null;
  const p = String(link).trim();
  if (p.startsWith('/app/')) return p;
  if (p === '/termine' || p === 'termine') return '/app/termine';
  const sub = p.startsWith('/') ? p : `/${p}`;
  return `/app${sub}`;
}

function formatWhen(iso: string): string {
  return formatDateTimeMediumDeVienna(iso);
}

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const teamIds = await fetchTeamIdsForUser(supabase, uid);
      const inboxOr = notificationsInboxOrFilter(uid, teamIds);
      const { data, error: qErr } = await supabase
        .from('notifications')
        .select('id, user_id, team_id, event_id, title, message, link, type, read, created_at')
        .or(inboxOr)
        .order('created_at', { ascending: false });

      if (qErr) {
        setItems([]);
        setError(qErr.message || 'Benachrichtigungen konnten nicht geladen werden.');
        return;
      }
      setItems(Array.isArray(data) ? (data as NotificationRow[]) : []);
    } catch {
      setItems([]);
      setError('Benachrichtigungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useNotificationsInboxRealtime(userId, load, 'list');

  const unreadCount = useMemo(
    () => (items ?? []).filter((n) => n.read !== true).length,
    [items],
  );

  const onMarkAllRead = async () => {
    if (!userId || unreadCount <= 0) return;
    const { error: updErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (!updErr) {
      setItems((prev) => (prev ?? []).map((x) => ({ ...x, read: true })));
      notifyNotificationsReadChanged();
    }
  };

  const onItemClick = async (n: NotificationRow) => {
    if (!userId) return;
    if (n.read !== true) {
      const { error: updErr } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', n.id)
        .eq('read', false);
      if (!updErr) {
        setItems((prev) =>
          (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)),
        );
        notifyNotificationsReadChanged();
      }
    }

    if (n.event_id) {
      navigate(`/app/events/${n.event_id}`);
      return;
    }
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Benachrichtigungen</h1>
            {unreadCount > 0 ? (
              <p className="mt-1 text-xs text-red-200">{unreadCount > 99 ? '99+' : unreadCount} ungelesen</p>
            ) : (
              <p className="mt-1 text-xs text-white/60">Alles gelesen</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              disabled={unreadCount <= 0}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white/10"
            >
              Alle als gelesen
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-white/60">Laden…</p>
        )}

        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && items && items.length === 0 && (
          <p className="text-sm text-white/70">Noch keine Benachrichtigungen vorhanden.</p>
        )}

        {!loading && items && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((n) => {
              const interactive = Boolean(n.event_id || resolveAppPath(n.link));
              const isUnread = n.read !== true;
              return (
                <li key={n.id}>
                  <Card
                    className={`text-white transition-colors ${
                      isUnread ? 'border-red-500/30 bg-red-950/25' : ''
                    } ${
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-[var(--text-sub)]">{formatWhen(n.created_at)}</div>
                      {isUnread && (
                        <div className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Neu
                        </div>
                      )}
                    </div>
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
