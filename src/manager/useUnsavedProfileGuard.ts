import {useContext,useEffect,useRef} from 'react';
import {UNSAFE_NavigationContext,UNSAFE_LocationContext} from 'react-router-dom';
const message='Die Vereinsvorlage enthält ungespeicherte Änderungen. Seite trotzdem verlassen? Der Entwurf bleibt in diesem Browser zwischengespeichert.';
/** BrowserRouter uses a navigator rather than the data-router blocker API. */
export function useUnsavedProfileGuard(dirty:boolean){
 const location=useContext(UNSAFE_LocationContext)?.location;
 const pathRef=useRef(location?.pathname);pathRef.current=location?.pathname;
 const context=useContext(UNSAFE_NavigationContext),dirtyRef=useRef(dirty);dirtyRef.current=dirty;
 useEffect(()=>{
 const unload=(e:BeforeUnloadEvent)=>{if(!dirtyRef.current)return;e.preventDefault();e.returnValue='';};
 window.addEventListener('beforeunload',unload);
 const navigator=context?.navigator;
 const originals=navigator?{push:navigator.push,replace:navigator.replace,go:navigator.go}:null;
 const wrappers:Record<string,unknown>={};
 if(navigator&&originals){for(const key of ['push','replace','go'] as const){
 const fn=(...args:unknown[])=>{const target=args[0];const path=typeof target==='string'?target.split(/[?#]/)[0]:(target as {pathname?:string})?.pathname;const stays=key!=='go'&&pathRef.current&&path===pathRef.current;if(stays||!dirtyRef.current||window.confirm(message))return (originals[key] as Function).apply(navigator,args);};
 (wrappers as any)[key]=fn;(navigator as any)[key]=fn;
 }}
 return()=>{window.removeEventListener('beforeunload',unload);if(navigator&&originals)for(const key of ['push','replace','go'] as const)if((navigator as any)[key]===(wrappers as any)[key])(navigator as any)[key]=originals[key];};
 },[context?.navigator]);
}
