import type { CSSProperties } from 'react';
export type TeamPhotoLayout = { photo_zoom: number; photo_position_x: number; photo_position_y: number; photo_brightness: number };
export const DEFAULT_TEAM_PHOTO_LAYOUT: TeamPhotoLayout = { photo_zoom:100,photo_position_x:50,photo_position_y:50,photo_brightness:100 };
export const TEAM_PHOTO_LAYOUT_COLUMNS = 'photo_zoom,photo_position_x,photo_position_y,photo_brightness';
export function normalizeTeamPhotoLayout(value?: Partial<TeamPhotoLayout>|null):TeamPhotoLayout {
 const number=(v:unknown,fallback:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
 return {photo_zoom:number(value?.photo_zoom,100,100,220),photo_position_x:number(value?.photo_position_x,50,0,100),photo_position_y:number(value?.photo_position_y,50,0,100),photo_brightness:number(value?.photo_brightness,100,50,150)};
}
export function teamPhotoImageStyle(value?:Partial<TeamPhotoLayout>|null):CSSProperties {
 const l=normalizeTeamPhotoLayout(value),extra=(l.photo_zoom-100)/100;
 return {objectPosition:`${l.photo_position_x}% ${l.photo_position_y}%`,transform:`translate(${(50-l.photo_position_x)*extra}%, ${(50-l.photo_position_y)*extra}%) scale(${l.photo_zoom/100})`,transformOrigin:'center',filter:`brightness(${l.photo_brightness/100})`};
}
