import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagerClubImportData } from './ManagerClubImportData';
import { ManagerClubTeamOverview } from './ManagerClubTeamOverview';
import { adminEnsureTeamSeason, listPlatformClubs, getPlatformClub, type ClubDetail } from '../lib/platformClubAdmin';
import { createSetupTeam } from '../lib/managerSetup';
import { isStagingApp } from '../lib/appEnvironment';
import { supabase } from '../lib/supabaseClient';

type FoundTeam = { key: string; name: string; rosterUrl: string; scheduleUrl: string; tableUrl: string; hasTeamPhoto: boolean };
type Selection = { selected: boolean; target: string; name: string; age: string; seasonId?: string; status?: string; suggested?: boolean; ownerClub?: string; linked?: boolean; problem?: boolean };

function savedImportSource(clubId: string): { url: string; season: string } {
  try {
    const value = JSON.parse(window.localStorage.getItem(`spielzeit:club-import:v1:${clubId}`) || 'null');
    if (typeof value?.url === 'string' && typeof value?.season === 'string') {
      const u = new URL(value.url);
      if (u.protocol === 'https:' && u.hostname === 'vereine.oefb.at' && !u.username && !u.password && !u.port && !u.search && !u.hash && /^\/[a-z0-9-]+(?:\/(?:News|Mannschaften))?\/?$/i.test(u.pathname) && /^\d{4}\/\d{2}$/.test(value.season)) return value;
    }
  } catch { /* Storage can be unavailable. Discovery still works. */ }
  return { url: '', season: '2026/27' };
}

