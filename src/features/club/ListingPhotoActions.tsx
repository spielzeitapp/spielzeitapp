import React,{useState} from 'react';
import {ArrowLeft,Share2} from 'lucide-react';
export function ListingPhotoActions({onBack,save,shareUrl}:{onBack:()=>void;save:React.ReactNode;shareUrl?:string}){
 const [message,setMessage]=useState('');
 const share=async()=>{if(!shareUrl)return;try{const url=new URL(shareUrl,window.location.origin).href;if(navigator.share)await navigator.share({title:'Vereinsmarkt',url});else{await navigator.clipboard.writeText(url);setMessage('Link kopiert');}}catch(error){if((error as Error).name!=='AbortError')setMessage('Teilen derzeit nicht möglich.');}};
 return <div className="listing-photo-actions"><button type="button" aria-label="Zur Übersicht" onClick={onBack}><ArrowLeft size={22}/></button><div>{shareUrl&&<button type="button" aria-label="Inserat teilen" onClick={()=>void share()}><Share2 size={20}/></button>}{save}</div>{message&&<span role="status">{message}</span>}</div>;
}
