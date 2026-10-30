import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Candidate = { externalPlayerId: string; name: string; jerseyNumber?: number | null; photoUrl?: string | null };
type Choice = { target: string; first: string; last: string };
export function ManagerOefbRosterPreview({ seasonId, onSaved }: { seasonId: string; onSaved?: () => void }) {
  const generation = useRef(0);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [players, setPlayers] = useState<Candidate[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [roster, setRoster] = useState<Array<{id:string;first_name:string;last_name:string}>>([]);
  const [profileUrl, setProfileUrl] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const parsedProfileId = profileUrl.trim().match(/^https:\/\/(?:www\.)?oefb\.at\/Profile\/Spieler\/(\d{4,10})\/[^?#]+$/i)?.[1] || '';
  const canLink = Boolean(parsedProfileId && playerId && approved && !saving);

  useEffect(() => {
    let active = true;
    void supabase.rpc('oefb_assignment_context', {p_team_season_id: seasonId}).then(({data,error}) => {
      if (active && !error) setRoster((data?.players || []) as Array<{id:string;first_name:string;last_name:string}>);
    });
    return () => {active = false;};
  }, [seasonId]);
  async function linkProfile() {
    const id = profileUrl.trim().match(/^https:\/\/(?:www\.)?oefb\.at\/Profile\/Spieler\/(\d{4,10})\/[^?#]+$/i)?.[1];
    const player = roster.find(p => p.id === playerId);
    if (!id || !player || !approved) return;
    setSaving(true); setSaved(''); setError('');
    try {
      const {error} = await supabase.rpc('save_oefb_player_assignments', {
        p_team_season_id:seasonId,
        p_players:[{external_player_id:id,player_id:player.id,source_name:player.first_name+' '+player.last_name}],
        p_reports:[]
      });
      if (error) throw new Error(error.message);
      setSaved(player.first_name+' '+player.last_name+' mit ÖFB-ID '+id+' verknüpft.');
      setProfileUrl('');setPlayerId('');setApproved(false);
    } catch (e) {setError(e instanceof Error ? e.message : 'Verknüpfung fehlgeschlagen');}
    finally {setSaving(false);}
  }
  useEffect(() => { generation.current++; setUrl(''); setPlayers([]); setChoices({}); setConfirmed(false); setNotice(''); setError(''); return () => {generation.current++;}; }, [seasonId]);
  async function preview() {
    const version = ++generation.current;
    setConfirmed(false); setChoices({});
    setBusy(true); setPlayers([]); setError(''); setNotice('');
    try {
      const response = await fetch('/api/oefb/table?view=roster&url=' + encodeURIComponent(url.trim()), { cache: 'no-store' });
      const result = await response.json() as { error?: string; players?: Candidate[]; notice?: string };
      if (!response.ok || result.error) throw Error(result.error || 'ÖFB-Kader konnte nicht geladen werden.');
      const {data: context, error: contextError} = await supabase.rpc('oefb_assignment_context', {p_team_season_id: seasonId});
      if (version !== generation.current) return;
      if (contextError) throw Error(contextError.message);
      setRoster(context?.players || []);
      const found = result.players || [];
      const next: Record<string, Choice> = {};
      found.forEach(p => {const names = p.name.split(/\s+/); next[p.externalPlayerId] = {target: context?.links?.find((l: {external_player_id:string;player_id:string}) => l.external_player_id === p.externalPlayerId)?.player_id || 'new', first: names.shift() || '', last: names.join(' ')};});
      setChoices(next);
      setPlayers(found);
      setNotice(result.notice || '');
    } catch (e) { if(version === generation.current) setError(e instanceof Error ? e.message : 'Fehler beim Laden'); }
    finally { if(version === generation.current) setBusy(false); }
  }
  const selected = players.filter(p => choices[p.externalPlayerId]?.target);
  const validNames = selected.every(p => {const c=choices[p.externalPlayerId]; return c.target !== 'new' || (c.first.trim() && c.last.trim());});
  function choose(id: string, patch: Partial<Choice>) {setConfirmed(false); setChoices(old=>({...old,[id]:{...old[id],...patch}}));}
  async function importRoster() {
    if (!confirmed || !selected.length || !validNames || busy || saving) return;
    const version = generation.current;
    setSaving(true); setError(''); setNotice('');
    try {
      const {data, error: err} = await supabase.rpc('import_oefb_roster', {p_team_season_id:seasonId, p_players:selected.map(p=>{
        const c=choices[p.externalPlayerId]; return {external_player_id:p.externalPlayerId,source_name:p.name,player_id:c.target==='new'?null:c.target,first_name:c.first.trim(),last_name:c.last.trim(),jersey_number:includeNumbers?p.jerseyNumber??null:null,photo_url:includePhotos?p.photoUrl??null:null};
      })});
      if (version !== generation.current) return;
      if (err) throw Error(err.message);
      setNotice(`${data.created} Spieler neu angelegt · ${data.mapped} Zuordnungen gespeichert · ${data.numbers_added} Rückennummern · ${data.photos_added} Fotos ergänzt. Vorhandene Nummern und Fotos bleiben erhalten.`);
      setConfirmed(false); setPlayers([]); setChoices({}); onSaved?.();
      window.dispatchEvent(new Event('manager-setup-changed'));
      const refreshed=await supabase.rpc('oefb_assignment_context',{p_team_season_id:seasonId});
      if(version===generation.current&&!refreshed.error)setRoster(refreshed.data?.players||[]);
    } catch(e) {if(version===generation.current)setError(e instanceof Error?e.message:'Kader konnte nicht gespeichert werden.');}
    finally {setSaving(false);}
  }
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
    <h2 className="text-lg font-semibold text-slate-900">ÖFB-Kader einlesen & übernehmen</h2>
    <p className="text-sm text-slate-600">Kaderlink einlesen, Namen und Zuordnungen prüfen und ausgewählte Spieler in diese Mannschaftssaison übernehmen.</p>
    <label className="block text-sm font-medium text-slate-700">ÖFB-Kaderlink
      <input type="url" value={url} disabled={busy || saving} onChange={e => {generation.current++; setUrl(e.target.value); setPlayers([]); setChoices({}); setConfirmed(false);}} placeholder="https://vereine.oefb.at/.../Kader/" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
    <button type="button" disabled={busy || saving || !url.trim()} onClick={() => void preview()} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'ÖFB-Kader wird geprüft…' : 'Kader-IDs prüfen'}</button>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-slate-700">{notice}</p> : null}
    {players.length > 0 ? <div className="space-y-3">
      <p className="font-semibold">{players.length} Profile erkannt · {selected.length} ausgewählt</p>
      <p className="text-sm text-slate-600">Bekannte ÖFB-IDs werden wiederverwendet. Bei bereits vorhandenen Spielern ohne ÖFB-Verknüpfung das Profil ausdrücklich wählen. Keine automatische Namenszuordnung.</p>
      {players.map(p=>{const c=choices[p.externalPlayerId];return <div key={p.externalPlayerId} className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center gap-3">{p.photoUrl?<img src={p.photoUrl} alt={p.name} referrerPolicy="no-referrer" className="h-14 w-14 rounded-lg object-cover" />:null}<div><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-600">ÖFB-ID {p.externalPlayerId} · Rückennummer {p.jerseyNumber ?? 'nicht angegeben'}</p></div></div>
        <label className="mt-2 block text-sm">Übernahme<select disabled={saving} value={c.target} onChange={e=>choose(p.externalPlayerId,{target:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="">Nicht übernehmen</option><option value="new">Als neuen Spieler anlegen / bekannte ÖFB-ID verwenden</option>{roster.map(r=><option key={r.id} value={r.id}>{r.first_name} {r.last_name} · vorhandenes Profil</option>)}</select></label>
        {c.target==='new'?<div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-sm">Vorname<input disabled={saving} maxLength={100} value={c.first} onChange={e=>choose(p.externalPlayerId,{first:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm">Nachname<input disabled={saving} maxLength={100} value={c.last} onChange={e=>choose(p.externalPlayerId,{last:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label></div>:null}
      </div>;})}
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={saving} checked={includeNumbers} onChange={e=>{setIncludeNumbers(e.target.checked);setConfirmed(false);}} />Fehlende Rückennummern ergänzen (belegte Nummern bleiben erhalten)</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={saving} checked={includePhotos} onChange={e=>{setIncludePhotos(e.target.checked);setConfirmed(false);}} />Verfügbare ÖFB-Fotos ergänzen (externe Bildlinks; vorhandene Fotos bleiben erhalten)</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={saving} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />Ich habe Mannschaft, Namen und Zuordnungen geprüft.</label>
      {!validNames?<p role="alert" className="text-sm text-red-700">Vor- und Nachnamen der neuen Spieler ergänzen.</p>:null}
      <button type="button" disabled={saving || busy || !confirmed || !selected.length || !validNames} onClick={()=>void importRoster()} className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50">{saving?'Kader wird gespeichert…':`${selected.length} Spieler in Kader übernehmen`}</button>
    </div> : null}
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <h3 className="font-semibold">Bekannte ÖFB-Spieler-ID verknüpfen</h3>
      <p className="text-sm text-slate-600">Offiziellen Spielerprofil-Link einfügen und das bestehende Spielerprofil auswählen. Es wird kein neuer Spieler angelegt.</p>
      <label className="block text-sm">ÖFB-Spielerprofil-Link<input value={profileUrl} onChange={e=>{setProfileUrl(e.target.value);setApproved(false);}} placeholder="https://www.oefb.at/Profile/Spieler/1392818/Nino-Semellechner" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="block text-sm">Vorhandenes Profil<select value={playerId} onChange={e=>{setPlayerId(e.target.value);setApproved(false);}} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Bitte auswählen</option>{roster.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} />Identität und ÖFB-Profil geprüft</label>
      {!parsedProfileId ? <p className="text-sm text-amber-700">Ungültiger ÖFB-Profillink. Nach der Spieler-ID muss ein Schrägstrich (/) stehen, kein Fragezeichen (?). Bitte den vollständigen Link einfügen; grauer Beispieltext zählt nicht.</p> : null}
      {!playerId ? <p className="text-sm text-amber-700">Bitte das vorhandene Spielerprofil in der Auswahlliste aktiv auswählen.</p> : null}
      <button type="button" disabled={!canLink} onClick={()=>void linkProfile()} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving?'Speichert…':'ÖFB-ID verknüpfen'}</button>
      {saved?<p role="status" className="text-sm text-emerald-700">{saved}</p>:null}
    </div>
  </section>;
}
