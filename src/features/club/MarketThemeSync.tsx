import React,{useLayoutEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {isMarketThemeRoute,useMarketTheme} from './marketTheme';
import './marketTheme.css';
/** Theme is scoped to market routes, including native dialogs in the top layer. */
export function MarketThemeSync(){
 const {pathname,search}=useLocation();const {theme}=useMarketTheme();const active=isMarketThemeRoute(pathname,search);
 const shell=/^\/(?:vereinsmarkt|marktplatz)\/[0-9a-f-]{36}\/?$/i.test(pathname);
 useLayoutEffect(()=>{const root=document.documentElement;if(shell)root.setAttribute('data-market-shell','');else root.removeAttribute('data-market-shell');window.dispatchEvent(new Event('spz-viewport-recover'));return()=>root.removeAttribute('data-market-shell');},[shell]);
 useLayoutEffect(()=>{
  const root=document.documentElement;
  if(!active){root.removeAttribute('data-market-theme');return;}
  const meta=document.querySelector('meta[name="theme-color"]');const before=meta?.getAttribute('data-market-original-color')??meta?.getAttribute('content');
  // Preserve the native status-bar mode of the current installed window.
  // Removing SpielzeitApp's black-translucent meta during an SPA route change
  // changes WebKit's viewport geometry. The standalone market entry already
  // omits this meta in markt.html, so it needs no runtime removal here.
  root.setAttribute('data-market-theme',theme);meta?.setAttribute('content',theme==='light'?'#ffffff':'#08080b');
  return()=>{root.removeAttribute('data-market-theme');if(meta){if(before===null||before===undefined)meta.removeAttribute('content');else meta.setAttribute('content',before);}};
 },[active,theme]);
 // WebKit samples real fixed edge elements for native chrome tint. Keep this
 // separate from the scrolling shell and replace its layer on appearance changes.
 // It paints only the edge; it must not change viewport or navigation geometry.
 return active?<div key={theme} aria-hidden="true" data-market-chrome-edge="" style={{position:'fixed',top:0,left:0,right:0,height:'max(1px, env(safe-area-inset-top, 0px))',backgroundColor:theme==='light'?'#ffffff':'#08080b',pointerEvents:'none',zIndex:2147483646}}/>:null;
}
