import React from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import {Home,ClipboardList,Plus,MessageCircle,Settings2} from 'lucide-react';
import './marketManagerNav.css';
export function MarketManagerNav({clubId,section,mode}:{clubId:string;section:string;mode?:string|null}){
 const root='/vereinsmarkt-manager/'+encodeURIComponent(clubId);
 const active=['administration','listings','members','rights','teams','cash'].includes(section)?'administration':section==='personal'?(mode==='requests'?'requests':mode==='create'?'create':'mine'):'home';
 const items=[{id:'home',label:'Start',Icon:Home,to:root},{id:'mine',label:'Meine Inserate',Icon:ClipboardList,to:root+'?section=personal&mode=mine'},{id:'create',label:'Inserieren',Icon:Plus,to:root+'?section=personal&mode=create'},{id:'requests',label:'Nachrichten',Icon:MessageCircle,to:root+'?section=personal&mode=requests'},{id:'administration',label:'Verwaltung',Icon:Settings2,to:root+'?section=administration'}];
 const frame=<div className="market-manager-nav-viewport"><nav className="market-manager-nav" aria-label="Vereinsmarkt-Manager-Navigation">{items.map(({id,label,Icon,to})=><Link key={id} to={to} aria-current={active===id?'page':undefined} className={id==='create'?'vm-nav-create':undefined}><span className="vm-nav-icon"><Icon size={24} strokeWidth={1.9} aria-hidden="true"/></span><span>{label}</span></Link>)}</nav></div>;
 return typeof document==='undefined'||!document.body?frame:createPortal(frame,document.body);
}
