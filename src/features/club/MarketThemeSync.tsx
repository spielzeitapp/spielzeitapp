import {useLayoutEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {isMarketThemeRoute,useMarketTheme} from './marketTheme';
import './marketTheme.css';
/** Theme is scoped to market routes, including native dialogs in the top layer. */
export function MarketThemeSync(){
 const {pathname,search}=useLocation();const {theme}=useMarketTheme();const active=isMarketThemeRoute(pathname,search);
 const shell=/^\/marktplatz\/[0-9a-f-]{36}\/?$/i.test(pathname);
 useLayoutEffect(()=>{const root=document.documentElement;if(shell)root.setAttribute('data-market-shell','');else root.removeAttribute('data-market-shell');return()=>root.removeAttribute('data-market-shell');},[shell]);
 useLayoutEffect(()=>{
  const root=document.documentElement;
  if(!active){root.removeAttribute('data-market-theme');return;}
  const meta=document.querySelector('meta[name="theme-color"]');const before=meta?.getAttribute('data-market-original-color')??meta?.getAttribute('content');
  const apple=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');const beforeApple=apple?.getAttribute('data-market-original-style')??apple?.getAttribute('content');
  // Legacy iOS status-bar overrides lock installed apps to black/default.
  // Let WebKit derive chrome from the document's current appearance instead.
  apple?.remove();
  root.setAttribute('data-market-theme',theme);meta?.setAttribute('content',theme==='light'?'#ffffff':'#08080b');
  return()=>{root.removeAttribute('data-market-theme');if(meta){if(before===null||before===undefined)meta.removeAttribute('content');else meta.setAttribute('content',before);}if(apple){if(beforeApple===null||beforeApple===undefined)apple.removeAttribute('content');else apple.setAttribute('content',beforeApple);document.head.appendChild(apple);}};
 },[active,theme]);
 return null;
}
