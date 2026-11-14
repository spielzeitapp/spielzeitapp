import {defaultClubProfileDesign,type ClubProfileDesign} from './clubProfileDesign';
import type {PlayerPhotoLayout} from './playerPhotoLayout';

/** A draft only: retain the chosen background, photo source and logo visibility. */
export function rohrbachPortraitLayout(layout:PlayerPhotoLayout,base?:ClubProfileDesign|null):PlayerPhotoLayout {
 const design=layout.profileDesign??base??defaultClubProfileDesign('square');
 return {...layout,zoom:95,x:55,y:50,profileDesign:{
  name:{...design.name,visible:true,x:5,y:82,size:6.5,align:'left'},
  number:{...design.number,visible:true,x:88,y:6,size:13,align:'center',opacity:100},
  logo:{...design.logo,x:5,y:5,size:28,align:'left'},
  team:{...design.team,visible:true,x:5,y:25,size:4,align:'left',showName:false,showSeason:true},
 }};
}
