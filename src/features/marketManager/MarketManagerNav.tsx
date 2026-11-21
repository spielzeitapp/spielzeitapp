import React from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import {Home,ClipboardList,Users,Shirt,Wallet} from 'lucide-react';
import './marketManagerNav.css';
type Permissions={market?:boolean;teams?:boolean;cash?:boolean};
export function managerNavigation(clubId:string,permissions:Permissions={}){
 const root='/vereinsmarkt-manager/'+encodeURIComponent(clubId);
 return [{id:'home',label:'Übersicht',Icon:Home,to:root},
 ...(permissions.market?[{id:'listings',label:'Inserate',Icon:ClipboardList,to:root+'?section=listings'},{id:'members',label:'Mitglieder',Icon:Users,to:root+'?section=members'}]:[]),
 ...(permissions.teams?[{id:'teams',label:'Teams',Icon:Shirt,to:root+'?section=teams'}]:[]),
 ...(permissions.cash?[{id:'cash',label:'Teamkassa',Icon:Wallet,to:root+'?section=cash'}]:[])];
}
export function MarketManagerNav({clubId,section,inline=false,permissions={}}:{clubId:string;section:string;mode?:string|null;inline?:boolean;permissions?:Permissions}){
 const items=managerNavigation(clubId,permissions);
 const frame=<div className="market-manager-nav-viewport"><nav className="market-manager-nav" style={{gridTemplateColumns:`repeat(${items.length},minmax(0,1fr))`}} aria-label="Vereinsmarkt-Manager-Navigation">{items.map(({id,label,Icon,to})=><Link key={id} to={to} aria-current={(section===id||(id==='home'&&['administration','rights'].includes(section)))?'page':undefined}><span className="vm-nav-icon"><Icon size={24} strokeWidth={1.9} aria-hidden="true"/></span><span>{label}</span></Link>)}</nav></div>;
 return inline||typeof document==='undefined'||!document.body?frame:createPortal(frame,document.body);
}
