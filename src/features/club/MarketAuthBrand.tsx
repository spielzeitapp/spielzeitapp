import {MarketThemeToggle} from './MarketThemeToggle';
import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import './marketAuth.css';
export function MarketAuthBrand({back}:{back:string}){return <><div className="market-auth-top"><Link className="market-auth-back" to={back}><ArrowLeft size={18}/>Zurück zum Vereinsmarkt</Link><MarketThemeToggle/></div><div className="market-auth-brand"><img src="/vereinsmarkt/icon-180.png" width="64" height="64" alt=""/><div><strong>Vereins<span>markt</span></strong><small>powered by SpielzeitApp</small></div></div></>;}
