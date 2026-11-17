import {useEffect,useState} from 'react';
import {useAuth} from '../../auth/AuthProvider';
import {useSession} from '../../auth/useSession';
import {isUserOnboardingComplete} from '../../lib/pushOnboardingGate';
/** UI shortcut only: actual app routes continue to enforce their own access checks. */
export function useMarketAppSwitch():boolean{
 const {user}=useAuth();
 const {user:sessionUser,loading,backendRole,previewRole,memberships,membershipError}=useSession();
 const [readyFor,setReadyFor]=useState('');
 useEffect(()=>{
  let current=true;setReadyFor('');
  if(!user||loading||membershipError||sessionUser?.id!==user.id)return()=>{current=false;};
  void isUserOnboardingComplete({userId:user.id,backendRole,previewRole,memberships,user})
   .then(ready=>{if(current)setReadyFor(ready?user.id:'');})
   .catch(()=>{if(current)setReadyFor('');});
  return()=>{current=false;};
 },[user,sessionUser?.id,loading,backendRole,previewRole,memberships,membershipError]);
 return !!user&&!loading&&!membershipError&&sessionUser?.id===user.id&&readyFor===user.id;
}
