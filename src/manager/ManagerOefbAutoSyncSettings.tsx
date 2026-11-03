import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type SyncStatus = {
  enabled: boolean;
  competition_id: string | null;
  team_name: string | null;
  scheduled: boolean;
  last_success: string | null;
  last_error: string | null;
  pending: number;
};

export function ManagerOefbAutoSyncSettings({ seasonId, disabled }: { seasonId: string; disabled: boolean }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async (signal: AbortSignal) => {
    const result = await supabase.rpc('get_oefb_auto_sync_status', { p_team_season_id: seasonId }).abortSignal(signal);
    if (signal.aborted) return;
    if (result.error) setError(result.error.message);
    else { setStatus(result.data as SyncStatus); setError(null); }
  }, [seasonId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(String(e)); });
    return () => controller.abort();
  }, [load]);

  async function toggle() {
    if (!status || busy || disabled) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const result = await supabase.rpc('set_oefb_auto_sync', {
        p_team_season_id: seasonId,
        p_enabled: !status.enabled,
        p_expected_competition_id: status.competition_id,
      });
      if (result.error) throw new Error(result.error.message);
      setStatus(result.data as SyncStatus); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  return <section aria-label="Automatischer ÖFB-Abgleich" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-base font-bold">Automatischer ÖFB-Abgleich</h2>
    <p className="mt-2 text-sm text-slate-600">Übernimmt Datum und Endstand für bereits importierte Spiele dieser Mannschaft und Saison etwa alle 15 Minuten, auch ohne geöffnete App. Home und Termine verwenden denselben Stand. Interne Live-Aufzeichnungen und abweichende abgeschlossene Ergebnisse bleiben geschützt.</p>
    {status ? <div className="mt-3 space-y-2 text-sm">
      <p><strong>{status.enabled ? 'Aktiviert' : 'Deaktiviert'}</strong> · {status.team_name || 'Mannschaft noch nicht zugeordnet'} · Bewerb {status.competition_id || 'nicht hinterlegt'}</p>
      <p>Vor dem Aktivieren prüfen, ob der Bewerb zur gewählten Altersklasse und Saison gehört. Neue Spiele werden weiterhin über die Importvorschau angelegt.</p>
      {status.enabled && !status.scheduled ? <p role="status">Der automatische Dienst ist noch nicht eingerichtet. Bitte die Plattformverwaltung kontaktieren.</p> : null}
      {status.enabled && status.last_success ? <p>Letzter erfolgreicher Abruf: {new Intl.DateTimeFormat('de-AT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(status.last_success))}</p> : null}
      {status.enabled && !status.last_success ? <p>Der erste Abgleich steht noch aus.</p> : null}
      {status.enabled && status.last_error ? <p role="status">Ein Abruf ist fehlgeschlagen. Der Dienst versucht es erneut. {status.last_error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void toggle()} disabled={disabled || busy || (!status.enabled && !status.competition_id)} className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Speichert…' : status.enabled ? 'Automatischen Abgleich deaktivieren' : 'Automatischen Abgleich aktivieren'}</button>
        <button type="button" disabled={busy} onClick={() => { setSaved(false); void load(new AbortController().signal).catch(e => setError(String(e))); }} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold">Status aktualisieren</button>
      </div>
    </div> : !error ? <p role="status" className="mt-3 text-sm">Status wird geladen…</p> : null}
    {saved ? <p role="status" className="mt-2 text-sm">Einstellung gespeichert.</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
  </section>;
}
