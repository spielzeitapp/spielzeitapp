import {MarketThemeToggle} from './MarketThemeToggle';
import React, {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import './marketAuth.css';
export function MarketAuthBrand({back,manager=false}:{back:string;manager?:boolean}){
 useEffect(()=>{
  let frame=0;
  const reveal=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const field=document.activeElement;
    if(!(field instanceof HTMLElement)||!field.matches('input,textarea,select'))return;
    const page=field.closest<HTMLElement>('.market-auth-page');
    if(!page)return;
    const rect=field.getBoundingClientRect(),bounds=page.getBoundingClientRect();
    const top=bounds.top+24,bottom=bounds.bottom-24;
    if(rect.bottom>bottom)page.scrollTop+=rect.bottom-bottom;
    else if(rect.top<top)page.scrollTop+=rect.top-top;
   });
  };
  document.addEventListener('focusin',reveal);
  window.visualViewport?.addEventListener('resize',reveal);
  window.visualViewport?.addEventListener('scroll',reveal);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('focusin',reveal);window.visualViewport?.removeEventListener('resize',reveal);window.visualViewport?.removeEventListener('scroll',reveal);};
 },[]);
 return <><div className="market-auth-top"><Link className="market-auth-back" to={back}><ArrowLeft size={18}/>{manager?'Zum Vereinsmarkt-Manager':'Zurück zum Vereinsmarkt'}</Link><MarketThemeToggle/></div><div className="market-auth-brand"><img src={manager?'/vereinsmarkt-manager/shield-m-180.png':'/vereinsmarkt/icon-180.png'} width="64" height="64" alt=""/><div><strong>Vereins<span>markt</span></strong><small>{manager?'Manager · powered by SpielzeitApp':'powered by SpielzeitApp'}</small></div></div></>;}
