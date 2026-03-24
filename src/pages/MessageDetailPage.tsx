import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { readReadSet, writeReadSet } from '../lib/messagesReadState';

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

export const MessageDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { messageId } = useParams();
  const { selectedTeamSeason } = useSession();
  const teamId = selectedTeamSeason?.team?.id ?? null;

  const [item, setItem] = useState<MessageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safeMessageId = useMemo(() => (typeof messageId === 'string' ? messageId : ''), [messageId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!safeMessageId || !teamId) {
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
          .eq('team_id', teamId)
          .eq('user_id', uid)
          .maybeSingle();
        if (error) {
          setError(error.message || 'Nachricht konnte nicht geladen werden.');
          setItem(null);
          return;
        }
        setItem((data as MessageRow | null) ?? null);
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
  }, [safeMessageId, teamId]);

  useEffect(() => {
    if (!item?.id) return;
    const set = readReadSet();
    if (set.has(item.id)) return;
    set.add(item.id);
    writeReadSet(set);
  }, [item?.id]);

  const onZumTermin = () => {
    if (!item?.event_id) return;
    navigate(`/app/events/${item.event_id}`);
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

        {loading && <p className="text-sm text-white/60">Laden…</p>}
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
                <div className="text-xs text-[var(--text-sub)]">{formatWhen(item.created_at)}</div>
                <CardTitle className="text-base mt-1">{item.title}</CardTitle>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-sub)]">{item.body ?? item.content ?? ''}</p>

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

