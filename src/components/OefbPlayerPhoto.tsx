import React, {useState} from 'react';
export function OefbPlayerPhoto({src, name, className='h-14 w-14'}:{src?:string|null;name:string;className?:string}) {
  const [failed,setFailed]=useState<string|null>(null);
  let display=src;
  if(src){try{const url=new URL(src);if(url.protocol==='https:'&&url.host==='vereine.oefb.at'&&url.pathname.startsWith('/netzwerk/imagedownload/'))display='/api/oefb/table?view=photo&url='+encodeURIComponent(src);}catch{/* Keep local/storage sources. */}}
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${className}`}>
    {display&&failed!==display?<img key={display} src={display} alt={name} referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={()=>setFailed(display!)} />:<span className="px-1 text-center text-xs text-slate-500">{src?'Foto nicht ladbar':'Kein Foto'}</span>}
  </div>;
}
