import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseCommunicationAccess} from '../src/lib/communicationAccessModel.ts';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('access switches stay independent and fail closed',()=>{
 for(const speaker of [false,true])for(const music of [false,true])assert.deepEqual(parseCommunicationAccess({speaker,music}),{speaker,music,admin:false});
 assert.deepEqual(parseCommunicationAccess({speaker:'true',music:1}),{speaker:false,music:false,admin:false});
 assert.deepEqual(parseCommunicationAccess({speaker:true,music:true},true),{speaker:false,music:false,admin:false});
 assert.deepEqual(parseCommunicationAccess(null),{speaker:false,music:false,admin:false});
});
test('routes, navigation, audio and KI all check the permission',()=>{
 const page=read('src/manager/ManagerSpeakerStudioPage.tsx');
 assert.ok(page.includes('musicOnly?access.music:access.speaker'));
 assert.ok(page.includes('{access.music?<DjAudioPanel'));
 assert.ok(read('src/manager/components/ManagerSidebar.tsx').includes("item.id === 'speaker-studio' ? communicationAccess.speaker"));
 assert.ok(read('src/manager/mobile/ManagerMobileMorePage.tsx').includes('communicationAccess.music?'));
 const edge=read('supabase/functions/generate-club-communications/index.ts');
 assert.ok(edge.indexOf('get_my_communication_access')<edge.indexOf("fetch('https://api.openai.com"));
 assert.ok(edge.includes('access?.speaker!==true'));
});
test('database policies do not allow self-grants and restrict speaker drafts',()=>{
 const sql=read('supabase/migrations/20261014165449_club_communication_access.sql');
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('with check(public.can_manage_club_venues(club_id))'));
 assert.ok(sql.includes('as restrictive for all to authenticated'));
 assert.ok(sql.includes("public.can_use_club_communications(t.club_id,'music')"));
 assert.ok(!sql.toLowerCase().includes('security definer'));
});
