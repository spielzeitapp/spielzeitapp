export type ProfileElement='name'|'number'|'logo'|'team';
export type ElementDesign={visible:boolean;x:number;y:number;size:number;color:string;opacity:number;align:'left'|'center'|'right';showName?:boolean;showSeason?:boolean};
export type ClubProfileDesign=Record<ProfileElement,ElementDesign>;
export function defaultClubProfileDesign(template:'wide'|'square'):ClubProfileDesign{
 const el=(x:number,y:number,size:number,opacity=100):ElementDesign=>({visible:true,x,y,size,color:'#FFFFFF',opacity,align:'left'});
 return template==='wide'?{name:el(4,79,8),number:el(7,29,32,14),logo:el(78,5,18),team:el(4,6,4)}:{name:el(28,85,7),number:{...el(88,8,12),align:'center'},logo:{...el(78,5,18),visible:false},team:{...el(4,6,4),visible:false}};
}

export function isClubProfileDesign(value:unknown):value is ClubProfileDesign{
 if(!value||typeof value!=='object'||Object.keys(value).length!==4)return false;
 return (['name','number','logo','team'] as const).every(key=>{const e=(value as Record<string,unknown>)[key] as ElementDesign|undefined;
 return Boolean(e&&typeof e==='object'&&Object.keys(e).filter(k=>!['showName','showSeason'].includes(k)).length===7&&(['showName','showSeason'] as const).every(f=>e[f]===undefined||typeof e[f]==='boolean')&&typeof e.visible==='boolean'&&typeof e.color==='string'&&/^#[0-9a-f]{6}$/i.test(e.color)&&['left','center','right'].includes(e.align)&&['x','y','size','opacity'].every(field=>{const n=e[field as 'x'];return typeof n==='number'&&Number.isFinite(n)&&n>=(field==='size'?2:0)&&n<=(field==='size'?50:100);}));});
}
