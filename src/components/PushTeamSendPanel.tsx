'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { isUpcomingRelevant } from '../features/home/homeFeedBuilder';
import { formatEventDateVienna, formatEventTimeVienna } from '../lib/notifications/format';
import { applyPushTemplatePlaceholders } from '../lib/pushTemplatePlaceholders';
import {
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  resolveTeamIdFromSeasonId,
  updateTemplate,
  type PushTemplateRow,
} from '../lib/pushTemplates';

const API = '/api/push/send-team';
const DEFAULT_TEAM_PUSH_LINK = '/app/nachrichten';

/** MVP: Termin-Dropdown + Hilfetext ausblenden; Platzhalter-Logik bleibt im Code (z. B. auf true setzen). */
const SHOW_TEAM_PUSH_EVENT_PICKER = false;

type Props = {
  teamSeasonId: string | null;
  /** full: Form + Vorlagen-Liste; push-only: nur Form; templates-only: nur Vorlagen-Liste */
  variant?: 'full' | 'push-only' | 'templates-only';
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
  messagesSaved?: number;
  notificationsInserted?: number;
  notificationsInsertError?: string;
  results?: PushRecipientResult[];
  error?: string;
};

function previewLine(text: string, max = 72): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function pushEventOptionLabel(ev: EventRow): string {
  const kind = ev.kind === 'match' ? 'Spiel' : ev.kind === 'training' ? 'Training' : 'Termin';
  const d = formatEventDateVienna(ev.starts_at);
  const t = formatEventTimeVienna(ev.starts_at);
  return `${kind} · ${d} · ${t}`;
}

