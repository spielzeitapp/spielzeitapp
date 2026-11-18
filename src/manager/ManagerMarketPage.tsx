import React from 'react';
import {useSearchParams} from 'react-router-dom';
import {useManagerClubModules} from './ManagerClubModulesContext';
import {MarketTeamSettings} from '../features/club/MarketTeamSettings';
export function ManagerMarketPage(){
 const {clubId:contextClubId}=useManagerClubModules();const [params]=useSearchParams();const clubId=params.get('club')||contextClubId;
 return <div className="mx-auto max-w-5xl p-5"><h1 className="mb-5 text-2xl font-bold">Vereinsmarkt verwalten</h1>{clubId?<MarketTeamSettings key={clubId} clubId={clubId}/>:<p>Wähle zuerst oben einen Verein beziehungsweise eine Mannschaft oder öffne den Vereinsmarkt in den Vereinseinstellungen.</p>}</div>;
}
