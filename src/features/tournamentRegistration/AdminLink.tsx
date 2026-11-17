import React from 'react';
import {Link} from 'react-router-dom';
import {useTournamentScreenAccess} from '../../components/tournament/TournamentScreenAccess';
import {isStagingApp} from '../../lib/appEnvironment';
export function TournamentRegistrationAdminLink({eventId}:{eventId:string}){
 const {access}=useTournamentScreenAccess(eventId);
 if(!(isStagingApp()||import.meta.env.DEV)||!access.canManage)return null;
 return <Link to={'/turnier-verwaltung/'+eventId} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border sz-club-surface px-4 font-bold">Mannschaften einladen & Meldungen prüfen</Link>;
}
