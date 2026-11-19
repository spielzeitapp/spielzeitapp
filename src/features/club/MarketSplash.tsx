import React from 'react';
import './marketSplash.css';
/** Covers bootstrap, auth and first catalog load; no fabricated delay. */
export function MarketSplash({manager=false}:{manager?:boolean}={}){return <div className="market-splash" role="status" aria-label={manager?'Vereinsmarkt-Manager wird vorbereitet':'Vereinsmarkt wird vorbereitet'}><img src={manager?'/vereinsmarkt-manager/shield-m-192.png':'/vereinsmarkt/icon-180.png'} alt="" width="108" height="108"/><h1>Vereinsmarkt{manager&&<span className="market-splash-manager-label">Manager</span>}</h1><p>{manager?'Dein Verein. Deine Aufgaben.':'Alle Teams. Ein Verein.'}</p><div className="market-splash-track" aria-hidden="true"/><small>powered by SpielzeitApp</small></div>;}