/** Stage team structure first, then use the existing reviewed data import screens. */
export function ManagerClubImportPanel({ detail, onSaved }: { detail: ClubDetail; onSaved: () => void }) {
  const generation = useRef(0);
  const [url, setUrl] = useState(() => savedImportSource(detail.id).url);
  const [season, setSeason] = useState(() => savedImportSource(detail.id).season);
  const [teams, setTeams] = useState<FoundTeam[]>([]);
  const [choices, setChoices] = useState<Record<string, Selection>>({});
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [otherClubs, setOtherClubs] = useState<ClubDetail[]>([]);
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
      const clubs = await listPlatformClubs();
      if (clubs.error) throw Error(clubs.error);
      const others = await Promise.all(clubs.data.filter(c => c.id !== detail.id && c.status === 'active').map(c => getPlatformClub(c.id)));
      if (others.some(c => c.error)) throw Error('Vereinsübergreifende Zuordnungen konnten nicht geprüft werden. Bitte erneut suchen.');
      const available = others.flatMap(c => c.data ? [c.data] : []);
      const saved = await supabase.from('oefb_team_import_sources').select('source_url,team_season_id').in('source_url', (data.teams as FoundTeam[]).map(t => t.rosterUrl.toLowerCase().replace(/\/$/, '')));
      if (saved.error) throw Error('Gespeicherte ÖFB-Zuordnungen konnten nicht geladen werden: ' + saved.error.message);
      if (version !== generation.current) return;
      try { window.localStorage.setItem(`spielzeit:club-import:v1:${detail.id}`, JSON.stringify({ url: url.trim(), season })); } catch { /* Optional browser preference. */ }
      setOtherClubs(available);
      const all = [detail, ...available].flatMap(c => c.team_seasons.filter(s => s.status !== 'archived' && s.season_name === season).map(s => ({...s, clubName: c.name})));
      setChoices(Object.fromEntries((data.teams as FoundTeam[]).map(t => {
        const known = saved.data?.find(m => m.source_url === t.rosterUrl.toLowerCase().replace(/\/$/, ''));
        const exact = known ? all.find(s => s.id === known.team_season_id) : null;
        const age = t.name.match(/^U0?(\d{1,2})\b/i)?.[1];
        const possible = age ? all.filter(s => Number(s.age_group?.match(/^U0?(\d{1,2})$/i)?.[1]) === Number(age)) : [];
        const suggested = !known && possible.length === 1 ? possible[0] : null;
        return [t.key, { selected: false, target: known?.team_season_id || suggested?.id || '', name: t.key === 'KM' ? 'Kampfmannschaft' : t.key === 'Res' ? 'Reserve' : t.key, age: t.name, ownerClub: detail.id, linked: Boolean(exact), problem: Boolean(known && !exact), suggested: Boolean(suggested), status: known ? (exact ? 'Gespeicherte Zuordnung wiedererkannt' : 'Gespeicherte Zielmannschaft nicht aktiv – bitte prüfen') : suggested ? 'Vorschlag nach Altersklasse – Identität bitte bestätigen' : '' }];
      })));
      setTeams(data.teams);
      setNotice(data.notice);
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : 'Fehler beim Suchen.'); }
    finally { if (version === generation.current) setBusy(false); }
  }
  function change(key: string, patch: Partial<Selection>) { setConfirmed(false); setChoices(old => ({ ...old, [key]: { ...old[key], ...patch, ...(patch.target !== undefined ? { linked: false, problem: false, status: 'Neue Auswahl – Identität bitte bestätigen' } : {}) } })); }
  const selected = teams.filter(t => choices[t.key]?.selected);
  async function prepare() {
    if (busy || !confirmed || !selected.length) return;
    const targets = selected.map(t => choices[t.key].target || `${choices[t.key].ownerClub}:${choices[t.key].name.trim().toLowerCase()}:${choices[t.key].age.trim().toUpperCase()}`);
    if (new Set(targets.filter(t => t.includes(':'))).size !== targets.filter(t => t.includes(':')).length) { setError('Zwei neue Einträge haben denselben Namen und dieselbe Altersklasse. Bitte einer gemeinsamen bestehenden Mannschaft zuordnen oder Namen unterscheiden.'); return; }
    setBusy(true); setError('');
    try {
      for (const t of selected) {
        const c = choices[t.key];
        if (c.seasonId) continue;
        try {
          let id = c.target;
          if (!id) {
            if (!c.name.trim() || !c.age.trim()) throw Error('Name und Altersklasse fehlen.');
            const result = await createSetupTeam({ clubId: c.ownerClub || detail.id, name: c.name.trim(), ageGroup: c.age.trim(), seasonName: season });
            if (result.error || !result.data) throw Error(result.error || 'Mannschaft konnte nicht vorbereitet werden.');
            id = result.data.team_season_id;
          }
          if (id.startsWith('team:')) {
            const saved = await adminEnsureTeamSeason({ teamId: id.slice(5), seasonName: season, status: 'active', ageGroup: c.age });
            if (saved.error || typeof saved.data?.team_season_id !== 'string') throw Error(saved.error || 'Saison konnte nicht angelegt werden.');
            id = saved.data.team_season_id;
          }
          const existing = [detail, ...otherClubs].flatMap(club => club.team_seasons).find(s => s.id === id);
          if (existing && (existing.status === 'archived' || existing.season_name !== season)) throw Error('Bitte eine aktive Mannschaft derselben Saison wählen.');
          const linked = await supabase.rpc('admin_link_oefb_team_source', { p_source_url: t.rosterUrl, p_team_season_id: id, p_discovered_in_club_id: detail.id });
          if (linked.error) throw Error(linked.error.message);
          setChoices(old => ({ ...old, [t.key]: { ...old[t.key], seasonId: id, target: id, linked: true, problem: false, status: 'Zuordnung gespeichert · Datenimport separat prüfen' } }));
        } catch (e) { setChoices(old => ({ ...old, [t.key]: { ...old[t.key], problem: true, status: e instanceof Error ? e.message : 'Vorbereitung fehlgeschlagen' } })); }
      }
      setNotice('Mannschaftsstruktur vorbereitet. Kader, Fotos, Spiele und Tabellen über die vorausgefüllten Zugänge prüfen und übernehmen. Es wurden noch keine Kader oder Spiele importiert.');
      setConfirmed(false); onSaved();
      window.dispatchEvent(new Event('manager-setup-changed'));
    } finally { setBusy(false); }
  }
  const linkFor = (t: FoundTeam, id: string, kind: 'roster' | 'schedule') => kind === 'roster'
    ? `/manager/saisons/${encodeURIComponent(id)}/kader?oefbRoster=${encodeURIComponent(t.rosterUrl)}`
    : `/manager/saisons/${encodeURIComponent(id)}/oefb-import?oefbSchedule=${encodeURIComponent(t.scheduleUrl)}`;
  return <><ManagerClubTeamOverview detail={detail} />
  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
    <div><span className="text-xs font-semibold uppercase text-slate-500">TEST · Vereinsimport</span><h2 className="text-lg font-semibold">Mannschaften automatisch beim ÖFB finden</h2><p className="text-sm text-slate-600">Die ÖFB-Vereinsseite ist eine Datenquelle. NSG-/SPG-Mannschaften können einem anderen Verein gehören. Gespeicherte Zuordnungen werden wiederverwendet. Bestehende Mannschaften ausdrücklich zuordnen, besonders bei NSG/SPG und mehrfachen Altersklassen.</p></div>
    <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
      <label className="text-sm">ÖFB-Vereinslink<input type="url" disabled={busy} value={url} onChange={e => { reset(); setUrl(e.target.value); }} placeholder="https://vereine.oefb.at/USCRohrbach/" className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
      <label className="text-sm">Saison<input disabled={busy} value={season} onChange={e => { reset(); setSeason(e.target.value); }} placeholder="2026/27" className="mt-1 min-h-11 w-full rounded-xl border px-3" /></label>
    </div>
    <p className="text-xs text-slate-500">Nach erfolgreicher Suche bleibt der Vereinslink in diesem Browser für diesen Verein gespeichert. Bereits zugeordnete Mannschaften müssen für Foto- oder Spieleimporte nicht erneut angekreuzt werden.</p>
    <button type="button" disabled={busy || !url.trim()} onClick={() => void scan()} className="min-h-11 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Bitte warten…' : 'Mannschaften suchen'}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
    {teams.length > 0 && <div className="space-y-3"><p className="font-semibold">{teams.length} Mannschaften gefunden · {selected.length} ausgewählt</p><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-900">✓ {teams.filter(t => choices[t.key]?.linked && !choices[t.key]?.problem).length} zugeordnet</span><span className="rounded-full bg-amber-100 px-3 py-2 text-amber-950">? {teams.filter(t => !choices[t.key]?.linked && !choices[t.key]?.problem && choices[t.key]?.target).length} zu prüfen</span><span className="rounded-full bg-red-100 px-3 py-2 text-red-900">! {teams.filter(t => choices[t.key]?.problem || (!choices[t.key]?.linked && !choices[t.key]?.target)).length} noch offen</span></div><p className="text-xs text-slate-600">Grün bestätigt die Zuordnung. Kader, Spiele und Fotos müssen separat geprüft und übernommen werden.</p><div className="flex gap-3"><button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => { setConfirmed(false); setChoices(old => Object.fromEntries(Object.entries(old).map(([key, c]) => [key, { ...c, selected: true }]))); }}>Alle auswählen</button><button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => { setConfirmed(false); setChoices(old => Object.fromEntries(Object.entries(old).map(([key, c]) => [key, { ...c, selected: Boolean(c.seasonId) }]))); }}>Auswahl aufheben</button></div>
      {teams.map(t => { const c = choices[t.key]; if (!c) return null; const green = c.linked && !c.problem;
        const amber = !green && !c.problem && Boolean(c.target);
        const targetClub = [detail, ...otherClubs].find(club => club.team_seasons.some(s => s.id === (c.seasonId || c.target)));
        const targetSeason = targetClub?.team_seasons.find(s => s.id === (c.seasonId || c.target));
        const importId = c.seasonId || (green ? c.target : '');
        return <div key={t.key} data-import-status={green ? 'linked' : amber ? 'review' : 'open'} className={`space-y-3 rounded-xl border-l-4 border p-3 ${green ? 'border-emerald-300 bg-emerald-50' : amber ? 'border-amber-300 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
        <p className={`text-xs font-bold ${green ? 'text-emerald-800' : amber ? 'text-amber-900' : 'text-red-800'}`}>{green ? '✓ Zugeordnet' : amber ? '? Zuordnung prüfen' : '! Noch offen'}</p>
        <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={c.selected} disabled={busy || Boolean(c.seasonId)} onChange={e => change(t.key, { selected: e.target.checked })} />{t.name} <span className="text-xs font-normal text-slate-500">ÖFB: {t.key} · {t.hasTeamPhoto ? 'Teamfoto vorhanden' : 'kein Teamfoto gemeldet'}</span></label>
        {c.selected && !c.seasonId && <><label className="block text-sm">Zielmannschaft<select value={c.target} disabled={busy} onChange={e => change(t.key, { target: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3"><option value="">Neu anlegen / identischen Eintrag wiederverwenden</option>{otherClubs.map(club => <optgroup key={club.id} label={club.name}>{club.team_seasons.filter(s => s.status !== 'archived' && s.season_name === season).map(s => <option key={s.id} value={s.id}>{s.team_name} · {s.age_group} · {s.season_name}</option>)}</optgroup>)}{detail.teams.filter(t => !detail.team_seasons.some(s => s.team_id === t.id && s.season_name === season)).map(t => <option key={t.id} value={'team:' + t.id}>{t.name} · Saison ergänzen</option>)}{detail.team_seasons.filter(s => s.status !== 'archived' && s.season_name === season).map(s => <option key={s.id} value={s.id}>{s.team_name} · {s.age_group} · {s.season_name}</option>)}</select></label>
        {!c.target && <label className="block text-sm">Mannschaft gehört zu<select disabled={busy} value={c.ownerClub || detail.id} onChange={e => change(t.key, { ownerClub: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3">{[detail, ...otherClubs].map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>}
        {!c.target && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Mannschaftsname<input disabled={busy} value={c.name} onChange={e => change(t.key, { name: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label><label className="text-sm">Altersklasse / Kategorie<input disabled={busy} value={c.age} onChange={e => change(t.key, { age: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label></div>}</>}
        {targetSeason && <p className="text-sm font-medium">{targetClub?.name} → {targetSeason.team_name} · {targetSeason.age_group} · {targetSeason.season_name}</p>}
        {c.status && <p className="text-sm" role="status">{c.status}</p>}
        {importId && <div className="flex flex-wrap gap-3 text-sm font-semibold"><Link className="underline" to={linkFor(t, importId, 'roster')}>Kader &amp; Fotos übernehmen</Link><Link className="underline" to={linkFor(t, importId, 'schedule')}>Spiele &amp; Ergebnisse übernehmen</Link><a className="underline" href={t.tableUrl} target="_blank" rel="noreferrer">ÖFB-Tabelle prüfen ↗</a></div>}
        {importId && <ManagerClubImportData seasonId={importId} rosterUrl={t.rosterUrl} tableUrl={t.tableUrl} onSaved={onSaved} />}
      </div>; })}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Verein, Saison und Identität der Zielmannschaften geprüft (gleiche Altersklasse allein bedeutet nicht dieselbe Mannschaft). Noch nicht zugeordnete Mannschaften dürfen neu angelegt werden.</label>
      <button type="button" disabled={busy || !confirmed || !selected.some(t => !choices[t.key].seasonId) || selected.some(t => !choices[t.key].target && (!choices[t.key].name.trim() || !choices[t.key].age.trim()))} onClick={() => void prepare()} className="min-h-11 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50">Ausgewählte Mannschaften vorbereiten</button>
    </div>}
    <details><summary className="cursor-pointer py-2 font-semibold">Homepage &amp; Vereinsapp vorbereiten</summary><p className="mb-3 text-sm text-slate-600">Interne Strukturvorschau mit vorhandenen Mannschaften. Keine Veröffentlichung. Vereinsnews, Sponsoren, Shop und öffentliche Freigaben folgen in einem weiteren Schritt.</p><button type="button" onClick={() => setPreview(!preview)} className="min-h-11 rounded-xl border px-4">{preview ? 'Vorschau schließen' : 'Vereinsvorschau öffnen'}</button>
      {preview && <ClubOutline detail={detail} />}
    </details>
  </section></>;
}
function ClubOutline({ detail }: { detail: ClubDetail }) {
  const [logo, setLogo] = useState<string | null>(null);
  React.useEffect(() => { let active = true; void supabase.from('clubs').select('logo_url').eq('id', detail.id).maybeSingle().then(({ data }) => { if (active) setLogo(data?.logo_url || null); }); return () => { active = false; }; }, [detail.id]);
  return <div className="mt-4 overflow-hidden rounded-2xl border bg-white"><div className="flex items-center gap-4 bg-black p-5 text-white">{logo && <img src={logo} alt="" className="h-16 w-16 rounded-lg bg-white object-contain p-1" />}<div><p className="text-xs">INTERNE VORSCHAU</p><h3 className="text-2xl font-bold">{detail.name}</h3><p>Dein Verein. Deine Teams. Alles dabei.</p></div></div><div className="space-y-3 p-4"><h4 className="font-bold">Mannschaften</h4>{detail.team_seasons.filter(s => s.status !== 'archived').map(s => <p key={s.id} className="rounded-lg border p-3">{s.team_name} · {s.age_group} · {s.season_name}</p>)}{!detail.team_seasons.length && <p>Noch keine Mannschaftssaisonen eingerichtet.</p>}<p className="text-sm text-slate-500">News · Sponsoren · Shop: noch nicht eingerichtet</p><p className="text-xs text-slate-500">Powered by SpielzeitApp</p></div></div>;
}
