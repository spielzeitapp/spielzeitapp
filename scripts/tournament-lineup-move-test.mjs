import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url),{build}=require('esbuild'),tmp=mkdtempSync(join(tmpdir(),'lineup-move-'));
try {
 const file=join(tmp,'test.cjs');
 await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
 import assert from 'node:assert/strict';
 import {moveTournamentLineupPlayer as move} from './src/lib/tournamentLineupMove';
 const slots={GK:'g',LB:'a',RB:'b',CM:null};
 assert.deepEqual(move(slots,'a','RB'),{GK:'g',LB:'b',RB:'a',CM:null});
 assert.deepEqual(move(slots,'c','RB'),{GK:'g',LB:'a',RB:'c',CM:null});
 assert.deepEqual(move(slots,'a','CM'),{GK:'g',LB:null,RB:'b',CM:'a'});
 assert.deepEqual(move(slots,'g',null),{GK:null,LB:'a',RB:'b',CM:null});
 assert.deepEqual(move(slots,'a','LB'),slots);
 assert.equal(slots.LB,'a','draft input stays immutable');
 console.log('PASS field swap, bench replacement, empty position, return to bench, same slot and immutability');
 `},bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent'});require(file);
}finally{rmSync(tmp,{recursive:true,force:true})}
