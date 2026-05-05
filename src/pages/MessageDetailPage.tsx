import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { notifyMessagesReadChanged, readReadSet, writeReadSet } from '../lib/messagesReadState';
import { formatDateTimeMediumDeVienna } from '../lib/notifications/format';

type MessageRow = {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  content: string | null;
  type: string;
  event_id: string | null;
  link?: string | null;
  created_at: string;
  read: boolean;
};

function extractAppPathFromContent(content: string | null): string | null {
  if (!content) return null;
  const parts = content.trim().split(/\n\n+/);
  const last = parts[parts.length - 1]?.trim();
  if (last?.startsWith('/')) return last;
  return null;
}

function toAppHref(path: string): string {
  const p = path.trim();
  if (!p.startsWith('/')) return '/app/termine';
  if (p.startsWith('/app/')) return p;
  return `/app${p}`;
}

function isTeamPushType(t: string): boolean {
  return t === 'manual_push' || t === 'team_push';
}

function bodyWithoutAppendedPath(
  body: string | null,
  content: string | null,
  type: string,
  title: string,
): string {
  const rawBody = (body ?? '').trim();
  if (!isTeamPushType(type)) return rawBody || (content ?? '').trim() || title.trim();
  if (rawBody) return rawBody;
  const raw = (content ?? '').trim();
  const idx = raw.lastIndexOf('\n\n');
  if (idx === -1) return raw || title.trim();
  const tail = raw.slice(idx + 2).trim();
  if (tail.startsWith('/')) return raw.slice(0, idx).trim() || title.trim();
  return raw || title.trim();
}

function formatWhen(iso: string): string {
  return formatDateTimeMediumDeVienna(iso);
}

export const MessageDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { messageId } = useParams();

  const [item, setItem] = useState<MessageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safeMessageId = useMemo(() => (typeof messageId === 'string' ? messageId : ''), [messageId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!safeMessageId) {
        setError('Nachricht konnte nicht geladen werden.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const user = await supabase.auth.getUser();
        const uid = user.data.user?.id;
        if (!uid) {
          setError('Bitte neu einloggen');
          setItem(null);
          return;
        }
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('id', safeMessageId)
          .eq('user_id', uid)
          .maybeSingle();
        if (error) {
          console.warn('[MessageDetailPage]', error.message ?? error);
          setError('Nachricht konnte nicht geladen werden.');
          setItem(null);
          return;
        }
        const row = (data as MessageRow | null) ?? null;
        setItem(row);
        if (row && row.read !== true) {
          const { error: uErr } = await supabase
            .from('messages')
            .update({ read: true })
            .eq('id', safeMessageId)
            .eq('user_id', uid)
            .eq('read', false);
          if (uErr) {
            console.warn('[MessageDetailPage] mark read', uErr.message ?? uErr);
          } else {
            setItem({ ...row, read: true });
            const rs = readReadSet();
            rs.add(safeMessageId);
            writeReadSet(rs);
            notifyMessagesReadChanged();
          }
        }
      } catch {
        setError('Nachricht konnte nicht geladen werden.');
        setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [safeMessageId]);

  const onZumTermin = () => {
    if (!item?.event_id) return;
    navigate(`/app/events/${item.event_id}`);
  };

  const manualLink =
    item && isTeamPushType(item.type)
      ? (item.link?.trim() ||
          extractAppPathFromContent(item.content ?? item.body))
      : null;

  const onOpenInApp = () => {
    if (!manualLink) return;
    navigate(toAppHref(manualLink));
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
        <button
          type="button"
          onClick={() => navigate('/app/nachrichten')}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          ← Zurück
        </button>

        {loading && <p className="text-[14px] text-white/60">Laden…</p>}
        {error && (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && !item && <p className="text-sm text-white/70">Nachricht nicht gefunden.</p>}

        {!loading && !error && item && (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Nachricht</h1>
            <Card className="border-white/10 bg-white/5 text-white">
              <div className="px-4 py-3">
                <div className="text-[12px] text-white/60">{formatWhen(item.created_at)}</div>
                <CardTitle className="text-[16px] font-semibold text-white mt-1">{item.title}</CardTitle>
                <p className="mt-2 whitespace-pre-wrap text-[14px] text-white/75">
                  {bodyWithoutAppendedPath(item.body, item.content, item.type, item.title)}
                </p>

                {manualLink && (
                  <div className="mt-4">
                    <Button type="button" onClick={onOpenInApp} fullWidth>
                      In der App öffnen
                    </Button>
                  </div>
                )}

                {item.event_id && (
                  <div className="mt-4 space-y-2">
                    <Button type="button" onClick={onZumTermin} fullWidth>
                      Zum Termin
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onZumTermin}
                      fullWidth
                      className="!border-white/10"
                    >
                      Zusagen / Absagen
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

