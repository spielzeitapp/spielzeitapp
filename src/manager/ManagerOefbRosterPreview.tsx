import type {OefbImportWorkflowProps} from './oefbImportWorkflow';
import { OefbPlayerPhoto } from '../components/OefbPlayerPhoto';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {rosterIdentityMatches,rosterMembershipLabel,type ClubRosterProfile} from '../lib/clubRosterIdentity';
import { supabase } from '../lib/supabaseClient';

type Candidate = { externalPlayerId: string; name: string; jerseyNumber?: number | null; photoUrl?: string | null };
type Choice = { target: string; first: string; last: string; distinct?:boolean; takeName?:boolean };
export function ManagerOefbRosterPreview({ seasonId, onSaved, sourceUrl, workflowRef, onWorkflowState }: { seasonId: string; onSaved?: () => void } & OefbImportWorkflowProps) {
  const embedded = Boolean(workflowRef);
  const generation = useRef(0);
  const [clubProfiles,setClubProfiles]=useState<ClubRosterProfile[]>([]);
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
  useEffect(() => { generation.current++; setUrl(sourceUrl || new URLSearchParams(window.location.search).get('oefbRoster') || ''); setPlayers([]); setChoices({}); setConfirmed(false); setNotice(''); setError(''); return () => {generation.current++;}; }, [seasonId, sourceUrl]);
  async function preview() {
    const version = ++generation.current;
    setConfirmed(false); setChoices({});
    setBusy(true); setPlayers([]); setError(''); setNotice('');
    try {
      const response = await fetch('/api/oefb/table?view=roster&url=' + encodeURIComponent(url.trim()), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const result = await response.json() as { error?: string; players?: Candidate[]; notice?: string };
      if (!response.ok || result.error) throw Error(result.error || 'ÖFB-Kader konnte nicht geladen werden.');
      const {data: context, error: contextError} = await supabase.rpc('oefb_assignment_context', {p_team_season_id: seasonId});
      if (version !== generation.current) return;
      if (contextError) throw Error(contextError.message);
      const club=await supabase.rpc('admin_club_roster_context',{p_team_season_id:seasonId});
      if(version!==generation.current)return;
      if(club.error)throw Error(club.error.message);
      setClubProfiles(club.data as ClubRosterProfile[]);
      setRoster(context?.players || []);
      const found = result.players || [];
      const next: Record<string, Choice> = {};
      found.forEach(p => {const names = p.name.trim().split(/\s+/); const first=names.shift() || '',last=names.join(' ');
        const profiles=club.data as ClubRosterProfile[];
        const exact=profiles.filter(r=>r.external_ids.includes(p.externalPlayerId));
        const matches=rosterIdentityMatches(profiles,first,last,p.externalPlayerId);
        const target=exact.length===1?exact[0].id:matches.length===1?matches[0].id:!matches.length&&first&&last?'new':'';
        next[p.externalPlayerId] = {target:embedded?target:'',first,last};});
      setChoices(next);
      setPlayers(found);
      setNotice(result.notice || '');
    } catch (e) { if(version === generation.current) setError(e instanceof Error ? e.message : 'Fehler beim Laden'); }
    finally { if(version === generation.current) setBusy(false); }
  }
  const selected = players.filter(p => choices[p.externalPlayerId]?.target);
  const validNames = selected.every(p => {const c=choices[p.externalPlayerId];const matches=rosterIdentityMatches(clubProfiles,c.first,c.last,p.externalPlayerId); return c.target !== 'new' || (c.first.trim() && c.last.trim() && !matches.some(r=>r.external_ids.includes(p.externalPlayerId)) && (!matches.length || c.distinct===true));});
  function choose(id: string, patch: Partial<Choice>) {setConfirmed(false); setChoices(old=>({...old,[id]:{...old[id],...patch,...(patch.target!==undefined?{takeName:false}:{}),...(patch.first!==undefined||patch.last!==undefined?{distinct:false}:{})}}));}
  async function importRoster() {
    if ((!embedded && !confirmed) || !selected.length || !validNames || busy || saving) return false;
    const version = generation.current;
    setSaving(true); setError(''); setNotice('');
    try {
      const {data, error: err} = await supabase.rpc('admin_import_club_oefb_roster', {p_team_season_id:seasonId, p_players:selected.map(p=>{
        const c=choices[p.externalPlayerId]; return {external_player_id:p.externalPlayerId,source_name:p.name,player_id:c.target==='new'?null:c.target,distinct_person:c.distinct===true,take_oefb_name:c.target!=='new'&&c.takeName===true,first_name:c.target==='new'?c.first.trim():p.name.trim().split(/\s+/)[0],last_name:c.target==='new'?c.last.trim():p.name.trim().split(/\s+/).slice(1).join(' '),jersey_number:includeNumbers?p.jerseyNumber??null:null,photo_url:includePhotos?p.photoUrl??null:null};
      })});
      if (version !== generation.current) return false;
      if (err) throw Error(err.message);
      setNotice(`${data.created} Spieler neu angelegt · ${data.mapped} Zuordnungen gespeichert · ${data.names_updated || 0} Namen übernommen · ${data.numbers_added} Rückennummern · ${data.photos_added} Fotos ergänzt. Vorhandene Nummern und Fotos bleiben erhalten.`);
      setConfirmed(false); setPlayers([]); setChoices({}); onSaved?.();
      window.dispatchEvent(new Event('manager-setup-changed'));
      const refreshed=await supabase.rpc('oefb_assignment_context',{p_team_season_id:seasonId});
      if(version===generation.current&&!refreshed.error)setRoster(refreshed.data?.players||[]);
      return true;
    } catch(e) {if(version===generation.current)setError(e instanceof Error?e.message:'Kader konnte nicht gespeichert werden.'); return false;}
    finally {setSaving(false);}
  }
  useImperativeHandle(workflowRef,()=>({preview,save:importRoster}));
  useEffect(()=>{onWorkflowState?.({busy:busy||saving,found:players.length,selected:selected.length,canSave:!busy&&!saving&&selected.length>0&&validNames,error});},[busy,saving,players,choices,includeNumbers,includePhotos,validNames,error,onWorkflowState]);
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
    <h2 className="text-lg font-semibold text-slate-900">ÖFB-Kader einlesen & übernehmen</h2>
    <p className="text-sm text-slate-600">ÖFB-Kader einlesen und mit vorhandenen Spielern verknüpfen. Neue Spieler nur anlegen, wenn noch kein passendes Profil existiert.</p>
    {!embedded && <><label className="block text-sm font-medium text-slate-700">ÖFB-Kaderlink
      <input type="url" value={url} disabled={busy || saving} onChange={e => {generation.current++; setUrl(e.target.value); setPlayers([]); setChoices({}); setConfirmed(false);}} placeholder="https://vereine.oefb.at/.../Kader/" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
    <button type="button" disabled={busy || saving || !url.trim()} onClick={() => void preview()} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'ÖFB-Kader wird geprüft…' : 'Kader-IDs prüfen'}</button></>}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-slate-700">{notice}</p> : null}
    {players.length > 0 ? <div className="space-y-3">
      <p className="font-semibold">{players.length} Profile erkannt · {selected.length} ausgewählt</p>
      <p className="text-sm text-slate-600">Wähle für jeden ÖFB-Spieler das vorhandene Spielerprofil. Dadurch wird die ÖFB-Nummer verknüpft und das Profil dieser Mannschaftssaison zugeordnet. Gleiche Namen sind nur Vorschläge; du bestätigst die Zuordnung selbst.</p>
      {players.map(p=>{const c=choices[p.externalPlayerId];const matches=rosterIdentityMatches(clubProfiles,c.first,c.last,p.externalPlayerId);return <div key={p.externalPlayerId} className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center gap-3"><OefbPlayerPhoto src={p.photoUrl} name={p.name} /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-slate-600">ÖFB-ID {p.externalPlayerId} · Rückennummer {p.jerseyNumber ?? 'nicht angegeben'}</p></div></div>
        {!c.target && matches.length>0?<div className="mt-2 space-y-2">{matches.map(r=><div key={r.id} className="rounded-lg border border-slate-200 p-3"><p className="text-sm text-slate-600">{rosterMembershipLabel(r)}</p><button type="button" disabled={saving} onClick={()=>choose(p.externalPlayerId,{target:r.id,distinct:false})} className="mt-2 min-h-11 rounded-lg border border-slate-300 px-3 font-semibold">Mit {r.first_name} {r.last_name} verknüpfen</button></div>)}</div>:null}
        {c.target && c.target!=='new'?<div role="status" className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">✓ {clubProfiles.find(r=>r.id===c.target)?.first_name} {clubProfiles.find(r=>r.id===c.target)?.last_name} ausgewählt</p><p>ÖFB-Nummer wird beim Speichern verknüpft. Bisherige Spiele und Zuordnungen bleiben erhalten.</p><button type="button" disabled={saving} onClick={()=>choose(p.externalPlayerId,{target:''})} className="mt-1 underline">Auswahl aufheben</button></div>:null}
        <details className="mt-2 text-sm"><summary className="cursor-pointer py-2">{c.target?'Anderen Spieler auswählen':'Anderen Spieler auswählen / neu anlegen'}</summary><label className="block">Spieler auswählen<select disabled={saving} value={c.target} onChange={e=>choose(p.externalPlayerId,{target:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="">Nicht übernehmen</option><optgroup label="Vorhandene Spieler">{clubProfiles.map(r=><option key={r.id} value={r.id}>{r.first_name} {r.last_name} · {rosterMembershipLabel(r)}</option>)}</optgroup><option value="new" disabled={clubProfiles.some(r=>r.external_ids.includes(p.externalPlayerId))}>Neuen Spieler anlegen</option></select></label></details>
        {c.target && c.target!=='new' && (()=>{const existing=clubProfiles.find(r=>r.id===c.target);return existing && (existing.first_name+' '+existing.last_name).trim()!==p.name.trim()?<label className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" disabled={saving} checked={c.takeName===true} onChange={e=>choose(p.externalPlayerId,{takeName:e.target.checked})} /><span>Namen vom ÖFB übernehmen: <strong>{existing.first_name} {existing.last_name} → {p.name}</strong><br />Ändert den Namen im bestehenden Profil, auch in bisherigen Mannschaften.</span></label>:null;})()}
        {c.target==='new'&&matches.length>0&&!matches.some(r=>r.external_ids.includes(p.externalPlayerId))?<label className="mt-2 block text-sm"><input type="checkbox" disabled={saving} checked={c.distinct===true} onChange={e=>choose(p.externalPlayerId,{distinct:e.target.checked})} /> Andere Person mit gleichem Namen – neues Profil ausdrücklich anlegen</label>:null}
        {c.target==='new'?<div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-sm">Vorname<input disabled={saving} maxLength={100} value={c.first} onChange={e=>choose(p.externalPlayerId,{first:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm">Nachname<input disabled={saving} maxLength={100} value={c.last} onChange={e=>choose(p.externalPlayerId,{last:e.target.value})} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label></div>:null}
      </div>;})}
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={saving} checked={includeNumbers} onChange={e=>{setIncludeNumbers(e.target.checked);setConfirmed(false);}} />Fehlende Rückennummern ergänzen (belegte Nummern bleiben erhalten)</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={saving} checked={includePhotos} onChange={e=>{setIncludePhotos(e.target.checked);setConfirmed(false);}} />Verfügbare ÖFB-Fotos ergänzen (externe Bildlinks; vorhandene Fotos bleiben erhalten)</label>
      {!embedded && <label className="flex gap-2 text-sm"><input type="checkbox" disabled={saving} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />Ich habe Mannschaft, Namen und Zuordnungen geprüft.</label>}
      {!validNames?<p role="alert" className="text-sm text-red-700">Für neue Spieler Vor- und Nachnamen ergänzen. Bei Namensgleichheit entweder das vorhandene Profil auswählen oder ausdrücklich bestätigen, dass es eine andere Person ist. Eine bereits verknüpfte ÖFB-Nummer kann nicht als neuer Spieler angelegt werden.</p>:null}
      {!embedded && <button type="button" disabled={saving || busy || !confirmed || !selected.length || !validNames} onClick={()=>void importRoster()} className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50">{saving?'Kader wird gespeichert…':`Zuordnungen speichern (${selected.length})`}</button>}
    </div> : null}
    {!embedded && <div className="space-y-3 border-t border-slate-200 pt-4">
      <h3 className="font-semibold">Bekannte ÖFB-Spieler-ID verknüpfen</h3>
      <p className="text-sm text-slate-600">Offiziellen Spielerprofil-Link einfügen und das bestehende Spielerprofil auswählen. Es wird kein neuer Spieler angelegt.</p>
      <label className="block text-sm">ÖFB-Spielerprofil-Link<input value={profileUrl} onChange={e=>{setProfileUrl(e.target.value);setApproved(false);}} placeholder="https://www.oefb.at/Profile/Spieler/1392818/Nino-Semellechner" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="block text-sm">Vorhandenes Profil<select value={playerId} onChange={e=>{setPlayerId(e.target.value);setApproved(false);}} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Bitte auswählen</option>{roster.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} />Identität und ÖFB-Profil geprüft</label>
      {!parsedProfileId ? <p className="text-sm text-amber-700">Ungültiger ÖFB-Profillink. Nach der Spieler-ID muss ein Schrägstrich (/) stehen, kein Fragezeichen (?). Bitte den vollständigen Link einfügen; grauer Beispieltext zählt nicht.</p> : null}
      {!playerId ? <p className="text-sm text-amber-700">Bitte das vorhandene Spielerprofil in der Auswahlliste aktiv auswählen.</p> : null}
      <button type="button" disabled={!canLink} onClick={()=>void linkProfile()} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving?'Speichert…':'ÖFB-ID verknüpfen'}</button>
      {saved?<p role="status" className="text-sm text-emerald-700">{saved}</p>:null}
    </div>}
  </section>;
}
