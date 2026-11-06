export type ProfileElement='name'|'number'|'logo'|'team';
export type ElementDesign={visible:boolean;x:number;y:number;size:number;color:string;opacity:number;align:'left'|'center'|'right'};
export type ClubProfileDesign=Record<ProfileElement,ElementDesign>;
export function defaultClubProfileDesign(template:'wide'|'square'):ClubProfileDesign{
 const el=(x:number,y:number,size:number,opacity=100):ElementDesign=>({visible:true,x,y,size,color:'#FFFFFF',opacity,align:'left'});
 return template==='wide'?{name:el(4,79,8),number:el(7,29,32,14),logo:el(78,5,18),team:el(4,6,4)}:{name:el(28,85,7),number:{...el(88,8,12),align:'center'},logo:{...el(78,5,18),visible:false},team:{...el(4,6,4),visible:false}};
}
