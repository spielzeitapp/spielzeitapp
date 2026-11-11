import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {buildSync}=require('esbuild');
const tmp=mkdtempSync(join(tmpdir(),'tournament-notices-'));
try {
  const file=join(tmp,'notices.cjs');
  buildSync({entryPoints:['src/lib/tournamentEventChanges.ts'],bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent'});
  const {tournamentChangeNotice:notice,tournamentCanBeCanceled:canCancel}=require(file);
  const before={starts_at:'2026-11-27T16:00:00Z',meeting_at:'2026-11-27T15:15:00Z',location:'Halle A'};
  assert.equal(notice(before,{...before},'U12'),null);
  assert.equal(notice(before,{...before,starts_at:'2026-11-27T17:00:00+01:00',meeting_at:'2026-11-27T15:15:30Z',location:' Halle A '},'U12'),null);
  const moved=notice(before,{...before,starts_at:'2026-11-28T16:00:00Z'},'U12');
  assert.equal(moved.title,'Turnier verschoben');assert(moved.body.includes('27.11.2026'));assert(moved.body.includes('28.11.2026'));assert(moved.body.includes('17:00'));
  const venue=notice(before,{...before,location:'Halle B'},'U12');assert.equal(venue.title,'Turnier geändert');assert(venue.body.includes('Halle A → Halle B'));assert(!venue.body.includes('Beginn:'));
  const meetup=notice(before,{...before,meeting_at:'2026-11-27T15:45:00Z'},'U12');assert(meetup.body.includes('16:15'));assert(meetup.body.includes('16:45'));
  assert(notice(before,{...before,meeting_at:null},'U12').body.includes('noch offen'));
  const all=notice(before,{starts_at:'2026-11-28T16:00:00Z',meeting_at:'2026-11-28T15:15:00Z',location:'Halle B'},'U12');assert.equal(all.body.split('\n').length,4);
  assert.equal(canCancel('upcoming',[]),true);assert.equal(canCancel('upcoming',[{is_own_team:true,match_status:'upcoming'}]),true);
  for(const status of ['live','finished','canceled'])assert.equal(canCancel(status,[]),false);
  for(const match_status of ['live','finished'])assert.equal(canCancel('upcoming',[{match_status}]),false);
  assert.equal(canCancel('upcoming',[{is_own_team:false,match_status:'finished'}]),true);
  console.log('PASS: unchanged saves stay silent, date/time/meetup/venue changes include before/after in Vienna time, cancellation protects started own games.');
} finally {rmSync(tmp,{recursive:true,force:true});}
