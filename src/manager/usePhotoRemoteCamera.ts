import {useEffect,useRef,useState} from 'react';
import {claimRemoteCamera,readRemoteSession,updateRemoteSession,acknowledgeRemoteCommand,remoteCommandMatches,remotePhotoThumbnail,type RemoteState,type RemoteCommand} from '../lib/playerPhotoRemote';
export function usePhotoRemoteCamera(sessionId:string|undefined,seasonId:string,status:Omit<RemoteState,'original'|'cutout'|'handled'>,file:File|null,cutout:Blob|null,handle:(command:RemoteCommand)=>Promise<void>){
 const [error,setError]=useState(''),[connected,setConnected]=useState(false),[ended,setEnded]=useState(false),[handled,setHandled]=useState<string|null>(null);
 const [preview,setPreview]=useState<{id:string|null;original?:string;cutout?:string}>({id:null});
 const latest=useRef(status),handler=useRef(handle),snapshot=useRef<RemoteState>({...status});
 latest.current=status;handler.current=handle;
 snapshot.current={...status,handled,...(preview.id===status.draftId?{original:preview.original,cutout:preview.cutout}:{})};
 useEffect(()=>{
  let active=true;setPreview({id:null});if(!sessionId||!file||!status.draftId)return;
  void Promise.all([remotePhotoThumbnail(file),cutout?remotePhotoThumbnail(cutout):Promise.resolve(undefined)]).then(([original,transparent])=>{if(active)setPreview({id:status.draftId,original,cutout:transparent});}).catch(()=>{if(active)setError('Die iPad-Vorschau konnte nicht übertragen werden. Aufnahme am Handy prüfen.');});
  return()=>{active=false;};
 },[sessionId,status.draftId,file,cutout]);
 useEffect(()=>{
  setConnected(false);setEnded(false);setError('');setHandled(null);if(!sessionId)return;
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;
  const cameraId=crypto.randomUUID();let claimed=false,processed:string|null=null;
  const release=()=>updateRemoteSession(sessionId,{camera_id:null,camera_seen_at:null,command:null,ack:null,state:null},cameraId).catch(()=>{});
  const poll=async()=>{
   if(!active)return;
   try{
    const row=await readRemoteSession(sessionId);if(!active)return;
    if(row.team_season_id!==seasonId||row.camera_id!==cameraId)throw Object.assign(Error('Kamera-Verbindung wurde beendet. Bitte am iPad neu koppeln.'),{remoteEnded:true});
    const command=row.command;
    if(command&&command.id!==row.ack&&command.id!==processed){
     if(await acknowledgeRemoteCommand(sessionId,cameraId,command)){
      processed=command.id;
      if(active){
       if(remoteCommandMatches(command,latest.current)){
        // Keep heartbeat/polling alive while the phone segments or saves a photo.
        void(async()=>{try{await handler.current(command);}catch(e){if(active)setError((e as Error).message);}finally{if(active)setHandled(command.id);}})();
       }else{setError('Die Ansicht war nicht mehr aktuell. Bitte am iPad den aktuellen Schritt prüfen und erneut wählen.');setHandled(command.id);}
      }
     }
    }
    if(!active)return;
    await updateRemoteSession(sessionId,{camera_seen_at:new Date().toISOString(),state:snapshot.current},cameraId);
    if(active)setConnected(true);
   }catch(e){if(active){setConnected(false);setError((e as Error).message);if((e as {remoteEnded?:boolean}).remoteEnded){setEnded(true);active=false;}}}
   finally{if(active)timer=setTimeout(poll,1200);}
  };
  void(async()=>{try{const row=await readRemoteSession(sessionId);if(row.team_season_id!==seasonId)throw Error('Der QR-Code gehört zu einer anderen Mannschaft.');await claimRemoteCamera(sessionId,cameraId);claimed=true;if(!active){void release();return;}setConnected(true);void poll();}catch(e){if(active){setError((e as Error).message);setEnded(true);}}})();
  return()=>{active=false;if(timer)clearTimeout(timer);if(claimed)void release();};
 },[sessionId,seasonId]);
 return{connected,error,ended};
}
