/** Visibility only. Database staff and club checks remain authoritative. */
export function canShowSpeakerStudio(isTrainerMode:boolean,availableModes:readonly string[]):boolean{
 return !isTrainerMode||availableModes.includes('platform_admin')||availableModes.includes('club_admin');
}
