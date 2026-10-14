import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowSpeakerStudio} from '../src/manager/speakerWorkspaceAccess.ts';
test('admins keep speaker navigation while using trainer view',()=>{
 assert.equal(canShowSpeakerStudio(true,['trainer','platform_admin']),true);
 assert.equal(canShowSpeakerStudio(true,['trainer','club_admin']),true);
 assert.equal(canShowSpeakerStudio(true,['trainer']),false);
 assert.equal(canShowSpeakerStudio(false,['platform_admin']),true);
});
