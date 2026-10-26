import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Candidate = { externalPlayerId: string; name: string };
export function ManagerOefbRosterPreview({ seasonId }: { seasonId: string }) {
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
  useEffect(() => { setUrl(''); setPlayers([]); setNotice(''); setError(''); }, [seasonId]);
  async function preview() {
    setBusy(true); setPlayers([]); setError(''); setNotice('');
    try {
      const response = await fetch('/api/oefb/table?view=roster&url=' + encodeURIComponent(url.trim()), { cache: 'no-store' });
      const result = await response.json() as { error?: string; players?: Candidate[]; notice?: string };
      if (!response.ok || result.error) throw Error(result.error || 'ÖFB-Kader konnte nicht geladen werden.');
      setPlayers(result.players || []);
      setNotice(result.notice || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler beim Laden'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
    <h2 className="text-lg font-semibold text-slate-900">ÖFB-Kaderseite prüfen</h2>
    <p className="text-sm text-slate-600">Zusätzliche ÖFB-Spieler-IDs aus öffentlichen Kaderprofilen suchen. Nur Vorschau – es werden keine Spieler erstellt oder verknüpft.</p>
    <label className="block text-sm font-medium text-slate-700">ÖFB-Kaderlink
      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://vereine.oefb.at/.../Kader/" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
    <button type="button" disabled={busy || !url.trim()} onClick={() => void preview()} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'ÖFB-Kader wird geprüft…' : 'Kader-IDs prüfen'}</button>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-slate-700">{notice}</p> : null}
    {players.length > 0 ? <div className="space-y-1"><p className="text-sm font-semibold">{players.length} ÖFB-Profile erkannt</p>
      <ul className="divide-y divide-slate-100">{players.map(p => <li key={p.externalPlayerId} className="flex justify-between gap-3 py-2 text-sm"><span>{p.name}</span><span className="font-mono text-slate-600">{p.externalPlayerId}</span></li>)}</ul>
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