export const PushTeamSendPanel: React.FC<Props> = ({ teamSeasonId, variant = 'full' }) => {
  const { session, user } = useAuth();
  const { selectedTeamSeason } = useSession();
  const teamDisplayName = (selectedTeamSeason?.team?.name ?? '').trim() || 'Team';
  const { events } = useEvents(teamSeasonId);
  const teamIdFromSession = selectedTeamSeason?.team?.id != null ? String(selectedTeamSeason.team.id) : null;
  const [teamIdResolved, setTeamIdResolved] = useState<string | null>(null);
  const teamId = teamIdFromSession ?? teamIdResolved;

  const [recipientGroup, setRecipientGroup] = useState<'parents' | 'players' | 'all'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState(DEFAULT_TEAM_PUSH_LINK);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detailResults, setDetailResults] = useState<PushRecipientResult[] | null>(null);

  const [templates, setTemplates] = useState<PushTemplateRow[]>([]);
  const [templateSelect, setTemplateSelect] = useState('');
  /** Gesetztes Template beim „Übernehmen“ / Dropdown — Speichern = UPDATE statt INSERT. */
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  /** Rohtext der zuletzt aus einer Vorlage geladenen Felder (mit Platzhaltern), für Termin-Wechsel. */
  const templateRawRef = useRef<{ title: string; message: string } | null>(null);

  const upcomingPushEvents = useMemo(() => {
    const now = new Date();
    return (events ?? [])
      .filter(
        (e) =>
          (e.kind === 'match' || e.kind === 'training') && isUpcomingRelevant(e, now),
      )
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [events]);

  const selectedPushEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return upcomingPushEvents.find((e) => e.id === selectedEventId) ?? null;
  }, [selectedEventId, upcomingPushEvents]);

  const reloadTemplates = useCallback(async () => {
    if (!teamId) {
      setTemplates([]);
      return;
    }
    setTemplates(await fetchTemplates(teamId));
  }, [teamId]);

  useEffect(() => {
    setTemplateSelect('');
    setEditingTemplateId(null);
    setSelectedEventId('');
    templateRawRef.current = null;
    void reloadTemplates();
  }, [reloadTemplates]);

  useEffect(() => {
    const raw = templateRawRef.current;
    if (!raw) return;
    const ev = selectedEventId
      ? upcomingPushEvents.find((e) => e.id === selectedEventId) ?? null
      : null;
    setTitle(applyPushTemplatePlaceholders(raw.title, ev, teamDisplayName));
    setBody(applyPushTemplatePlaceholders(raw.message, ev, teamDisplayName));
  }, [selectedEventId, upcomingPushEvents, teamDisplayName]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (!upcomingPushEvents.some((e) => e.id === selectedEventId)) {
      setSelectedEventId('');
    }
  }, [selectedEventId, upcomingPushEvents]);

  useEffect(() => {
    if (teamIdFromSession) {
      setTeamIdResolved(null);
      return;
    }
    if (!teamSeasonId) {
      setTeamIdResolved(null);
      return;
    }
    let cancelled = false;
    void resolveTeamIdFromSeasonId(teamSeasonId).then((id) => {
      if (!cancelled) setTeamIdResolved(id);
    });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId, teamIdFromSession]);

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
      let path = url.trim() || DEFAULT_TEAM_PUSH_LINK;
      if (!path.startsWith('/')) path = `/${path}`;
      const evForSend = selectedPushEvent;
      const titleOut = applyPushTemplatePlaceholders(title.trim(), evForSend, teamDisplayName);
      const bodyOut = applyPushTemplatePlaceholders(body.trim(), evForSend, teamDisplayName);
      const res = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_season_id: teamSeasonId,
          recipient_group: recipientGroup,
          title: titleOut,
          body: bodyOut,
          url: path,
        }),
      });
      const data = (await res.json()) as SendTeamResponse;
      if (!res.ok || data.ok === false) {
        setMessage(typeof data.error === 'string' && data.error.trim() ? data.error.trim() : `Senden fehlgeschlagen (HTTP ${res.status}).`);
        setDetailResults(null);
        return;
      }

      const total = data.totalRecipients ?? 0;
      const sent = data.sent ?? 0;
      const failed = data.failed ?? 0;
      const msgSaved = data.messagesSaved ?? 0;
      const notifN = data.notificationsInserted ?? 0;

      if (failed > 0 && Array.isArray(data.results)) {
        console.warn('[PushTeamSendPanel] push partial failure', data.results.filter((r) => !r.success));
        setDetailResults(data.results.filter((r) => !r.success));
      } else {
        setDetailResults(null);
      }

      if (typeof data.notificationsInsertError === 'string' && data.notificationsInsertError.trim()) {
        setMessage(
          `Push: ${sent}/${total} zugestellt. Hinweis In-App-Inbox: ${data.notificationsInsertError.trim()}`,
        );
        return;
      }

      if (failed === 0) {
        setMessage(
          total === 0
            ? `Kein aktives Push-Gerät bei den Empfängern. ${msgSaved} Team-Nachricht(en) gespeichert, ${notifN} In-App-Benachrichtigung(en).`
            : `Erfolgreich: ${sent} Push(s) gesendet, ${notifN} In-App-Benachrichtigung(en), ${msgSaved} Eintrag/Einträge im Team-Postfach.`,
        );
        setTitle('');
        setBody('');
        setUrl(DEFAULT_TEAM_PUSH_LINK);
        setRecipientGroup('all');
        setTemplateSelect('');
        setEditingTemplateId(null);
        setSelectedEventId('');
        templateRawRef.current = null;
      } else {
        setMessage(`Teilerfolg: ${sent} Push(s) ok, ${failed} fehlgeschlagen (${total} Ziele). In-App: ${notifN}.`);
      }
    } catch {
      setMessage('Senden war nicht möglich.');
      setDetailResults(null);
    } finally {
      setLoading(false);
    }
  };

  const onTemplateChange = (id: string) => {
    setTemplateSelect(id);
    if (!id) {
      setEditingTemplateId(null);
      templateRawRef.current = null;
      return;
    }
    setEditingTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    templateRawRef.current = { title: t.title, message: t.message };
    const ev = selectedPushEvent;
    setTitle(applyPushTemplatePlaceholders(t.title, ev, teamDisplayName));
    setBody(applyPushTemplatePlaceholders(t.message, ev, teamDisplayName));
    setUrl(t.link?.trim() ? t.link.trim() : DEFAULT_TEAM_PUSH_LINK);
  };

  const onSaveTemplate = async () => {
    if (!teamId || !user?.id) return;
    if (!title.trim() || !body.trim()) {
      setToast(null);
      return;
    }
    setSavingTemplate(true);
    try {
      const linkVal = url.trim() || null;
      if (editingTemplateId) {
        const ok = await updateTemplate({
          id: editingTemplateId,
          teamId,
          title: title.trim(),
          message: body.trim(),
          link: linkVal,
        });
        if (ok) {
          setToast('Vorlage aktualisiert');
          window.setTimeout(() => setToast(null), 3200);
          await reloadTemplates();
          setTemplateSelect(editingTemplateId);
        } else {
          setToast('Vorlage konnte nicht aktualisiert werden.');
          window.setTimeout(() => setToast(null), 4200);
        }
      } else {
        const res = await createTemplate({
          teamId,
          userId: user.id,
          title: title.trim(),
          message: body.trim(),
          link: linkVal,
        });
        if (res.ok) {
          setToast('Vorlage gespeichert');
          window.setTimeout(() => setToast(null), 3200);
          await reloadTemplates();
          if (res.id) {
            setTemplateSelect(res.id);
            setEditingTemplateId(res.id);
          } else {
            setTemplateSelect('');
            setEditingTemplateId(null);
          }
        } else {
          setToast('Vorlage konnte nicht gespeichert werden.');
          window.setTimeout(() => setToast(null), 4200);
        }
      }
    } finally {
      setSavingTemplate(false);
    }
  };

  const onUseTemplate = (t: PushTemplateRow) => {
    templateRawRef.current = { title: t.title, message: t.message };
    const ev = selectedPushEvent;
    setTitle(applyPushTemplatePlaceholders(t.title, ev, teamDisplayName));
    setBody(applyPushTemplatePlaceholders(t.message, ev, teamDisplayName));
    setUrl(t.link?.trim() ? t.link.trim() : DEFAULT_TEAM_PUSH_LINK);
    setTemplateSelect(t.id);
    setEditingTemplateId(t.id);
  };

  const onDeleteTemplate = async (id: string) => {
    setDeletingId(id);
    try {
      const ok = await deleteTemplate(id);
      if (ok) {
        await reloadTemplates();
        if (templateSelect === id) setTemplateSelect('');
        if (editingTemplateId === id) setEditingTemplateId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const showPushForm = variant === 'full' || variant === 'push-only';
  const showTemplatesList = variant === 'full' || variant === 'templates-only';

  return (
    <div className="space-y-4">
      {showPushForm && (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <h2 className="text-lg font-bold text-white">Team-Push</h2>
        <p className="mt-1 text-[14px] text-white/75">
          Push an Eltern und/oder Spieler des aktuellen Teams. Senden nur für Trainer oder Admin.
        </p>

        <label className="mt-3 block text-[12px] font-medium uppercase tracking-wide text-white/60" htmlFor="push-recipient">
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
          <option value="all">Alle (Eltern + Spieler)</option>
          <option value="parents">Nur Eltern</option>
          <option value="players">Nur Spieler</option>
        </select>

        <label className="mt-3 block text-[12px] font-medium uppercase tracking-wide text-white/60" htmlFor="push-template-pick">
          Vorlage auswählen
        </label>
        <select
          id="push-template-pick"
          value={templateSelect}
          onChange={(e) => onTemplateChange(e.target.value)}
          disabled={disabled || loading || !teamId}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          <option value="">— Vorlage wählen —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>

        {SHOW_TEAM_PUSH_EVENT_PICKER && (
          <>
            <label className="mt-3 block text-[12px] font-medium uppercase tracking-wide text-white/60" htmlFor="push-event-pick">
              Termin (Platzhalter)
            </label>
            <select
              id="push-event-pick"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              disabled={disabled || loading || !teamSeasonId}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">Kein Termin</option>
              {upcomingPushEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {pushEventOptionLabel(ev)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] leading-snug text-white/60">
              Mit Termin:{' '}
              <span className="text-white/70">
                {'{team}'}, {'{gegner}'}, {'{treffpunkt}'}, {'{anpfiff}'}, {'{datum}'}, {'{uhrzeit}'}
              </span>{' '}
              — ohne Termin bleiben Platzhalter leer beim Senden.
            </p>
          </>
        )}

        <label className="mt-3 block text-[12px] font-medium uppercase tracking-wide text-white/60" htmlFor="push-title">
          Titel
        </label>
        <input
          id="push-title"
          type="text"
          value={title}
          onChange={(e) => {
            templateRawRef.current = null;
            setTitle(e.target.value);
          }}
          disabled={disabled || loading}
          placeholder="Kurzer Titel"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />

        <label className="mt-3 block text-[12px] font-medium uppercase tracking-wide text-white/60" htmlFor="push-body">
          Text
        </label>
        <textarea
          id="push-body"
          value={body}
          onChange={(e) => {
            templateRawRef.current = null;
            setBody(e.target.value);
          }}
          disabled={disabled || loading}
          rows={3}
          placeholder="Nachrichtentext"
          className="mt-1 w-full resize-y rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />

        <label className="mt-3 block text-[12px] font-medium uppercase tracking-wide text-white/60" htmlFor="push-url">
          Link (Pfad in der App)
        </label>
        <input
          id="push-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={disabled || loading}
          placeholder="/app/nachrichten oder /app/termine"
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-black/40 px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />

        {toast && (
          <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100" role="status">
            {toast}
          </p>
        )}

        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={disabled || loading || savingTemplate || !teamId || !user?.id}
            onClick={() => void onSaveTemplate()}
            className="!border-white/20 !bg-zinc-800/60 !text-zinc-200 hover:!bg-zinc-700/70"
          >
            {savingTemplate
              ? 'Speichern…'
              : editingTemplateId
                ? 'Vorlage aktualisieren'
                : 'Als Vorlage speichern'}
          </Button>
        </div>

        {message && (
          <p
            className={`mt-2 text-sm ${
              message.startsWith('Erfolgreich')
                ? 'rounded-md border border-emerald-500/35 bg-emerald-950/35 px-3 py-2 text-emerald-100'
                : message.startsWith('Teilerfolg') || message.startsWith('Hinweis') || message.startsWith('Push:')
                  ? 'rounded-md border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-amber-100/95'
                  : message.startsWith('Kein aktives')
                    ? 'rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white/85'
                    : 'text-[var(--text-sub)]'
            }`}
            role="status"
          >
            {message}
          </p>
        )}

        {detailResults && detailResults.length > 0 && (
          <p className="mt-2 text-sm text-amber-200/90" role="status">
            Für einige Empfänger konnte Push nicht zugestellt werden.
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
          <p className="mt-2 text-[12px] text-amber-300/90">Kein Team/Saison gewählt.</p>
        )}
      </div>
      )}

      {showTemplatesList && (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <h3 className="text-[16px] font-semibold text-white">Vorlagen</h3>
        <p className="mt-1 text-[14px] text-white/75">Gespeicherte Texte für schnelles Wiederverwenden.</p>
        {variant === 'templates-only' && (
          <p className="mt-2 text-[14px] text-white/75">
            Neue Vorlage:{' '}
            <Link to="/app/mehr/trainer/team-push" className="font-medium text-red-400 underline-offset-2 hover:underline">
              Team-Push
            </Link>{' '}
            öffnen und „Als Vorlage speichern“ bzw. „Vorlage aktualisieren“.
          </p>
        )}

        {!teamId && (
          <p className="mt-3 text-[14px] font-medium text-white/80">Kein Team gewählt.</p>
        )}

        {teamId && templates.length === 0 && (
          <p className="mt-3 text-[14px] font-medium text-white/80">Noch keine Vorlagen gespeichert.</p>
        )}

        {teamId && templates.length > 0 && (
          <ul className="mt-3 divide-y divide-white/10 rounded-lg border border-white/10 bg-black/25">
            {templates.map((t) => (
              <li key={t.id} className="px-3 py-2.5 first:pt-3 last:pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold text-white">{t.title}</div>
                    <p className="mt-0.5 line-clamp-2 text-[14px] text-white/75">{previewLine(t.message, 80)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={disabled || loading || deletingId === t.id}
                    onClick={() => void onDeleteTemplate(t.id)}
                    className="shrink-0 text-[12px] font-medium text-red-400/90 hover:text-red-300 disabled:opacity-50"
                  >
                    {deletingId === t.id ? '…' : 'Löschen'}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => onUseTemplate(t)}
                  className="mt-2 text-[12px] font-medium text-white/70 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
                >
                  Übernehmen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
    </div>
  );
};
