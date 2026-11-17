import React from 'react';
import {Link} from 'react-router-dom';
export const tournamentAuthTarget=(next:string|null|undefined)=>next&&/^\/turnier-meldung\/[a-f0-9]{64}$/.test(next)?next:null;
export function TournamentAuthBrand({back}:{back:string}){
 return <Link to={back} className="mb-5 flex items-center gap-3 text-white"><img src="/turnier-app/clock-icon-192.png" width="42" height="42" alt=""/><span><strong className="block text-lg">Spielzeit Turniere</strong><small className="text-white/60">Zurück zur Mannschaftsmeldung</small></span></Link>;
}
