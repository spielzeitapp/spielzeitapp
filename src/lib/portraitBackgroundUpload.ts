import {supabase} from './supabaseClient';
import {uploadStorageObject} from './storageUpload';

export function validatePortraitBackground(file:File):void {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Bitte JPG, PNG oder WebP auswählen.');
 if(!file.size||file.size>5*1024*1024)throw Error('Das Hintergrundbild darf maximal 5 MB groß sein.');
}

export async function uploadPortraitBackground(seasonId:string,file:File):Promise<string> {
 validatePortraitBackground(file);
 const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
 const path=`${seasonId}/backgrounds/${crypto.randomUUID()}.${ext}`;
 const {error}=await uploadStorageObject('team-photos',path,file,{upsert:false,contentType:file.type,cacheControl:'31536000'});
 if(error)throw Error(error.message);
 const url=supabase.storage.from('team-photos').getPublicUrl(path).data.publicUrl;
 if(!url)throw Error('Das Hintergrundbild konnte nicht gespeichert werden.');
 return url;
}
