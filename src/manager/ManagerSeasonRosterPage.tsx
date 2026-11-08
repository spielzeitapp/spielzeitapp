import {ManagerPhotoRemoteController} from './ManagerPhotoRemoteController';
import {ManagerPlayerPhotoBooth} from './ManagerPlayerPhotoBooth';
import {ManagerRosterPhotos} from './ManagerRosterPhotos';
import {ManagerClubPhotoTemplate} from './ManagerClubPhotoTemplate';
import { OefbPlayerPhoto } from '../components/OefbPlayerPhoto';
/**
 * STEP 4: Historischer / aktueller Saisonkader über team_season_players.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import {
  canPrepareNextSeason,
  formatTeamSeasonContextLabel,
  getSeasonStatusLabel,
  isSeasonArchived,
} from '../lib/seasonLifecycle';
import {
  createRosterPlayer,
  listRoster,
  updateRosterPlayerSeasonFields,
  type RosterPlayer,
} from '../lib/rosterService';
import { getTeamSeasonWritableState } from '../lib/seasonTransition';
import { supabase } from '../lib/supabaseClient';

import { useManagerWorkMode } from './ManagerWorkModeContext';
import type { ManagerWorkMode } from './managerWorkMode';
import { ManagerOefbPlayerAssignments } from './ManagerOefbPlayerAssignments';
import { ManagerNewRosterPlayer } from './ManagerNewRosterPlayer';
import { ManagerRosterPlayerActions } from './ManagerRosterPlayerActions';
import { ManagerOefbRosterPreview } from './ManagerOefbRosterPreview';

function canAccess(effectiveRole: string, backendRole: string, workMode: ManagerWorkMode): boolean {
  if (workMode === 'platform_admin' && (backendRole ?? '').trim().toLowerCase() === 'admin') {
    return true;
  }
  if (canPrepareNextSeason(effectiveRole) || canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

export function ManagerSeasonRosterPage(): React.ReactElement {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { effectiveRole, backendRole, setViewTeamSeasonId } = useSession();
  const currentSeason = useRef(seasonId);
  currentSeason.current = seasonId;
  const { workMode } = useManagerWorkMode();
  const allowed = canAccess(effectiveRole, backendRole, workMode);

  const [meta, setMeta] = useState<{
    displayName: string;
    status: string;
    ageGroup: string | null;
    clubId: string | null;
  } | null>(null);
  const [reportParams]=useSearchParams();
  const reportGameId=reportParams.get('oefbReport');
  const remoteCameraId=reportParams.get('fotoboxCamera')??undefined;
  const [remoteControl,setRemoteControl]=useState(false);
  const [globalPhoto,setGlobalPhoto]=useState(false);
  const [boothPlayer,setBoothPlayer]=useState<string|null>(null);
  const [photoDirty,setPhotoDirty]=useState(false),[photoBusy,setPhotoBusy]=useState(false);
  const canSwitchPhoto=()=>!photoBusy&&(!photoDirty||window.confirm('Ungespeicherte Gestaltung verwerfen?'));
  const openBooth=(id:string)=>{if(!canSwitchPhoto())return;setGlobalPhoto(false);setPhotoDirty(false);setBoothPlayer(id);};
  const [photoEditingId,setPhotoEditingId] = useState<string|null>(null);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [oefbIds, setOefbIds] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!seasonId) return;
    let active = true;
    setOefbIds({});
    void supabase.rpc('oefb_assignment_context', { p_team_season_id: seasonId }).then(({ data, error }) => {
      if (!active || error) return;
      const links = (data as { links?: Array<{ player_id: string; external_player_id: string }> } | null)?.links ?? [];
      setOefbIds(Object.fromEntries(links.filter(link => link.player_id && /^\d{4,10}$/.test(String(link.external_player_id))).map(link => [link.player_id, String(link.external_player_id)])));
    });
    return () => { active = false; };
  }, [seasonId, players]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [writableMessage, setWritableMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadRoster = async (id: string): Promise<boolean> => {
    const roster = await listRoster(id, 'all');
    if (currentSeason.current !== id) return false;
    if (roster.error) {
      setError(roster.error);
      return false;
    }
    setPlayers(roster.data);
    return true;
  };

  useEffect(() => {
    if (!seasonId) return;
    setViewTeamSeasonId(seasonId);
  }, [seasonId, setViewTeamSeasonId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const [{ data: ts, error: tsErr }, roster, writable] = await Promise.all([
        supabase
          .from('team_seasons')
          .select('id, status, display_name, age_group, seasons ( name ), teams ( name, club_id )')
          .eq('id', seasonId)
          .maybeSingle(),
        listRoster(seasonId, 'all'),
        getTeamSeasonWritableState(seasonId),
      ]);
      if (cancelled) return;
      if (tsErr) {
        setError(tsErr.message);
        setLoading(false);
        return;
      }
      if (!ts) {
        setError('Saison nicht gefunden.');
        setLoading(false);
        return;
      }
      const team = Array.isArray(ts.teams) ? ts.teams[0] : ts.teams;
      const season = Array.isArray(ts.seasons) ? ts.seasons[0] : ts.seasons;
      const displayName =
        formatTeamSeasonContextLabel({
          displayName: String(ts.display_name ?? '').trim() || null,
          ageGroup: ts.age_group ? String(ts.age_group) : null,
          teamName: team?.name ? String(team.name) : null,
          seasonName: season?.name ? String(season.name) : null,
          status: String(ts.status ?? 'active'),
        }) ||
        'Saison';
      setMeta({
        clubId:team?.club_id??null,
        displayName,
        status: String(ts.status ?? 'active'),
        ageGroup: ts.age_group ? String(ts.age_group) : null,
      });
      setWritableMessage('error' in writable ? writable.error : writable.writable ? null : writable.message);
      if (roster.error) setError(roster.error);
      setPlayers(roster.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  const groups = useMemo(() => {
    const active = players.filter((p) => p.status !== 'paused' && p.status !== 'archived' && p.is_active !== false);
    const paused = players.filter((p) => p.status !== 'archived' && (p.status === 'paused' || p.is_active === false));
    const left = players.filter((p) => p.status === 'archived');
    return { active, paused, left };
  }, [players]);

  if (!allowed) return <Navigate to="/manager" replace />;
  if (!seasonId) return <Navigate to="/manager/saisons" replace />;

  const archived = meta ? isSeasonArchived(meta.status) : false;
  const canEdit = workMode === 'platform_admin' && backendRole?.trim().toLowerCase() === 'admin' && !archived && !writableMessage && !loading && !!meta;

  const clearForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setJersey('');
    setPosition('');
    setBirthdate('');
  };

  const editPlayer = (player: RosterPlayer) => {
    setEditingId(player.id);
    requestAnimationFrame(()=>document.getElementById('manager-player-edit')?.scrollIntoView({behavior:'smooth',block:'center'}));
    setFirstName(player.first_name ?? '');
    setLastName(player.last_name ?? '');
    setJersey(player.jersey_number == null ? '' : String(player.jersey_number));
    setPosition(player.position ?? '');
    setBirthdate(player.birthdate?.slice(0, 10) ?? '');
    setNotice(null);
    setError(null);
  };

  const savePlayer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !seasonId || saving) return;
    setError(null);
    setNotice(null);
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setError('Vorname und Nachname sind erforderlich.');
      return;
    }
    const number = jersey.trim() === '' ? null : Number(jersey);
    if (number != null && (!Number.isSafeInteger(number) || number <= 0)) {
      setError('Bitte eine positive ganze Rückennummer eingeben.');
      return;
    }
    if (number != null && players.some((p) => p.id !== editingId && p.jersey_number === number && p.status !== 'archived')) {
      setError(`Rückennummer ${number} ist bereits vergeben.`);
      return;
    }
    setSaving(true);
    try {
      const writable = await getTeamSeasonWritableState(seasonId);
      if ('error' in writable || !writable.writable) {
        setError('error' in writable ? writable.error : writable.message);
        return;
      }
      if (editingId) {
        const result = await updateRosterPlayerSeasonFields({
          playerId: editingId, teamSeasonId: seasonId, firstName: first, lastName: last,
          jerseyNumber: number, position: position.trim() || null,
        });
        if (!result.ok) {
          setError(result.error ?? 'Spieler konnte nicht gespeichert werden.');
          return;
        }
        const { error: profileError } = await supabase.from('player_profiles').upsert(
          { player_id: editingId, birthdate: birthdate || null, updated_at: new Date().toISOString() },
          { onConflict: 'player_id' },
        );
        if (profileError) {
          setError(`Spieler gespeichert, Geburtsdatum nicht gespeichert: ${profileError.message}`);
          await reloadRoster(seasonId);
          return;
        }
      } else {
        const result = await createRosterPlayer({
          teamSeasonId: seasonId, firstName: first, lastName: last,
          jerseyNumber: number, position: position.trim() || null, birthdateIso: birthdate || null,
        });
        if (result.error) {
          setError(result.error);
          if (result.playerId) await reloadRoster(seasonId);
          return;
        }
      }
      const refreshed = await reloadRoster(seasonId);
      if (!refreshed) return;
      clearForm();
      setNotice('Spieler im Saisonkader gespeichert.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen. Bitte den Kader neu laden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {boothPlayer&&seasonId&&canEdit&&<ManagerPlayerPhotoBooth key={seasonId} seasonId={seasonId} players={players.filter(p=>p.status!=='archived')} initialPlayerId={boothPlayer} remoteSessionId={remoteCameraId} onSaved={async()=>{await reloadRoster(seasonId);}} onClose={()=>setBoothPlayer(null)}/>}
      {seasonId&&canEdit&&remoteControl&&<ManagerPhotoRemoteController seasonId={seasonId} players={players.filter(p=>p.status!=='archived')} onClose={()=>setRemoteControl(false)}/>}
      {seasonId&&canEdit&&remoteCameraId&&!boothPlayer&&players.length>0&&<section className="rounded-2xl border border-red-200 bg-white p-4"><h2 className="text-lg font-bold">Kamera-Handy für die Fotobox</h2><p className="my-3 text-sm">Dieses Handy fotografiert, das iPad steuert. Nach dem Verbinden Kamerazugriff erlauben und diese Ansicht geöffnet lassen. Auf beiden Geräten dasselbe Manager-Konto verwenden.</p><button type="button" onClick={()=>openBooth(players.find(p=>p.status!=='archived')?.id??players[0].id)} className="min-h-12 rounded-xl bg-red-700 p-3 font-bold text-white">Kamera mit iPad verbinden</button></section>}
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          <Link to="/manager/saisons" className="hover:text-red-700">
            Saisonen
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {meta?.displayName ?? 'Saisonkader'}
        </h1>
        {meta ? (
          <p className="mt-1 text-[14px] text-slate-500">
            {getSeasonStatusLabel(meta.status)}
            {meta.ageGroup ? ` · ${meta.ageGroup}` : ''}
          </p>
        ) : null}
      </header>

      {seasonId ? <Link to={`/app/team?teamSeason=${encodeURIComponent(seasonId)}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800">In App ansehen →</Link> : null}
      {archived ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
          Du siehst eine abgeschlossene Saison. Der Kader bleibt historisch lesbar und wird nicht
          verändert.
        </div>
      ) : null}
      {writableMessage && !archived ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">{writableMessage}</p>
      ) : null}



      {canEdit && seasonId ? <ManagerOefbRosterPreview key={`oefb-roster:${seasonId}`} seasonId={seasonId} onSaved={() => { void reloadRoster(seasonId); }} /> : null}

      {canEdit && !editingId ? <ManagerNewRosterPlayer key={`new-player:${seasonId}`} seasonId={seasonId} onSaved={() => { void reloadRoster(seasonId); }} /> : null}
      {canEdit && editingId ? (
        <form id="manager-player-edit" onSubmit={(event) => void savePlayer(event)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
          <h2 className="text-[16px] font-semibold text-slate-900">{editingId ? 'Spieler bearbeiten' : 'Spieler zum Kader hinzufügen'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-medium text-slate-700">Vorname *<input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Nachname *<input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Rückennummer<input type="number" min="1" step="1" value={jersey} onChange={(e) => setJersey(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Position<input value={position} onChange={(e) => setPosition(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Geburtsdatum (optional)<input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          </div>
          <p className="text-[12px] text-slate-500">Das Spielerfoto kann später im Spielerprofil ergänzt werden.</p>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-red-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{saving ? 'Speichern…' : editingId ? 'Änderungen speichern' : 'Spieler anlegen'}</button>
            {editingId ? <button type="button" onClick={clearForm} disabled={saving} className="text-[13px] font-semibold text-slate-600">Abbrechen</button> : null}
          </div>
        </form>
      ) : null}

      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">{notice}</p> : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-[13px] text-slate-400">Kader wird geladen…</p> : null}

      {!loading && players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-[13px] text-slate-500">
          Keine Spieler in dieser Saison zugeordnet.
        </p>
      ) : null}

      {canEdit && seasonId&&players.some(p=>p.status!=='archived')?<section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">Spieler-Fotobox</h2><p className="my-2 text-sm text-slate-600">Porträt oder Torjubel direkt aufnehmen, prüfen und als Spielerfoto übernehmen. Mit Schablone und Vereinsvorschau.</p><button type="button" onClick={()=>{openBooth(players.find(p=>p.status!=='archived')!.id);}} className="min-h-11 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white">Kamera öffnen · Spieler-Fotobox</button><button type="button" onClick={()=>{if(canSwitchPhoto()){setGlobalPhoto(false);setPhotoDirty(false);setRemoteControl(true);window.scrollTo({top:0,behavior:'smooth'});}}} className="ml-2 mt-2 min-h-11 rounded-xl border border-red-700 px-4 py-2 font-semibold text-red-700">iPad-Fernsteuerung · QR-Code</button></section>:null}
      {canEdit && seasonId?<ManagerRosterPhotos key={`team-photo:${seasonId}`} seasonId={seasonId} onSaved={()=>setNotice('Mannschaftsfoto gespeichert.')}/>:null}
      {canEdit && players.length>0 && meta?.clubId ? <section id="roster-photo-editor" className="scroll-mt-40"><button type="button" onClick={()=>{if(!canSwitchPhoto())return;setPhotoEditingId(null);setGlobalPhoto(!globalPhoto);}} className="mb-3 min-h-11 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-red-700">{globalPhoto?'Fotoeditor schließen':'Spielerfotos gestalten'}</button>{globalPhoto&&<ManagerClubPhotoTemplate key={`${seasonId}:${photoEditingId??'team'}`} clubId={meta.clubId} seasonId={seasonId!} onDirtyChange={setPhotoDirty} onBusyChange={setPhotoBusy} initialPlayerId={photoEditingId??undefined} initialScope={photoEditingId?'player':'team'} onSaved={()=>{void reloadRoster(seasonId!);}}/>}</section>:null}
      {(
        [
          ['Aktiv', groups.active],
          ['Pausiert', groups.paused],
          ['Ausgeschieden / archiviert', groups.left],
        ] as const
      ).map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-800">
              {label} ({list.length})
            </h2>
            <ul className="space-y-2">
              {list.map((p) => (
                <li
                  key={p.id}
                  className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-lg"><span className="block" style={{transform:`rotate(${p.photo_layout?.rotation??p.photo_layout_default?.rotation??0}deg)`}}><OefbPlayerPhoto src={p.cutout_url || p.avatar_url} name={p.display_name} className="h-10 w-10" /></span></span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{p.display_name}</p>
                      <p className="text-[12px] text-slate-500">
                        {p.jersey_number != null ? `#${p.jersey_number}` : 'ohne Nr.'}
                        {p.position ? ` · ${p.position}` : ''}
                      </p>
                      <p className="mt-1 text-[12px] text-slate-600">
                        {oefbIds[p.id] ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="font-medium text-emerald-700">ÖFB verknüpft · ID {oefbIds[p.id]}</span>
                            <a href={`https://www.oefb.at/Profile/Spieler/${encodeURIComponent(oefbIds[p.id])}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-red-700 underline">ÖFB-Profil öffnen</a>
                          </span>
                        ) : <span className="text-amber-700">ÖFB-ID fehlt</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    {canEdit&&p.status!=='archived'?<button type="button" onClick={()=>{openBooth(p.id);}} className="min-h-11 text-[12px] font-semibold text-red-700">Foto aufnehmen</button>:null}
                    {canEdit ? <button type="button" onClick={() => {if(!canSwitchPhoto())return;setPhotoEditingId(p.id);setGlobalPhoto(true);requestAnimationFrame(()=>document.getElementById('roster-photo-editor')?.scrollIntoView({behavior:'smooth',block:'start'}));}} className="text-[12px] font-semibold text-red-700">Foto gestalten</button> : null}
                    {canEdit ? <button type="button" onClick={() => editPlayer(p)} className="text-[12px] font-semibold text-red-700">Bearbeiten</button> : null}
                    <Link to={`/app/team?teamSeason=${encodeURIComponent(seasonId??'')}&player=${encodeURIComponent(p.id)}`} className="text-[12px] font-semibold text-red-700">Profil</Link>
                  </div>

                  {canEdit ? <div className="w-full border-t border-slate-100 pt-1"><ManagerRosterPlayerActions
                    key={`${seasonId}:${p.id}`} seasonId={seasonId} playerId={p.id} name={p.display_name} removed={p.status === 'archived'}
                    onDone={(message, failed) => {
                      setError(failed ? message : null); setNotice(failed ? null : message);
                      if (!failed) { if (editingId === p.id) clearForm(); void reloadRoster(seasonId); }
                    }}
                  /></div> : null}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
      {(canEdit || (!archived && !writableMessage && !loading && !!meta && ['trainer','co_trainer','head_coach'].includes(effectiveRole))) ? <ManagerOefbPlayerAssignments key={`oefb-assignments:${seasonId}:${reportGameId??'all'}`} seasonId={seasonId} gameId={reportGameId&&/^\d{1,12}$/.test(reportGameId)?reportGameId:undefined} onSaved={() => { void reloadRoster(seasonId); }} /> : null}
    </div>
  );
}
