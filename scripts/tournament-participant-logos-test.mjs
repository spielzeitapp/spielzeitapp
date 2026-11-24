import {createRequire}from'node:module';import{mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
const require=createRequire(import.meta.url),{build}=require('esbuild'),dir=mkdtempSync(join(tmpdir(),'participant-logos-'));
try{const file=join(dir,'test.cjs');await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import assert from 'node:assert/strict';import {filterOfficialTeamVariants, mergeTournamentParticipantLogos as merge} from './src/lib/tournamentParticipantLogos';
import {getClubLogo} from './src/lib/teamLogos';
const names=['NSG Rohrbach','ASK Peham Wilhelmsburg','FC BW Linz','FC Hertha Wels','USC Markersdorf','SPS Harland'];
const analysis={teams:names.map(teamName=>({teamName,logoUrl:'https://tournej.com/data/images/'+encodeURIComponent(teamName)+'.png'}))};
const rows=merge(names.map(team_name=>({team_name})),analysis);
assert.equal(rows[0].logo_url,null);assert.equal(rows[1].logo_url,null);
assert(rows.slice(2, 5).every(r=>r.logo_url));
assert.equal(rows[5].logo_url,null);
assert.equal(getClubLogo('SPS Harland U12'),'/logos/sc-harland.png');
assert.equal(merge([{team_name:'FC BW Linz',logo_url:'https://example.org/custom.png'}],analysis)[0].logo_url,'https://example.org/custom.png');
assert.equal(merge([{team_name:'Unknown'}],null)[0].logo_url,null);
const base = 'ASK Peham Wilhelmsburg';
const current = [base+' schwarz', base+' weiß', 'FC BW Linz', 'SPS Harland', 'USC Markersdorf', 'FC Hertha Wels', 'NSG Rohrbach', 'Selecao NÖ'];
const withOld = [base, ...current].map(team_name => ({team_name}));
assert.deepEqual(filterOfficialTeamVariants(withOld, current).map(row=>row.team_name),current);
assert.deepEqual(filterOfficialTeamVariants(withOld, [base,...current]),withOld);
assert.deepEqual(filterOfficialTeamVariants(withOld, []),withOld);
assert.deepEqual(filterOfficialTeamVariants(withOld.slice(0,2), current),withOld.slice(0,2));
console.log('PASS participant logos reach Match Center, known crests and custom logos remain, missing analysis safe');
`},bundle:true,platform:'node',format:'cjs',outfile:file,define:{'import.meta.env':'{"BASE_URL":"/"}'},logLevel:'silent'});require(file);}finally{rmSync(dir,{recursive:true,force:true})}
