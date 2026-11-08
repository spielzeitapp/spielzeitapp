import {supabase} from './supabaseClient';
import {PHOTO_STEPS,type PhotoStep} from './playerPhotoMotifs';
import type {PlayerPhotoLayout} from './playerPhotoLayout';
export type RemoteAction='capture'|'accept'|'retake'|'select'|'skip';
export type RemoteCommand={id:string;action:RemoteAction;playerId:string;step:PhotoStep;draftId:string|null};
export type RemoteState={playerId:string;step:PhotoStep;ready:boolean;busy:boolean;draftId:string|null;finished:boolean;error:string;notice:string;original?:string;cutout?:string;layout:PlayerPhotoLayout;handled?:string|null};
export type RemoteSession={id:string;team_season_id:string;expires_at:string;camera_id:string|null;camera_seen_at:string|null;command:RemoteCommand|null;ack:string|null;state:RemoteState|null};
const table='player_photo_remote_sessions';
export function isRemoteSessionId(value:string):boolean{return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
export function remoteCommandMatches(command:RemoteCommand,state:RemoteState):boolean{
 if(!command||!isRemoteSessionId(command.id)||!PHOTO_STEPS.includes(command.step)||state.busy||state.finished)return false;
 if(command.action==='select')return !state.draftId&&!command.draftId;
 if(command.playerId!==state.playerId||command.step!==state.step||command.draftId!==state.draftId)return false;
 if(command.action==='capture')return state.ready&&!state.draftId;
 if(command.action==='accept'||command.action==='retake')return Boolean(state.draftId);
 return command.action==='skip'&&!state.draftId;
}
export function remoteCameraOnline(session:RemoteSession):boolean{return Boolean(session.camera_id&&session.camera_seen_at&&Date.now()-Date.parse(session.camera_seen_at)<15000);}
export async function createRemoteSession(seasonId:string):Promise<RemoteSession>{
 const {data,error}=await supabase.from(table).insert({team_season_id:seasonId}).select('*').single();
 if(error||!data)throw Error(error?.message||'Sitzung konnte nicht erstellt werden.');return data as RemoteSession;
}
export async function readRemoteSession(id:string):Promise<RemoteSession>{
 if(!isRemoteSessionId(id))throw Error('Ungültiger Verbindungscode.');
 const {data,error}=await supabase.from(table).select('*').eq('id',id).maybeSingle();
 if(error)throw Error('Verbindung zur Fotobox unterbrochen. Bitte Internetverbindung prüfen.');if(!data)throw Object.assign(Error('Sitzung beendet, abgelaufen oder für dieses Konto nicht verfügbar. Auf beiden Geräten dasselbe Manager-Konto verwenden und bei Bedarf neu koppeln.'),{remoteEnded:true});return data as RemoteSession;
}
export async function updateRemoteSession(id:string,values:Record<string,unknown>,cameraId?:string):Promise<RemoteSession>{
 let q=supabase.from(table).update(values).eq('id',id);if(cameraId)q=q.eq('camera_id',cameraId);
 const {data,error}=await q.select('*').maybeSingle();if(error||!data)throw Error(error?.message||'Verbindung beendet oder abgelaufen.');return data as RemoteSession;
}
export async function claimRemoteCamera(id:string,cameraId:string):Promise<void>{
 const session=await readRemoteSession(id);
 if(remoteCameraOnline(session)&&session.camera_id!==cameraId)throw Error('Es ist bereits eine Kamera verbunden. Diese zuerst schließen oder kurz warten.');
 const q=supabase.from(table).update({camera_id:cameraId,camera_seen_at:new Date().toISOString(),command:null,ack:null,state:null}).eq('id',id);
 const query=session.camera_id?(session.camera_seen_at?q.eq('camera_id',session.camera_id).eq('camera_seen_at',session.camera_seen_at):q.eq('camera_id',session.camera_id).is('camera_seen_at',null)):q.is('camera_id',null);
 const {data,error}=await query.select('id').maybeSingle();if(error||!data)throw Error('Die Kamera wurde inzwischen verbunden. Bitte erneut versuchen.');
}
export async function acknowledgeRemoteCommand(id:string,cameraId:string,command:RemoteCommand):Promise<boolean>{
 const {data,error}=await supabase.from(table).update({ack:command.id}).eq('id',id).eq('camera_id',cameraId).eq('command->>id',command.id).select('id').maybeSingle();
 if(error)throw Error(error.message);return Boolean(data);
}
export async function closeRemoteSession(id:string):Promise<void>{const {error}=await supabase.from(table).delete().eq('id',id);if(error)throw Error(error.message);}
export async function remotePhotoThumbnail(blob:Blob):Promise<string>{
 const url=URL.createObjectURL(blob);try{const image=new Image();image.src=url;await image.decode();
 const scale=Math.min(1,600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Vorschau konnte nicht erstellt werden.');ctx.drawImage(image,0,0,canvas.width,canvas.height);let result=canvas.toDataURL(blob.type==='image/png'?'image/webp':'image/jpeg',.75);while(result.length>350000&&canvas.width>100){canvas.width=Math.round(canvas.width*.7);canvas.height=Math.round(canvas.height*.7);ctx.drawImage(image,0,0,canvas.width,canvas.height);result=canvas.toDataURL(blob.type==='image/png'?'image/webp':'image/jpeg',.7);}return result;
 }finally{URL.revokeObjectURL(url);}
}
