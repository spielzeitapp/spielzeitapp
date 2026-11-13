import React, { useState } from 'react';
import { Modal } from '../../app/ui/Modal';
import { supabase } from '../../lib/supabaseClient';
import { assertTeamSeasonWritable } from '../../lib/seasonTransition';
import { trainingAttendanceLabel, trainingAttendanceToDb, dbStatusToTrainingAttendance, type TrainingAttendanceStatus } from '../../lib/trainingAttendance';
import type { PlayerItem } from '../../hooks/usePlayers';

export function TrainingHistoryEditor({ eventId, player, status, onSaved }: {
  eventId: string; player: PlayerItem; status: TrainingAttendanceStatus; onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState(status), [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null), [loaded, setLoaded] = useState(false);
  const start = async () => {
    setOpen(true); setLoaded(false); setError(null); setBusy(true);
    try {
      const result = await supabase.from('event_attendance').select('status,note').eq('event_id', eventId).eq('player_id', player.id).maybeSingle();
      if (result.error) throw result.error;
      setChoice(dbStatusToTrainingAttendance(result.data?.status) ?? status); setNote(result.data?.note ?? ''); setLoaded(true);
    } catch { setError('Teilnahme konnte nicht geladen werden. Bitte erneut öffnen.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (busy || !loaded) return;
    setBusy(true); setError(null);
    try {
      const event = await supabase.from('events').select('team_season_id,kind').eq('id', eventId).single();
      if (event.error) throw event.error;
      if (event.data.kind !== 'training') throw new Error('Kein Training.');
      const writable = await assertTeamSeasonWritable(event.data.team_season_id);
      if (!writable.ok) throw new Error(writable.message);
      const dbStatus = trainingAttendanceToDb(choice);
      if (!dbStatus) throw new Error('Bitte Status wählen.');
      if (choice === 'other_team' && !note.trim()) throw new Error('Bitte Mannschaft oder Camp angeben.');
      const result = await supabase.from('event_attendance').upsert({ event_id: eventId, player_id: player.id, status: dbStatus, note: choice === 'other_team' ? note.trim() : null, updated_at: new Date().toISOString() }, { onConflict: 'event_id,player_id' }).select('status').single();
      if (result.error) throw result.error;
      await onSaved(); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { setBusy(false); }
  };
  const choices: TrainingAttendanceStatus[] = ['present', 'absent', 'sick', 'injured', 'other_team', ...(player.is_laz_player || choice === 'external' ? ['external' as const] : [])];
  return <>
    <button type="button" onClick={() => void start()} className="sz-club-event-action mt-3 min-h-11 w-full rounded-full border px-3 text-[14px] font-bold">Teilnahme ändern</button>
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Trainingsteilnahme ändern">
      <p className="mb-3 text-white/70">{player.display_name} · nachträgliche Korrektur</p>
      {error ? <p role="alert" className="mb-3 text-red-300">{error}</p> : null}
      {loaded ? <><div className="grid grid-cols-2 gap-2">{choices.map(value => <button key={value} type="button" disabled={busy} aria-pressed={choice === value} onClick={() => setChoice(value)} className={`sz-club-event-action min-h-14 rounded-2xl border px-3 py-3 font-bold ${choice === value ? 'sz-club-tab-active' : ''}`}>{trainingAttendanceLabel(value)}</button>)}</div>
      {choice === 'other_team' ? <label className="mt-4 block">Mannschaft / Camp<input value={note} disabled={busy} maxLength={160} onChange={e => setNote(e.target.value)} placeholder="z. B. U13 oder Rapidcamp" className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-black/40 px-3" /></label> : null}
      <p className="mt-3 text-sm text-white/60">Die gespeicherte Teilnahme wird für Quote, Aktivität und Trainingskaiser neu ausgewertet. Ein datierter Verletzungsausfall aus dem Spielerprofil hat weiterhin Vorrang.</p>
      <button type="button" disabled={busy || (choice === 'other_team' && !note.trim())} onClick={() => void save()} className="sz-club-event-action sz-club-tab-active mt-4 min-h-12 w-full rounded-full border font-bold disabled:opacity-40">{busy ? 'Speichert…' : 'Änderung speichern'}</button></> : busy ? <p role="status">Lade Teilnahme…</p> : null}
    </Modal>
  </>;
}
