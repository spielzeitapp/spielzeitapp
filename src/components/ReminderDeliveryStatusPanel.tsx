import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

type PlayerStatus = {
  id: string;
  name: string;
  open: boolean;
  recipientCount: number;
  inboxCount: number;
  pushCount: number;
  manualCount: number;
};

type MatchStatus = {
  id: string;
  starts_at: string;
  opponent?: string | null;
  latestReminder?: { id: string; sent_at?: string | null } | null;
  nextReminder?: { send_at?: string | null } | null;
  players: PlayerStatus[];
};

type Props = { teamSeasonId: string };

function dateTime(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: 'Europe/Vienna',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export const ReminderDeliveryStatusPanel: React.FC<Props> = ({ teamSeasonId }) => {
  const { session } = useAuth();
  const [matches, setMatches] = useState<MatchStatus[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/push/send-team?team_season_id=${encodeURIComponent(teamSeasonId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Versandstatus konnte nicht geladen werden.');
      const next = Array.isArray(data.matches) ? data.matches : [];
      setMatches(next);
      setSelectedId((current) => (next.some((m: MatchStatus) => m.id === current) ? current : next[0]?.id || ''));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Versandstatus konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, teamSeasonId]);

  useEffect(() => { void load(); }, [load]);
  const selected = useMemo(() => matches.find((m) => m.id === selectedId) || null, [matches, selectedId]);
  const openPlayers = selected?.players.filter((p) => p.open) || [];
  const notReached = openPlayers.filter((p) => p.recipientCount === 0 || (p.inboxCount + p.manualCount) < p.recipientCount);

  const sendMissing = async () => {
    if (!selected || !session?.access_token) return;
    if (!window.confirm(`Nur noch nicht automatisch erreichte offene Rückmeldungen erinnern?`)) return;
    setSending(true);
    setMessage(null);
    try {
      const opponent = selected.opponent?.trim() || 'den Gegner';
      const res = await fetch('/api/push/send-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          team_season_id: teamSeasonId,
          recipient_group: 'open_unreminded',
          related_event_id: selected.id,
          title: `⚽ Spiel gegen ${opponent}`,
          body: 'Deine Rückmeldung fehlt noch. Bitte jetzt verbindlich zu- oder absagen.',
          url: `/app/events/${selected.id}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Erinnerung konnte nicht gesendet werden.');
      setMessage(data.hint || `Manuell erinnert: ${data.notificationsInserted ?? 0} In-App, ${data.sent ?? 0} Push.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erinnerung konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Versandstatus</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/55">Zeigt die letzte Auto-Erinnerung je offenem Spieler.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/75">Aktualisieren</button>
      </div>

      {loading ? <p className="mt-4 text-sm text-white/55">Status wird geladen…</p> : matches.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">Kein kommendes Match gefunden.</p>
      ) : (
        <>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="mt-4 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm">
            {matches.map((match) => <option key={match.id} value={match.id}>{dateTime(match.starts_at)} · {match.opponent || 'Match'}</option>)}
          </select>

          {selected && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-black/25 p-2"><div className="text-lg font-bold">{openPlayers.length}</div><div className="text-[11px] text-white/55">offen</div></div>
                <div className="rounded-xl bg-emerald-950/35 p-2"><div className="text-lg font-bold text-emerald-300">{openPlayers.length - notReached.length}</div><div className="text-[11px] text-white/55">auto erreicht</div></div>
                <div className="rounded-xl bg-amber-950/35 p-2"><div className="text-lg font-bold text-amber-300">{notReached.length}</div><div className="text-[11px] text-white/55">noch offen</div></div>
              </div>
              <p className="mt-3 text-xs text-white/55">
                {selected.latestReminder ? `Letzte Auto-Erinnerung: ${dateTime(selected.latestReminder.sent_at)}` : selected.nextReminder ? `Nächste Auto-Erinnerung: ${dateTime(selected.nextReminder.send_at)}` : 'Noch keine Auto-Erinnerung protokolliert.'}
              </p>
              <div className="mt-3 space-y-2">
                {openPlayers.map((player) => {
                  const inboxOk = player.recipientCount > 0 && player.inboxCount >= player.recipientCount;
                  const manualOk = player.recipientCount > 0 && (player.inboxCount + player.manualCount) >= player.recipientCount;
                  return (
                    <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                      <div><div className="text-sm font-semibold">{player.name}</div><div className="text-[11px] text-white/50">{player.recipientCount ? `${player.recipientCount} verknüpfte Empfänger` : 'Kein App-Zugang verknüpft'}</div></div>
                      <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${inboxOk || manualOk ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {inboxOk ? (player.pushCount > 0 ? 'Auto-Push gesendet' : 'Auto In-App') : manualOk ? 'Manuell erinnert' : 'Nicht erreicht'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" disabled={sending || notReached.length === 0} onClick={() => void sendMissing()} className="mt-4 w-full rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-45">
                {sending ? 'Wird gesendet…' : `Nur noch nicht Erreichte erinnern (${notReached.length})`}
              </button>
            </>
          )}
        </>
      )}
      {message && <p className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-relaxed text-white/75">{message}</p>}
    </section>
  );
};
