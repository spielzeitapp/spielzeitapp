'use client';

import React, { useState } from 'react';
import { Button } from '../app/components/ui/Button';
import { useAuth } from '../auth/AuthProvider';

const API = '/api/push/send-team';

type Props = {
  teamSeasonId: string | null;
};

export const PushTeamSendPanel: React.FC<Props> = ({ teamSeasonId }) => {
  const { session } = useAuth();
  const [recipientGroup, setRecipientGroup] = useState<'parents' | 'players' | 'all'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/termine');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const disabled = !teamSeasonId || !session?.access_token;

  const onSend = async () => {
    if (!teamSeasonId || !session?.access_token) return;
    if (!title.trim() || !body.trim()) {
      setMessage('Bitte Titel und Text ausfüllen.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      let path = url.trim() || '/termine';
      if (!path.startsWith('/')) path = `/${path}`;
      const res = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_season_id: teamSeasonId,
          recipient_group: recipientGroup,
          title: title.trim(),
          body: body.trim(),
          url: path,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        totalRecipients?: number;
        sent?: number;
        failed?: number;
        error?: string;
      };
      if (data.ok) {
        setMessage(
          `Push gesendet: ${data.sent ?? 0} ok, ${data.failed ?? 0} fehlgeschlagen (Ziele: ${data.totalRecipients ?? 0})`,
        );
      } else {
        setMessage(data.error || 'Senden fehlgeschlagen.');
      }
    } catch {
      setMessage('Netzwerkfehler.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <h2 className="text-base font-semibold text-[var(--text-main)]">Team-Push</h2>
      <p className="mt-1 text-xs text-[var(--text-sub)]">
        Push an Eltern und/oder Spieler des aktuellen Teams (nur Trainer/Admin).
      </p>

      <label className="mt-3 block text-xs font-medium text-[var(--text-sub)]" htmlFor="push-recipient">
        Empfänger
      </label>
      <select
        id="push-recipient"
        value={recipientGroup}
        onChange={(e) =>
          setRecipientGroup(e.target.value as 'parents' | 'players' | 'all')
        }
        disabled={disabled || loading}
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
      >
        <option value="parents">Eltern</option>
        <option value="players">Spieler</option>
        <option value="all">Alle</option>
      </select>

      <label className="mt-3 block text-xs font-medium text-[var(--text-sub)]" htmlFor="push-title">
        Titel
      </label>
      <input
        id="push-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={disabled || loading}
        placeholder="Kurzer Titel"
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
      />

      <label className="mt-3 block text-xs font-medium text-[var(--text-sub)]" htmlFor="push-body">
        Text
      </label>
      <textarea
        id="push-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={disabled || loading}
        rows={3}
        placeholder="Nachrichtentext"
        className="mt-1 w-full resize-y rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
      />

      <label className="mt-3 block text-xs font-medium text-[var(--text-sub)]" htmlFor="push-url">
        Link (Pfad in der App)
      </label>
      <input
        id="push-url"
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={disabled || loading}
        placeholder="/termine"
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
      />

      {message && (
        <p className="mt-2 text-sm text-[var(--text-sub)]" role="status">
          {message}
        </p>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={disabled || loading}
          onClick={() => void onSend()}
          className="!border-white/20 !bg-zinc-800/60 !text-zinc-200 hover:!bg-zinc-700/70"
        >
          {loading ? 'Wird gesendet…' : 'Push senden'}
        </Button>
      </div>

      {!teamSeasonId && (
        <p className="mt-2 text-xs text-amber-300/90">Kein Team/Saison gewählt.</p>
      )}
    </div>
  );
};
