import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, ClipboardCheck, RefreshCw } from 'lucide-react';
import { loadSetup, saveSetup, setupSteps, setupReady, type SetupCheck, type SetupKey, type SetupSnapshot } from '../lib/managerSetup';
import { ManagerRosterPhotos } from './ManagerRosterPhotos';
import { supabase } from '../lib/supabaseClient';
import type { ClubDetail } from '../lib/platformClubAdmin';
import { formatTeamSeasonContextLabel } from '../lib/seasonLifecycle';

const stepAppearance = {
  done: { row: 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100', dot: 'bg-emerald-600 text-white', text: 'text-emerald-900', label: 'Geprüft & erledigt' },
  missing: { row: 'border-red-300 bg-red-50 hover:bg-red-100', dot: 'bg-red-600 text-white', text: 'text-red-900', label: 'Daten fehlen' },
  started: { row: 'border-orange-300 bg-orange-50 hover:bg-orange-100', dot: 'bg-orange-500 text-white', text: 'text-orange-900', label: 'Begonnen · Daten ergänzen' },
  review: { row: 'border-orange-300 bg-orange-50 hover:bg-orange-100', dot: 'bg-orange-500 text-white', text: 'text-orange-900', label: 'Angelegt · noch prüfen' },
  skipped: { row: 'border-slate-200 bg-slate-50 hover:bg-slate-100', dot: 'bg-slate-200 text-slate-700', text: 'text-slate-600', label: 'Nicht benötigt' },
};

type Props = { detail: ClubDetail; seasonId: string; onSelect: (id: string) => void; onAction: (key: SetupKey, id: string) => void; preview?: React.ReactNode; hideSelector?: boolean; initialStep?: string | null };
export function ManagerSetupChecklist({ detail, seasonId, onSelect, onAction, preview, hideSelector = false, initialStep }: Props) {
  const [teamPhoto, setTeamPhoto] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<SetupKey | 'photo'>('club');
  useEffect(() => {
    const valid = ['club','team','season','staff','roster','photo','access','venues','matches','training','review'];
    setActive(valid.includes(initialStep ?? '') ? initialStep as SetupKey | 'photo' : 'club');
  }, [seasonId, initialStep]);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!seasonId) { setSnapshot(null); return; }
    setLoading(true); setError(null); setTeamPhoto(null);
    const [res, photo] = await Promise.all([loadSetup(seasonId), supabase.from('team_photos').select('photo_url').eq('team_season_id', seasonId).maybeSingle()]);
    if (version !== generation.current) return;
    setSnapshot(res.data); setTeamPhoto(photo.error ? null : Boolean(photo.data?.photo_url)); setError(res.error || (photo.error ? 'Mannschaftsfoto konnte nicht geprüft werden.' : null)); setLoading(false);
  }, [seasonId]);
  useEffect(() => { setSnapshot(null); void refresh(); return () => { generation.current++; }; }, [refresh, detail]);
  useEffect(() => { const handler = () => { if (!saving) void refresh(); }; window.addEventListener('focus', handler); window.addEventListener('manager-setup-changed', handler); return () => { window.removeEventListener('focus', handler); window.removeEventListener('manager-setup-changed', handler); }; }, [refresh, saving]);
  const steps = snapshot ? setupSteps(snapshot) : [];
  const selected = steps.find(step => step.key === active) ?? steps[0];
  const done = steps.filter(step => step.state === 'done' || step.state === 'skipped').length + (teamPhoto ? 1 : 0);
  const ready = snapshot ? setupReady(snapshot) && teamPhoto === true : false;
  const completed = steps.filter(step => step.state === 'done').length + (teamPhoto ? 1 : 0);
  const inProgress = steps.filter(step => step.state === 'started' || step.state === 'review').length;
  const missing = steps.filter(step => step.state === 'missing').length + (teamPhoto === false ? 1 : 0);
  const skipped = steps.filter(step => step.state === 'skipped').length;
  const current = detail.team_seasons.find(s => s.id === seasonId);
  async function change(key: SetupKey, value: SetupCheck) {
    const version = generation.current;
    setSaving(true); setError(null);
    const result = await saveSetup(seasonId, key, value);
    if (version === generation.current) { setError(result.error); if (result.data) setSnapshot(result.data); }
    setSaving(false);
    if (!result.error) window.dispatchEvent(new Event('manager-setup-changed'));
  }
  const pending = steps.find(step => step.state !== 'done' && step.state !== 'skipped');
  const next = !teamPhoto && (!pending || steps.indexOf(pending) >= 5) ? { key: 'photo' as const, title: 'Mannschaftsfoto' } : pending;
  return <section id="manager-setup-checklist" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className={`border-b border-slate-100 p-5 ${preview ? 'grid items-start gap-6 xl:grid-cols-[minmax(300px,430px)_1fr]' : ''}`}>
      {preview && <div className="min-w-0">{preview}</div>}
      <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-red-700">Schritt für Schritt</p><h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900"><ClipboardCheck className="h-5 w-5 text-red-700" />Einrichtung &amp; offene Aufgaben</h2><p className="mt-2 text-sm text-slate-600">Daten anlegen, prüfen und abhaken. Vereinsdaten einmal für alle Mannschaften prüfen. Alle weiteren Schritte gelten für die ausgewählte Mannschaft und Saison.</p></div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-900'}`}>{ready ? 'Startklar' : `${done}/11 erledigt`}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{!hideSelector && <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">Mannschaft / Saison<select aria-label="Einrichtung für Mannschaft und Saison" disabled={saving} value={seasonId} onChange={e => { setActive('club'); onSelect(e.target.value); }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Mannschaftssaison wählen…</option>{detail.team_seasons.map(s => <option key={s.id} value={s.id}>{formatTeamSeasonContextLabel({ teamName: s.team_name, ageGroup: s.age_group, seasonName: s.season_name })} · {s.status === 'active' ? 'Aktiv' : s.status === 'archived' ? 'Archiv' : 'Entwurf'}</option>)}</select></label>}<button type="button" onClick={() => void refresh()} disabled={loading || saving || !seasonId} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 disabled:opacity-50" aria-label="Einrichtungsdaten aktualisieren"><RefreshCw className="h-4 w-4" />Status aktualisieren</button></div>
      {snapshot && !loading && <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold" aria-label="Einrichtungsstatus" aria-live="polite">
        <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-900">Grün: {completed} erledigt</span>
        <span className="rounded-full bg-orange-100 px-3 py-2 text-orange-900">Orange: {inProgress} begonnen / noch prüfen</span>
        <span className="rounded-full bg-red-100 px-3 py-2 text-red-900">Rot: {missing} fehlen</span>
        {skipped > 0 && <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">{skipped} nicht benötigt</span>}
      </div>}
      {snapshot && !loading && <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Vorhandene Mannschaftsdaten">
        {[
          { label: 'Mannschaftsfoto', value: teamPhoto === null ? 'Prüfung offen' : teamPhoto ? 'Vorhanden' : 'Fehlt', present: teamPhoto, key: 'roster' as SetupKey },
          { label: 'Trainer', value: `${snapshot.staff} zugeordnet`, present: snapshot.staff > 0, key: 'staff' as SetupKey },
          { label: 'Kader', value: `${snapshot.players} Spieler · ${snapshot.jerseys_missing} ohne Rückennummer`, present: snapshot.players > 0, key: 'roster' as SetupKey },
          { label: 'Spieltermine', value: `${snapshot.matches} gespeichert`, present: snapshot.matches > 0, key: 'matches' as SetupKey },
          { label: 'Trainings', value: `${snapshot.trainings} gespeichert`, present: snapshot.trainings > 0, key: 'training' as SetupKey },
        ].map(item => {
          const state = item.label === 'Mannschaftsfoto' ? (teamPhoto === null ? null : teamPhoto ? 'done' : 'missing') : steps.find(s => s.key === item.key)?.state;
          const color = state ? stepAppearance[state].row + ' ' + stepAppearance[state].text : 'border-amber-200 bg-amber-50 text-amber-900';
          const note = state === 'review' ? 'Noch prüfen & bestätigen' : state === 'started' ? 'Angaben ergänzen' : state === 'done' ? 'Erledigt' : state === 'skipped' ? 'Nicht benötigt' : '';
          return <button key={item.label} type="button" onClick={() => item.label === 'Mannschaftsfoto' ? setActive('photo') : setActive(item.key)} className={`min-h-20 rounded-xl border p-3 text-left ${color}`}><span className="block text-xs font-semibold">{item.label}</span><span className="mt-1 block text-sm font-bold">{state === 'done' ? '✓' : state === 'missing' ? '!' : '?'} {item.value}</span>{note && <span className="mt-1 block text-xs">{note}</span>}</button>;
        })}
        <p className="text-xs text-slate-500 sm:col-span-2 2xl:col-span-3">Grün: erledigt. Orange: Daten vorhanden, aber noch ergänzen oder ausdrücklich prüfen. Rot: Daten fehlen.</p>
      </div>}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Einrichtungsfortschritt" aria-valuemin={0} aria-valuemax={11} aria-valuenow={done}><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${done / 11 * 100}%` }} /></div>
      </div>
    </div>
    {error && <p role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p className="p-5 text-sm text-slate-600">Gespeicherte Daten werden geprüft…</p> : !seasonId ? <div className="p-5 text-sm text-slate-600">Zuerst eine Mannschaft und Saison anlegen.<button type="button" onClick={() => onAction('team', '')} className="ml-2 font-semibold text-red-700">Mannschaft anlegen →</button></div> : selected && <div className="grid lg:grid-cols-[1fr_1.2fr]">
      <ol className="space-y-2 border-b border-slate-100 p-3 lg:border-b-0 lg:border-r">{steps.map((step, index) => {
        const appearance = stepAppearance[step.state];
        return <React.Fragment key={step.key}><li><button type="button" onClick={() => setActive(step.key)} aria-current={active === step.key ? 'step' : undefined} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${appearance.row} ${active === step.key ? 'ring-2 ring-slate-700 ring-offset-1' : ''}`}>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${appearance.dot}`}>{step.state === 'done' ? <Check className="h-4 w-4" /> : index < 5 ? index + 1 : index + 2}</span>
          <span className={`min-w-0 flex-1 text-sm font-semibold ${appearance.text}`}>{step.title}<span className="mt-1 block text-xs font-medium">{step.key === 'roster' && snapshot?.jerseys_missing ? `${snapshot.jerseys_missing} Rückennummern fehlen` : step.key === 'review' && step.state === 'review' ? 'Abschlussprüfung offen' : appearance.label}</span></span>
          <ChevronRight className={`h-4 w-4 shrink-0 ${appearance.text}`} />
        </button></li>{step.key === 'roster' && <li><button type="button" onClick={() => setActive('photo')} aria-current={active === 'photo' ? 'step' : undefined} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ${teamPhoto ? stepAppearance.done.row : teamPhoto === false ? stepAppearance.missing.row : 'border-amber-200 bg-amber-50'} ${active === 'photo' ? 'ring-2 ring-slate-700 ring-offset-1' : ''}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${teamPhoto ? stepAppearance.done.dot : teamPhoto === false ? stepAppearance.missing.dot : stepAppearance.review.dot}`}>{teamPhoto ? <Check className="h-4 w-4" /> : 6}</span><span className="flex-1 text-sm font-semibold">Mannschaftsfoto<span className="mt-1 block text-xs font-medium">{teamPhoto ? 'Foto vorhanden · ansehen oder ändern' : teamPhoto === false ? 'Foto fehlt · hochladen oder importieren' : 'Foto noch nicht geprüft'}</span></span><ChevronRight className="h-4 w-4" /></button></li>}</React.Fragment>;
      })}</ol>
      {active === 'photo' ? <div className="p-5 lg:p-6"><ManagerRosterPhotos key={seasonId} seasonId={seasonId} onSaved={() => { void refresh(); window.dispatchEvent(new Event('manager-setup-changed')); }} /></div> : <div className="p-5 lg:p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Schritt {steps.indexOf(selected) < 5 ? steps.indexOf(selected) + 1 : steps.indexOf(selected) + 2} von 11</p><h3 className="mt-2 text-lg font-bold text-slate-900">{selected.title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">{selected.detail}</p><button type="button" onClick={() => onAction(selected.key, seasonId)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800">{selected.key === 'matches' ? 'Spiele & Tabelle öffnen' : selected.present ? 'Öffnen & prüfen' : 'Jetzt einrichten'}<ChevronRight className="h-4 w-4" /></button>
        <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-800"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={selected.state === 'done'} disabled={saving || !selected.present || (selected.key !== 'club' && current?.status !== 'active')} onChange={e => void change(selected.key, e.target.checked ? 'reviewed' : 'open')} /><span>{selected.key === 'club' ? `Ich habe die Vereinsdaten für alle Mannschaften von ${snapshot?.club_name ?? detail.name} geprüft.` : 'Ich habe diesen Schritt geprüft.'}{!selected.present && <span className="mt-1 block text-xs text-red-700">{selected.key === 'club' && snapshot?.club_missing?.length ? `Bitte ergänzen: ${snapshot.club_missing.join(', ')}.` : 'Zuerst die fehlenden Daten ergänzen.'}</span>}</span></label>
        {selected.optional && <label className="mt-3 flex gap-3 text-sm text-slate-600"><input type="checkbox" checked={selected.state === 'skipped'} disabled={saving || current?.status !== 'active'} onChange={e => void change(selected.key, e.target.checked ? 'unneeded' : 'open')} />Für diese Mannschaft derzeit nicht benötigt</label>}
        {selected.key !== 'club' && current?.status !== 'active' && <p className="mt-3 text-sm text-amber-800">Archiv und Entwürfe werden nur angezeigt. Einrichten kannst du eine aktive Saison.</p>}
        {next && next.key !== active && <button type="button" onClick={() => setActive(next.key)} className="mt-8 text-sm font-semibold text-red-700">Nächster offener Schritt: {next.title} →</button>}
        {ready && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Alle Einrichtungsschritte sind erledigt. Die Mannschaft ist startklar.</p>}
        {snapshot?.updated_at && <p className="mt-6 text-xs text-slate-500">Zuletzt gespeichert: {new Date(snapshot.updated_at).toLocaleString('de-AT')}</p>}
      </div>}
    </div>}
  </section>;
}
