import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { Card, CardTitle } from '../app/components/ui/Card';
import { Button } from '../app/components/ui/Button';

const API = '/api/messages';

type MessageRow = {
  id: string;
  team_id: string;
  title: string;
  content: string;
  type: string;
  related_event_id: string | null;
  created_at: string;
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

export const MessageDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { messageId } = useParams();
  const { session } = useAuth();
  const { selectedTeamSeason } = useSession();
  const teamId = selectedTeamSeason?.team?.id ?? null;

  const [item, setItem] = useState<MessageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const safeMessageId = useMemo(() => (typeof messageId === 'string' ? messageId : ''), [messageId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!safeMessageId || !teamId || !session?.access_token) {
        setError('Nachricht konnte nicht geladen werden.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ team_id: String(teamId), id: safeMessageId });
        const res = await fetch(`${API}?${q.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = (await res.json()) as { ok?: boolean; message?: MessageRow | null; error?: string };
        if (!res.ok || data.ok === false) {
          setError(data.error || 'Nachricht konnte nicht geladen werden.');
          setItem(null);
          return;
        }
        setItem(data.message ?? null);
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
  }, [safeMessageId, session?.access_token, teamId]);

  useEffect(() => {
    if (!item?.id) return;
    const set = readReadSet();
    if (set.has(item.id)) return;
    set.add(item.id);
    writeReadSet(set);
  }, [item?.id]);

  const onZumTermin = () => {
    if (!item?.related_event_id) return;
    navigate(`/app/events/${item.related_event_id}`);
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
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-sub)]">{item.content}</p>

                {item.related_event_id && (
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

