import {useLayoutEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {isMarketThemeRoute,useMarketTheme} from './marketTheme';
import './marketTheme.css';
/** Theme is scoped to market routes, including native dialogs in the top layer. */
export function MarketThemeSync(){
 const {pathname,search}=useLocation();const {theme}=useMarketTheme();const active=isMarketThemeRoute(pathname,search);
 useLayoutEffect(()=>{
  const root=document.documentElement;
  if(!active){root.removeAttribute('data-market-theme');return;}
  const meta=document.querySelector('meta[name="theme-color"]');const before=meta?.getAttribute('data-market-original-color')??meta?.getAttribute('content');
  root.setAttribute('data-market-theme',theme);meta?.setAttribute('content',theme==='light'?'#f6f5f7':'#100b0f');
  return()=>{root.removeAttribute('data-market-theme');if(meta){if(before===null||before===undefined)meta.removeAttribute('content');else meta.setAttribute('content',before);}};
 },[active,theme]);
 return null;
}
