import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, ClipboardCheck, RefreshCw } from 'lucide-react';
import { loadSetup, saveSetup, setupSteps, setupReady, type SetupCheck, type SetupKey, type SetupSnapshot } from '../lib/managerSetup';
import type { ClubDetail } from '../lib/platformClubAdmin';
import { formatTeamSeasonContextLabel } from '../lib/seasonLifecycle';

const stepAppearance = {
  done: { row: 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100', dot: 'bg-emerald-600 text-white', text: 'text-emerald-900', label: 'Geprüft & erledigt' },
  missing: { row: 'border-red-300 bg-red-50 hover:bg-red-100', dot: 'bg-red-600 text-white', text: 'text-red-900', label: 'Daten fehlen' },
  started: { row: 'border-orange-300 bg-orange-50 hover:bg-orange-100', dot: 'bg-orange-500 text-white', text: 'text-orange-900', label: 'Begonnen · Daten ergänzen' },
  review: { row: 'border-orange-300 bg-orange-50 hover:bg-orange-100', dot: 'bg-orange-500 text-white', text: 'text-orange-900', label: 'Angelegt · noch prüfen' },
  skipped: { row: 'border-slate-200 bg-slate-50 hover:bg-slate-100', dot: 'bg-slate-200 text-slate-700', text: 'text-slate-600', label: 'Nicht benötigt' },
};

type Props = { detail: ClubDetail; seasonId: string; onSelect: (id: string) => void; onAction: (key: SetupKey, id: string) => void };
export function ManagerSetupChecklist({ detail, seasonId, onSelect, onAction }: Props) {
  const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<SetupKey>('club');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!seasonId) { setSnapshot(null); return; }
    setLoading(true); setError(null);
    const res = await loadSetup(seasonId);
    if (version !== generation.current) return;
    setSnapshot(res.data); setError(res.error); setLoading(false);
  }, [seasonId]);
  useEffect(() => { setSnapshot(null); void refresh(); return () => { generation.current++; }; }, [refresh, detail]);
  useEffect(() => { const handler = () => { if (!saving) void refresh(); }; window.addEventListener('focus', handler); window.addEventListener('manager-setup-changed', handler); return () => { window.removeEventListener('focus', handler); window.removeEventListener('manager-setup-changed', handler); }; }, [refresh, saving]);
  const steps = snapshot ? setupSteps(snapshot) : [];
  const selected = steps.find(step => step.key === active) ?? steps[0];
  const done = steps.filter(step => step.state === 'done' || step.state === 'skipped').length;
  const ready = snapshot ? setupReady(snapshot) : false;
  const completed = steps.filter(step => step.state === 'done').length;
  const inProgress = steps.filter(step => step.state === 'started' || step.state === 'review').length;
  const missing = steps.filter(step => step.state === 'missing').length;
  const skipped = steps.filter(step => step.state === 'skipped').length;
  const current = detail.team_seasons.find(s => s.id === seasonId);
  async function change(key: SetupKey, value: SetupCheck) {
    const version = generation.current;
    setSaving(true); setError(null);
    const result = await saveSetup(seasonId, key, value);
    if (version === generation.current) { setError(result.error); if (result.data) setSnapshot(result.data); }
    setSaving(false);
  }
  const next = steps.find(step => step.state !== 'done' && step.state !== 'skipped');
  return <section id="manager-setup-checklist" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-red-700">Schritt für Schritt</p><h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900"><ClipboardCheck className="h-5 w-5 text-red-700" />Mannschaft startklar machen</h2><p className="mt-2 text-sm text-slate-600">Daten anlegen, prüfen und abhaken. Der Fortschritt bleibt pro Mannschaft und Saison gespeichert.</p></div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-900'}`}>{ready ? 'Startklar' : `${done}/10 erledigt`}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">Mannschaft / Saison<select aria-label="Einrichtung für Mannschaft und Saison" disabled={saving} value={seasonId} onChange={e => { setActive('club'); onSelect(e.target.value); }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"><option value="">Mannschaftssaison wählen…</option>{detail.team_seasons.map(s => <option key={s.id} value={s.id}>{formatTeamSeasonContextLabel({ teamName: s.team_name, ageGroup: s.age_group, seasonName: s.season_name })} · {s.status === 'active' ? 'Aktiv' : s.status === 'archived' ? 'Archiv' : 'Entwurf'}</option>)}</select></label><button type="button" onClick={() => void refresh()} disabled={loading || saving || !seasonId} className="mt-5 rounded-xl border border-slate-200 px-3 text-slate-600 disabled:opacity-50" aria-label="Einrichtungsdaten aktualisieren"><RefreshCw className="h-4 w-4" /></button></div>
      {snapshot && !loading && <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold" aria-label="Einrichtungsstatus" aria-live="polite">
        <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-900">Grün: {completed} erledigt</span>
        <span className="rounded-full bg-orange-100 px-3 py-2 text-orange-900">Orange: {inProgress} begonnen / noch prüfen</span>
        <span className="rounded-full bg-red-100 px-3 py-2 text-red-900">Rot: {missing} fehlen</span>
        {skipped > 0 && <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">{skipped} nicht benötigt</span>}
      </div>}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Einrichtungsfortschritt" aria-valuemin={0} aria-valuemax={10} aria-valuenow={done}><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${done * 10}%` }} /></div>
    </div>
    {error && <p role="alert" className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p className="p-5 text-sm text-slate-600">Gespeicherte Daten werden geprüft…</p> : !seasonId ? <div className="p-5 text-sm text-slate-600">Zuerst eine Mannschaft und Saison anlegen.<button type="button" onClick={() => onAction('team', '')} className="ml-2 font-semibold text-red-700">Mannschaft anlegen →</button></div> : selected && <div className="grid lg:grid-cols-[1fr_1.2fr]">
      <ol className="space-y-2 border-b border-slate-100 p-3 lg:border-b-0 lg:border-r">{steps.map((step, index) => {
        const appearance = stepAppearance[step.state];
        return <li key={step.key}><button type="button" onClick={() => setActive(step.key)} aria-current={active === step.key ? 'step' : undefined} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${appearance.row} ${active === step.key ? 'ring-2 ring-slate-700 ring-offset-1' : ''}`}>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${appearance.dot}`}>{step.state === 'done' ? <Check className="h-4 w-4" /> : index + 1}</span>
          <span className={`min-w-0 flex-1 text-sm font-semibold ${appearance.text}`}>{step.title}<span className="mt-1 block text-xs font-medium">{step.key === 'review' && step.state === 'review' ? 'Abschlussprüfung offen' : appearance.label}</span></span>
          <ChevronRight className={`h-4 w-4 shrink-0 ${appearance.text}`} />
        </button></li>;
      })}</ol>
      <div className="p-5 lg:p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Schritt {steps.indexOf(selected) + 1} von 10</p><h3 className="mt-2 text-lg font-bold text-slate-900">{selected.title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">{selected.detail}</p><button type="button" onClick={() => onAction(selected.key, seasonId)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800">{selected.present ? 'Öffnen & prüfen' : 'Jetzt einrichten'}<ChevronRight className="h-4 w-4" /></button>
        <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-800"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={selected.state === 'done'} disabled={saving || !selected.present || current?.status !== 'active'} onChange={e => void change(selected.key, e.target.checked ? 'reviewed' : 'open')} /><span>Ich habe diesen Schritt geprüft.{!selected.present && <span className="mt-1 block text-xs text-red-700">Zuerst die fehlenden Daten ergänzen.</span>}</span></label>
        {selected.optional && <label className="mt-3 flex gap-3 text-sm text-slate-600"><input type="checkbox" checked={selected.state === 'skipped'} disabled={saving || current?.status !== 'active'} onChange={e => void change(selected.key, e.target.checked ? 'unneeded' : 'open')} />Für diese Mannschaft derzeit nicht benötigt</label>}
        {current?.status !== 'active' && <p className="mt-3 text-sm text-amber-800">Archiv und Entwürfe werden nur angezeigt. Einrichten kannst du eine aktive Saison.</p>}
        {next && next.key !== active && <button type="button" onClick={() => setActive(next.key)} className="mt-8 text-sm font-semibold text-red-700">Nächster offener Schritt: {next.title} →</button>}
        {ready && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Alle Einrichtungsschritte sind erledigt. Die Mannschaft ist startklar.</p>}
        {snapshot?.updated_at && <p className="mt-6 text-xs text-slate-500">Zuletzt gespeichert: {new Date(snapshot.updated_at).toLocaleString('de-AT')}</p>}
      </div>
    </div>}
  </section>;
}
