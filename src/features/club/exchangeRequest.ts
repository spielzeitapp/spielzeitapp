import {supabase} from '../../lib/supabaseClient';
/** Keep the composed request intact until it has actually been stored, including existing chats. */
export async function submitExchangeRequest({listingId,userId,existingThreadId,text}:{listingId:string;userId:string;existingThreadId?:string;text:string}):Promise<{threadId:string;sent:boolean}>{
 let threadId=existingThreadId;let created=false;const message=text.trim();
 if(!threadId){
  const inserted=await supabase.from('exchange_threads').insert({listing_id:listingId,requester_id:userId}).select('id').single();
  if(inserted.error?.code==='23505'){
   const existing=await supabase.from('exchange_threads').select('id').eq('listing_id',listingId).eq('requester_id',userId).single();
   if(existing.error||!existing.data?.id)throw Error('Anfrage konnte nicht geöffnet werden. Bitte erneut versuchen.');
   threadId=existing.data.id;
  }else{
   if(inserted.error||!inserted.data?.id)throw Error('Anfrage konnte nicht angelegt werden. Ist der Artikel noch verfügbar?');
   threadId=inserted.data.id;created=true;
  }
 }
 if(!threadId)throw Error('Anfrage konnte nicht geöffnet werden.');
 if(!created&&!message)return {threadId,sent:false};
 const sent=await supabase.from('exchange_messages').insert({thread_id:threadId,sender_id:userId,body:message||'Hallo! Ist der Artikel noch verfügbar?'});
 if(sent.error)throw Error('Die Nachricht konnte nicht gesendet werden. Dein Text bleibt stehen. Bitte erneut versuchen.');
 return {threadId,sent:true};
}
