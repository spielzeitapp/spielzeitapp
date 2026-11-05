import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminEnsureTeamSeason, type ClubDetail } from '../lib/platformClubAdmin';
import { createSetupTeam } from '../lib/managerSetup';
import { isStagingApp } from '../lib/appEnvironment';
import { supabase } from '../lib/supabaseClient';

type FoundTeam = { key: string; name: string; rosterUrl: string; scheduleUrl: string; tableUrl: string; hasTeamPhoto: boolean };
type Selection = { selected: boolean; target: string; name: string; age: string; seasonId?: string; status?: string };

/** Stage team structure first, then use the existing reviewed data import screens. */
export function ManagerClubImportPanel({ detail, onSaved }: { detail: ClubDetail; onSaved: () => void }) {
  const generation = useRef(0);
  const [url, setUrl] = useState('');
  const [season, setSeason] = useState('2026/27');
  const [teams, setTeams] = useState<FoundTeam[]>([]);
  const [choices, setChoices] = useState<Record<string, Selection>>({});
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  if (!isStagingApp()) return null;
  const reset = () => { generation.current++; setTeams([]); setChoices({}); setConfirmed(false); setNotice(''); setError(''); };
  async function scan() {
    const version = ++generation.current;
    setBusy(true); setError(''); setNotice(''); setTeams([]); setChoices({}); setConfirmed(false);
    try {
      const r = await fetch('/api/oefb/table?' + new URLSearchParams({ view: 'club', url, season }), { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok || data.error) throw Error(data.error || 'Verein konnte nicht gelesen werden.');
      if (version !== generation.current) return;
      setChoices(Object.fromEntries((data.teams as FoundTeam[]).map(t => [t.key, { selected: false, target: '', name: t.key === 'KM' ? 'Kampfmannschaft' : t.key === 'Res' ? 'Reserve' : t.key, age: t.name }])));
      setTeams(data.teams);
      setNotice(data.notice);
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : 'Fehler beim Suchen.'); }
    finally { if (version === generation.current) setBusy(false); }
  }
  function change(key: string, patch: Partial<Selection>) { setConfirmed(false); setChoices(old => ({ ...old, [key]: { ...old[key], ...patch } })); }
  const selected = teams.filter(t => choices[t.key]?.selected);
  async function prepare() {
    if (busy || !confirmed || !selected.length) return;
    const targets = selected.map(t => choices[t.key].target || `${choices[t.key].name.trim().toLowerCase()}:${choices[t.key].age.trim().toUpperCase()}`);
    if (new Set(targets).size !== targets.length) { setError('Zwei ÖFB-Mannschaften dürfen nicht demselben Ziel zugeordnet werden. Bitte Auswahl prüfen.'); return; }
    setBusy(true); setError('');
    try {
      for (const t of selected) {
        const c = choices[t.key];
        if (c.seasonId) continue;
        try {
          let id = c.target;
          if (!id) {
            if (!c.name.trim() || !c.age.trim()) throw Error('Name und Altersklasse fehlen.');
            const result = await createSetupTeam({ clubId: detail.id, name: c.name.trim(), ageGroup: c.age.trim(), seasonName: season });
            if (result.error || !result.data) throw Error(result.error || 'Mannschaft konnte nicht vorbereitet werden.');
            id = result.data.team_season_id;
          }
          if (id.startsWith('team:')) {
            const saved = await adminEnsureTeamSeason({ teamId: id.slice(5), seasonName: season, status: 'active', ageGroup: c.age });
            if (saved.error || typeof saved.data?.team_season_id !== 'string') throw Error(saved.error || 'Saison konnte nicht angelegt werden.');
            id = saved.data.team_season_id;
          }
          const existing = detail.team_seasons.find(s => s.id === id);
          if (existing && (existing.status === 'archived' || existing.season_name !== season)) throw Error('Bitte eine aktive Mannschaft derselben Saison wählen.');
          setChoices(old => ({ ...old, [t.key]: { ...old[t.key], seasonId: id, status: 'Bereit für Datenimport' } }));
        } catch (e) { setChoices(old => ({ ...old, [t.key]: { ...old[t.key], status: e instanceof Error ? e.message : 'Vorbereitung fehlgeschlagen' } })); }
      }
      setNotice('Mannschaftsstruktur vorbereitet. Kader, Fotos, Spiele und Tabellen über die vorausgefüllten Zugänge prüfen und übernehmen. Es wurden noch keine Kader oder Spiele importiert.');
      setConfirmed(false); onSaved();
      window.dispatchEvent(new Event('manager-setup-changed'));
    } finally { setBusy(false); }
  }
  const linkFor = (t: FoundTeam, id: string, kind: 'roster' | 'schedule') => kind === 'roster'
    ? `/manager/saisons/${encodeURIComponent(id)}/kader?oefbRoster=${encodeURIComponent(t.rosterUrl)}`
    : `/manager/saisons/${encodeURIComponent(id)}/oefb-import?oefbSchedule=${encodeURIComponent(t.scheduleUrl)}`;
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <div><span className="text-xs font-semibold uppercase text-slate-500">TEST · Vereinsimport</span><h2 className="text-lg font-semibold">Mannschaften automatisch beim ÖFB finden</h2><p className="text-sm text-slate-600">Ein Vereinslink statt vieler einzelner Links. Bestehende Mannschaften ausdrücklich zuordnen, besonders bei NSG/SPG und mehrfachen Altersklassen.</p></div>
    <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
      <label className="text-sm">ÖFB-Vereinslink<input type="url" disabled={busy} value={url} onChange={e => { reset(); setUrl(e.target.value); }} placeholder="https://vereine.oefb.at/USCRohrbach/" className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
      <label className="text-sm">Saison<input disabled={busy} value={season} onChange={e => { reset(); setSeason(e.target.value); }} placeholder="2026/27" className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
    </div>
    <button type="button" disabled={busy || !url.trim()} onClick={() => void scan()} className="min-h-11 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Bitte warten…' : 'Mannschaften suchen'}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
    {teams.length > 0 && <div className="space-y-3"><p className="font-semibold">{teams.length} Mannschaften gefunden · {selected.length} ausgewählt</p>
      {teams.map(t => { const c = choices[t.key]; if (!c) return null; return <div key={t.key} className="space-y-3 rounded-xl border border-slate-200 p-3">
        <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={c.selected} disabled={busy || Boolean(c.seasonId)} onChange={e => change(t.key, { selected: e.target.checked })} />{t.name} <span className="text-xs font-normal text-slate-500">ÖFB: {t.key} · {t.hasTeamPhoto ? 'Teamfoto vorhanden' : 'kein Teamfoto gemeldet'}</span></label>
        {c.selected && !c.seasonId && <><label className="block text-sm">Zielmannschaft<select value={c.target} disabled={busy} onChange={e => change(t.key, { target: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3"><option value="">Neu anlegen / identischen Eintrag wiederverwenden</option>{detail.teams.filter(t => !detail.team_seasons.some(s => s.team_id === t.id && s.season_name === season)).map(t => <option key={t.id} value={'team:' + t.id}>{t.name} · Saison ergänzen</option>)}{detail.team_seasons.filter(s => s.status !== 'archived' && s.season_name === season).map(s => <option key={s.id} value={s.id}>{s.team_name} · {s.age_group} · {s.season_name}</option>)}</select></label>
        {!c.target && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Mannschaftsname<input disabled={busy} value={c.name} onChange={e => change(t.key, { name: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label><label className="text-sm">Altersklasse / Kategorie<input disabled={busy} value={c.age} onChange={e => change(t.key, { age: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label></div>}</>}
        {c.status && <p className="text-sm" role="status">{c.status}</p>}
        {c.seasonId && <div className="flex flex-wrap gap-3 text-sm font-semibold"><Link className="underline" to={linkFor(t, c.seasonId, 'roster')}>Kader &amp; Fotos übernehmen</Link><Link className="underline" to={linkFor(t, c.seasonId, 'schedule')}>Spiele &amp; Ergebnisse übernehmen</Link><a className="underline" href={t.tableUrl} target="_blank" rel="noreferrer">ÖFB-Tabelle prüfen ↗</a></div>}
      </div>; })}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Verein, Saison und Zielmannschaften geprüft. Noch nicht zugeordnete Mannschaften dürfen neu angelegt werden.</label>
      <button type="button" disabled={busy || !confirmed || !selected.some(t => !choices[t.key].seasonId) || selected.some(t => !choices[t.key].target && (!choices[t.key].name.trim() || !choices[t.key].age.trim()))} onClick={() => void prepare()} className="min-h-11 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50">Ausgewählte Mannschaften vorbereiten</button>
    </div>}
    <details><summary className="cursor-pointer py-2 font-semibold">Homepage &amp; Vereinsapp vorbereiten</summary><p className="mb-3 text-sm text-slate-600">Interne Strukturvorschau mit vorhandenen Mannschaften. Keine Veröffentlichung. Vereinsnews, Sponsoren, Shop und öffentliche Freigaben folgen in einem weiteren Schritt.</p><button type="button" onClick={() => setPreview(!preview)} className="min-h-11 rounded-xl border px-4">{preview ? 'Vorschau schließen' : 'Vereinsvorschau öffnen'}</button>
      {preview && <ClubOutline detail={detail} />}
    </details>
  </section>;
}
function ClubOutline({ detail }: { detail: ClubDetail }) {
  const [logo, setLogo] = useState<string | null>(null);
  React.useEffect(() => { let active = true; void supabase.from('clubs').select('logo_url').eq('id', detail.id).maybeSingle().then(({ data }) => { if (active) setLogo(data?.logo_url || null); }); return () => { active = false; }; }, [detail.id]);
  return <div className="mt-4 overflow-hidden rounded-2xl border bg-white"><div className="flex items-center gap-4 bg-black p-5 text-white">{logo && <img src={logo} alt="" className="h-16 w-16 rounded-lg bg-white object-contain p-1" />}<div><p className="text-xs">INTERNE VORSCHAU</p><h3 className="text-2xl font-bold">{detail.name}</h3><p>Dein Verein. Deine Teams. Alles dabei.</p></div></div><div className="space-y-3 p-4"><h4 className="font-bold">Mannschaften</h4>{detail.team_seasons.filter(s => s.status !== 'archived').map(s => <p key={s.id} className="rounded-lg border p-3">{s.team_name} · {s.age_group} · {s.season_name}</p>)}{!detail.team_seasons.length && <p>Noch keine Mannschaftssaisonen eingerichtet.</p>}<p className="text-sm text-slate-500">News · Sponsoren · Shop: noch nicht eingerichtet</p><p className="text-xs text-slate-500">Powered by SpielzeitApp</p></div></div>;
}
