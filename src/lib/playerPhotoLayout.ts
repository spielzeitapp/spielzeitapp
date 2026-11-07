export type PlayerPhotoLayout = {background:'blue-left'|'blue-right'|'black'|'nsg-art';source:'original'|'cutout';zoom:number;x:number;y:number;nameX:number;nameY:number;numberX:number;numberY:number;numberSize?:number;profileDesign?:import('./clubProfileDesign').ClubProfileDesign};
export const DEFAULT_PHOTO_LAYOUT:PlayerPhotoLayout={background:'blue-left',source:'original',zoom:100,x:50,y:50,nameX:28,nameY:85,numberX:88,numberY:8,numberSize:44};
export function photoBackground(background:PlayerPhotoLayout['background']):string {
 if(background==='nsg-art')return 'url("/backgrounds/nsg-portrait.webp") center / cover no-repeat, #030407';
 return background==='black'?'#030407':`radial-gradient(ellipse 70% 100% at ${background==='blue-left'?'0%':'100%'} 46%, rgb(var(--club-primary-rgb, 22 74 157) / 0.48), transparent 80%), #030407`;
}
