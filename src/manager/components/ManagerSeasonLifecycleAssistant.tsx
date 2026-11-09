import React from 'react';
import {SeasonLifecycleAssistant} from '../../components/season/SeasonLifecycleAssistant';
import {useManagerWorkMode} from '../ManagerWorkModeContext';
import {useLocation} from 'react-router-dom';
export function ManagerSeasonLifecycleAssistant({seasonId}:{seasonId?:string}) {
 const {workMode,supportSession}=useManagerWorkMode();
 const {pathname}=useLocation();
 if(pathname==='/manager/saisons'||pathname.startsWith('/manager/saisons/'))return null;
 return <SeasonLifecycleAssistant seasonId={workMode==='platform_admin'&&!supportSession?undefined:seasonId}/>;
}
