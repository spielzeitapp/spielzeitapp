import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function ManagerRosterPlayerActions({ seasonId, playerId, name, removed, onDone }: {
  seasonId: string; playerId: string; name: string; removed: boolean;
  onDone: (message: string, error: boolean) => void;
}): React.ReactElement {
  const [action, setAction] = useState<'remove' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const apply = async () => {
    if (!action || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_roster_player_action', {
        p_team_season_id: seasonId, p_player_id: playerId, p_action: action,
      });
      if (!mounted.current) return;
      if (error || !data?.ok) {
        onDone(error?.message ?? 'Aktion konnte nicht gespeichert werden.', true);
      } else {
        window.dispatchEvent(new Event('manager-setup-changed'));
        onDone(action === 'delete' ? `${name} wurde gelöscht.` : `${name} wurde aus dem aktiven Kader entfernt. Profil und Historie bleiben erhalten.`, false);
      }
      setAction(null);
    } catch (cause) {
      if (mounted.current) onDone(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.', true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (action) return <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-slate-900" role="alertdialog" aria-label={`${name}: ${action === 'delete' ? 'Löschen' : 'Entfernen'} bestätigen`} aria-busy={busy}>
    <p className="font-semibold">{name}: {action === 'delete' ? 'Spieler endgültig löschen?' : 'Aus aktivem Kader entfernen?'}</p>
    <p className="mt-1 text-xs">{action === 'delete'
      ? 'Nur unbenutzte Profile ohne weitere Mannschaftszuordnung, ÖFB-Verknüpfung, Zugänge oder Spieldaten können gelöscht werden. Das kann nicht rückgängig gemacht werden.'
      : 'Das Spielerprofil und alle bisherigen Spieldaten bleiben erhalten. Der Eintrag steht anschließend unter „Ausgeschieden / archiviert“.'}</p>
    <div className="mt-2 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void apply()} className="min-h-11 rounded-lg bg-red-700 px-3 font-semibold text-white disabled:opacity-50">{busy ? 'Wird gespeichert…' : action === 'delete' ? 'Endgültig löschen' : 'Entfernen bestätigen'}</button>
      <button type="button" disabled={busy} onClick={() => setAction(null)} className="min-h-11 px-3 font-semibold">Abbrechen</button>
    </div>
  </div>;
  return <div className="flex flex-wrap gap-x-4 gap-y-1">
    {!removed ? <button type="button" onClick={() => setAction('remove')} className="min-h-11 text-xs font-semibold text-slate-700">Aus Kader entfernen</button> : null}
    <button type="button" onClick={() => setAction('delete')} className="min-h-11 text-xs font-semibold text-red-700">Spieler löschen</button>
  </div>;
}
