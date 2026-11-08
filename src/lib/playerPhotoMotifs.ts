import {supabase} from './supabaseClient';
import {uploadStorageObject} from './storageUpload';
import type {PlayerPhotoLayout} from './playerPhotoLayout';
export const PHOTO_STEPS=['portrait','matchday','celebration'] as const;
export type PhotoStep=typeof PHOTO_STEPS[number];
export type MotifPurpose=Exclude<PhotoStep,'portrait'>;
export const PHOTO_LABELS:Record<PhotoStep,string>={portrait:'Profilfoto',matchday:'Spieltagfoto',celebration:'Jubelfoto'};
export type PlayerPhotoMotif={team_season_id:string;player_id:string;purpose:MotifPurpose;original_url:string;cutout_url:string|null;layout:PlayerPhotoLayout|null;revision:string};
export async function listPlayerPhotoMotifs(seasonId:string):Promise<PlayerPhotoMotif[]> {
 const {data,error}=await supabase.from('player_photo_motifs').select('*').eq('team_season_id',seasonId);
 if(error)throw Error('Zusatzfotos konnten nicht geladen werden. '+error.message);
 return data??[];
}
export async function uploadPlayerMotif(seasonId:string,playerId:string,purpose:MotifPurpose,file:Blob,cutout=false):Promise<string> {
 const path=`${seasonId}/${playerId}.${purpose}.${crypto.randomUUID()}.${cutout?'png':'jpg'}`;
 const {error}=await uploadStorageObject('player-avatars',path,file,{upsert:false,contentType:cutout?'image/png':'image/jpeg',metadata:{entity_type:'player',player_id:playerId,team_season_id:seasonId,media_kind:cutout?'hero':'avatar'}});
 if(error)throw Error(error.message);
 return supabase.storage.from('player-avatars').getPublicUrl(path).data.publicUrl;
}
export async function savePlayerPhotoMotif(value:Omit<PlayerPhotoMotif,'revision'>,expected:string|null):Promise<PlayerPhotoMotif> {
 const next={...value,revision:crypto.randomUUID()};
 const query=expected?supabase.from('player_photo_motifs').update(next).eq('team_season_id',value.team_season_id).eq('player_id',value.player_id).eq('purpose',value.purpose).eq('revision',expected):supabase.from('player_photo_motifs').insert(next);
 const {data,error}=await query.select('*').maybeSingle();
 if(error||!data)throw Error(error?.code==='23505'||!error?'Das Foto wurde inzwischen geändert. Bitte Fotos neu laden.':error.message);
 return data as PlayerPhotoMotif;
}
