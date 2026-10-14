export type CommunicationAccess={speaker:boolean;music:boolean;admin:boolean};
export const NO_COMMUNICATION_ACCESS:CommunicationAccess={speaker:false,music:false,admin:false};
export function parseCommunicationAccess(data:unknown,error=false):CommunicationAccess{
 if(error||!data||typeof data!=='object')return {...NO_COMMUNICATION_ACCESS};
 const value=data as Record<string,unknown>;
 return {speaker:value.speaker===true,music:value.music===true,admin:value.admin===true};
}
