import {ManagerPlayerPhotoEditor} from './ManagerPlayerPhotoEditor';
import {DEFAULT_PHOTO_LAYOUT} from '../lib/playerPhotoLayout';
import type {TeamStaffMember} from '../hooks/useTeamStaff';
import React, {useCallback, useState} from 'react';
import {useTeamStaff, staffDisplayName, staffRoleLabelDe} from '../hooks/useTeamStaff';
import {useTrainerStaffEditor} from '../hooks/useTrainerStaffEditor';
import {TrainerStaffFormModal} from '../components/team/TrainerStaffFormModal';
import {ManagerOefbStaffPreview} from './ManagerOefbStaffPreview';
import {OefbPlayerPhoto} from '../components/OefbPlayerPhoto';

/** Shares the app's account-based trainer editor and staff authorization. */
export function ManagerTrainerPhotoPanel({seasonId}: {seasonId: string}) {
  const {staff, loading, error, refetch} = useTeamStaff(seasonId);
  const [design,setDesign]=useState<TeamStaffMember|null>(null);
  const [notice, setNotice] = useState('');
  const afterSave = useCallback(async () => {
    const result = await refetch();
    setNotice(result.error || 'Trainer und Foto gespeichert. Auch in der App sichtbar.');
  }, [refetch]);
  const editor = useTrainerStaffEditor({teamSeasonId: seasonId, onAfterSave: afterSave, automaticCutout: false});
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Trainer und Fotos">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-slate-900">Trainer & Fotos</h3>
      <button type="button" onClick={()=>{setNotice('');editor.openCreateTrainerForm();}} className="min-h-11 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white">Trainer mit Foto hinzufügen</button>
    </div>
    <p className="text-sm text-slate-600">Vorhandenes SpielzeitApp-Konto verwenden, Rolle wählen und Foto hochladen. Ohne Konto zuerst den Trainer per E-Mail einladen. Ein Foto lässt sich auch später ergänzen.</p>
    <ManagerOefbStaffPreview key={seasonId} seasonId={seasonId} staff={staff} onSaved={()=>refetch()}/>
    {loading?<p className="text-sm text-slate-500">Trainer werden geladen…</p>:null}
    {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
    {!loading&&!error&&!staff.length?<p className="text-sm text-slate-500">Noch kein Trainer zugeordnet.</p>:null}
    <div className="space-y-2">{staff.map(member=><div key={member.user_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
      <OefbPlayerPhoto src={member.avatar_url || member.cutout_url} name={staffDisplayName(member)} />
      <div className="min-w-0 flex-1"><p className="font-semibold">{staffDisplayName(member)}</p><p className="text-sm text-slate-500">{staffRoleLabelDe(member.role)}</p></div>
      <button type="button" onClick={()=>setDesign(member)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Foto gestalten</button>
      <button type="button" onClick={()=>{setNotice('');editor.openEditTrainerForm(member);}} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Foto / Trainer bearbeiten</button>
    </div>)}</div>
    {design?<ManagerPlayerPhotoEditor key={seasonId+design.user_id} trainer seasonId={seasonId} player={{id:design.user_id,team_season_id:seasonId,first_name:design.first_name,last_name:design.last_name,display_name:staffDisplayName(design),avatar_url:design.avatar_url,cutout_url:design.cutout_url??null,photo_layout:design.photo_layout??null,photo_layout_default:{...DEFAULT_PHOTO_LAYOUT,source:design.cutout_url?'cutout':'original'},jersey_number:null,position:null,birthdate:null,is_active:true,status:'active',is_laz_player:false,is_injured:false,injured_since:null,injured_until:null}} onClose={()=>setDesign(null)} onSaved={()=>{setDesign(null);void afterSave();}}/>:null}
    {notice?<p role="status" className="text-sm text-slate-700">{notice}</p>:null}
    <TrainerStaffFormModal
      isOpen={editor.showTrainerForm} mode={editor.trainerFormMode}
      form={editor.trainerForm} editingTrainer={editor.editingTrainer}
      saving={editor.trainerSaving} avatarUploading={editor.trainerAvatarUploading}
      cutoutUploading={editor.trainerCutoutUploading}
      avatarPreviewUrl={editor.trainerAvatarPreviewUrl} cutoutPreviewUrl={editor.trainerCutoutPreviewUrl}
      avatarObjectUrl={editor.trainerAvatarObjectUrl} cutoutObjectUrl={editor.trainerCutoutObjectUrl}
      formError={editor.trainerFormError} onClose={editor.closeTrainerForm}
      onSubmit={editor.handleTrainerFormSubmit}
      onFormChange={patch=>editor.setTrainerForm(old=>({...old,...patch}))}
      onAvatarFile={editor.handleTrainerAvatarFilePick} onCutoutFile={editor.handleTrainerCutoutFilePick}
      onImageValidationError={editor.setTrainerFormError}
      onAccountEmailBlur={()=>void editor.handleTrainerAccountEmailBlur()}
    />
  </section>;
}
