import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../app/components/ui/Card';
import { useNotificationsInboxRealtime } from '../hooks/useNotificationsInboxRealtime';
import { formatRelativeNotificationTime } from '../lib/notifications/format';
import { supabase } from '../lib/supabaseClient';
import { notifyNotificationsReadChanged } from '../lib/notificationsReadState';

type NotificationRow = {
  id: string;
  team_id: string | null;
  title: string;
  message: string;
  link: string | null;
  type?: string | null;
  event_type?: string | null;
  event_id?: string | null;
  created_at: string;
  read: boolean;
};

/** Event-UUID aus Link /app/events/… */
function extractEventIdFromLink(link: string | null | undefined): string | null {
  if (link == null || !String(link).trim()) return null;
  const p = String(link).trim();
  const idx = p.indexOf('/app/events/');
  if (idx === -1) return null;
  const rest = p.slice(idx + '/app/events/'.length).split(/[?#/]/)[0]?.trim() ?? '';
  return /^[0-9a-f-]{36}$/i.test(rest) ? rest : null;
}

/** Match-UUID aus Link /app/match/… */
function extractMatchIdFromLink(link: string | null | undefined): string | null {
  if (link == null || !String(link).trim()) return null;
  const p = String(link).trim();
  const idx = p.indexOf('/app/match/');
  if (idx === -1) return null;
  const rest = p.slice(idx + '/app/match/'.length).split(/[?#/]/)[0]?.trim() ?? '';
  return /^[0-9a-f-]{36}$/i.test(rest) ? rest : null;
}

function resolveAppPath(link: string | null | undefined): string | null {
  if (link == null || !String(link).trim()) return null;
  const p = String(link).trim();
  if (p.startsWith('/app/')) return p;
  if (p === '/termine' || p === 'termine') return '/app/termine';
  const sub = p.startsWith('/') ? p : `/${p}`;
  return `/app${sub}`;
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
      const { data, error: qErr } = await supabase
        .from('notifications')
        .select('id, team_id, title, message, link, type, event_type, event_id, created_at, read')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (qErr) {
        setItems([]);
        setError(qErr.message || 'Benachrichtigungen konnten nicht geladen werden.');
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setItems(
        rows.map((r) => ({
          ...(r as NotificationRow),
          read: (r as { read?: boolean | null }).read === true,
        })),
      );
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
    if (!userId || unreadCount <= 0 || !items?.length) return;
    const unreadIds = items.filter((n) => n.read !== true).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const { error: updErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .in('id', unreadIds);
    if (!updErr) {
      setItems((prev) => (prev ?? []).map((x) => ({ ...x, read: true })));
      notifyNotificationsReadChanged();
    }
  };

  const onDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!userId) return;
    const { error: delErr } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
    if (!delErr) {
      setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
      notifyNotificationsReadChanged();
    }
  };

  const openNotificationTarget = (n: NotificationRow) => {
    const fromLink = resolveAppPath(n.link);
    if (fromLink) {
      navigate(fromLink);
      return;
    }
    if (n.event_id) {
      navigate(`/app/events/${n.event_id}`);
      return;
    }
    const evFromMsg = extractEventIdFromLink(n.link);
    if (evFromMsg) {
      navigate(`/app/events/${evFromMsg}`);
      return;
    }
    const mtFromMsg = extractMatchIdFromLink(n.link);
    if (mtFromMsg) {
      navigate(`/app/match/${mtFromMsg}`);
      return;
    }
    navigate('/app/termine');
  };

  const onItemClick = async (n: NotificationRow) => {
    if (!userId) return;
    if (n.read !== true) {
      const { error: updErr } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', n.id)
        .eq('user_id', userId);
      if (!updErr) {
        setItems((prev) =>
          (prev ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)),
        );
        notifyNotificationsReadChanged();
      }
    }
    openNotificationTarget(n);
  };

  const canOpen = (n: NotificationRow) =>
    Boolean(
      resolveAppPath(n.link) ||
        n.event_id ||
        extractEventIdFromLink(n.link) ||
        extractMatchIdFromLink(n.link),
    );

  return (
    <div
      className="page notifications-page min-h-[60vh] w-full px-4 py-8 sm:px-5"
      style={{
        background:
          'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[560px] space-y-5">
        <div className="flex items-start justify-between gap-3 px-0.5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Nachrichten</h1>
            {unreadCount > 0 ? (
              <p className="mt-1.5 text-xs text-red-200/90">{unreadCount > 99 ? '99+' : unreadCount} ungelesen</p>
            ) : (
              <p className="mt-1.5 text-xs text-white/50">Alles gelesen</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 && (
              <div className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              disabled={unreadCount <= 0}
              className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/90 disabled:cursor-not-allowed disabled:opacity-45 hover:bg-white/10"
            >
              Alle gelesen
            </button>
          </div>
        </div>

        {loading && <p className="px-0.5 text-sm text-white/55">Laden…</p>}

        {error && (
          <p className="px-0.5 text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && items && items.length === 0 && (
          <p className="px-0.5 text-sm text-white/65">Noch keine Nachrichten.</p>
        )}

        {!loading && items && items.length > 0 && (
          <ul className="flex flex-col gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {items.map((n) => {
              const interactive = canOpen(n);
              const isUnread = n.read !== true;
              return (
                <li key={n.id}>
                  <Card
                    className={[
                      'border px-4 py-3.5 text-white backdrop-blur-sm transition-all duration-200',
                      isUnread
                        ? 'border-red-500/35 bg-red-950/30 shadow-[0_0_24px_rgba(239,68,68,0.08)]'
                        : 'border-white/[0.08] bg-white/[0.04] opacity-[0.92]',
                      interactive ? 'cursor-pointer active:scale-[0.99]' : '',
                      interactive ? 'hover:border-white/20 hover:bg-white/[0.06]' : '',
                    ].join(' ')}
                    onClick={() => {
                      if (interactive) void onItemClick(n);
                    }}
                    onKeyDown={(e) => {
                      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        void onItemClick(n);
                      }
                    }}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[15px] font-semibold leading-snug tracking-tight text-white">{n.title}</h2>
                        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/68">
                          {n.message}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <time
                          className="text-[11px] tabular-nums text-white/45"
                          dateTime={n.created_at}
                        >
                          {formatRelativeNotificationTime(n.created_at)}
                        </time>
                        {isUnread && (
                          <span className="rounded-md bg-red-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                            Neu
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-white/[0.06] pt-2.5">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-white/40 transition-colors hover:text-white/70"
                        onClick={(e) => void onDelete(e, n.id)}
                        aria-label="Nachricht löschen"
                      >
                        Löschen
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
