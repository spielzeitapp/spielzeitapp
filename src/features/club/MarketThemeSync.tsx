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
  const apple=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');const beforeApple=apple?.getAttribute('data-market-original-style')??apple?.getAttribute('content');
  root.setAttribute('data-market-theme',theme);apple?.setAttribute('content',theme==='light'?'default':'black-translucent');meta?.setAttribute('content',theme==='light'?'#f6f5f7':'#100b0f');
  return()=>{root.removeAttribute('data-market-theme');if(meta){if(before===null||before===undefined)meta.removeAttribute('content');else meta.setAttribute('content',before);}if(apple){if(beforeApple===null||beforeApple===undefined)apple.removeAttribute('content');else apple.setAttribute('content',beforeApple);}};
 },[active,theme]);
 return null;
}
