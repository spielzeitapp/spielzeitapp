'use client';

import React, { useState } from 'react';
import { Button } from '../app/components/ui/Button';
import { useAuth } from '../auth/AuthProvider';

const API = '/api/push/send-team';

type Props = {
  teamSeasonId: string | null;
};

type PushRecipientResult = {
  email?: string | null;
  role?: string | null;
  endpointPreview?: string;
  success: boolean;
  statusCode?: number | null;
  error?: string;
  body?: string;
};

type SendTeamResponse = {
  ok?: boolean;
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  results?: PushRecipientResult[];
  error?: string;
};

export const PushTeamSendPanel: React.FC<Props> = ({ teamSeasonId }) => {
  const { session } = useAuth();
  const [recipientGroup, setRecipientGroup] = useState<'parents' | 'players' | 'all'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/termine');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detailResults, setDetailResults] = useState<PushRecipientResult[] | null>(null);

  const disabled = !teamSeasonId || !session?.access_token;

  const onSend = async () => {
    if (!teamSeasonId || !session?.access_token) return;
    if (!title.trim() || !body.trim()) {
      setMessage('Bitte Titel und Text ausfüllen.');
      setDetailResults(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    setDetailResults(null);
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
      const data = (await res.json()) as SendTeamResponse;
      if (data.ok) {
        setMessage(
          `Ziele: ${data.totalRecipients ?? 0} · ${data.sent ?? 0} ok · ${data.failed ?? 0} fehlgeschlagen`,
        );
        if ((data.failed ?? 0) > 0 && Array.isArray(data.results)) {
          setDetailResults(data.results.filter((r) => !r.success));
        } else {
          setDetailResults(null);
        }
      } else {
        setMessage(data.error || 'Senden fehlgeschlagen.');
        setDetailResults(null);
      }
    } catch {
      setMessage('Netzwerkfehler.');
      setDetailResults(null);
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

      {detailResults && detailResults.length > 0 && (
        <div
          className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-md border border-amber-500/30 bg-amber-950/25 p-2 text-left text-xs text-amber-100"
          role="region"
          aria-label="Push-Zustellfehler"
        >
          <p className="font-medium text-amber-200/95">Details (fehlgeschlagen)</p>
          <ul className="space-y-2">
            {detailResults.map((r, i) => (
              <li key={`${r.endpointPreview ?? i}-${i}`} className="rounded border border-white/10 bg-black/30 p-2 font-mono text-[11px] leading-snug">
                {r.email != null && r.email !== '' && (
                  <div>
                    <span className="text-[var(--text-sub)]">E-Mail: </span>
                    {r.email}
                  </div>
                )}
                {r.role != null && r.role !== '' && (
                  <div>
                    <span className="text-[var(--text-sub)]">Rolle: </span>
                    {r.role}
                  </div>
                )}
                {r.endpointPreview != null && r.endpointPreview !== '' && (
                  <div className="break-all">
                    <span className="text-[var(--text-sub)]">Endpoint: </span>
                    {r.endpointPreview}
                  </div>
                )}
                {r.statusCode != null && (
                  <div>
                    <span className="text-[var(--text-sub)]">HTTP: </span>
                    {r.statusCode}
                  </div>
                )}
                {r.error != null && r.error !== '' && (
                  <div className="mt-1 text-red-200/95">
                    <span className="text-[var(--text-sub)]">Fehler: </span>
                    {r.error}
                    {/VapidPkHashMismatch/i.test(r.error) && (
                      <span className="mt-1 block text-amber-200/95">
                        Tipp: In Vercel <code className="rounded bg-black/40 px-1">VITE_VAPID_PUBLIC_KEY</code> und{' '}
                        <code className="rounded bg-black/40 px-1">VAPID_PUBLIC_KEY</code> müssen identisch sein; Push beim
                        Empfänger neu aktivieren.
                      </span>
                    )}
                  </div>
                )}
                {r.body != null && r.body !== '' && (
                  <div className="mt-1 whitespace-pre-wrap break-words text-amber-100/90">
                    <span className="text-[var(--text-sub)]">Antwort: </span>
                    {r.body}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
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
