import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url),{build}=require('esbuild'),tmp=mkdtempSync(join(tmpdir(),'bench-jersey-'));
try {
 const file=join(tmp,'test.cjs');
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React from 'react';
 import {renderToStaticMarkup} from 'react-dom/server';
 import assert from 'node:assert/strict';
 import {LeibchenJersey} from './src/components/match/LeibchenJersey';
 for(const pitchStyleBack of [true,false]) {
  const missing=renderToStaticMarkup(<LeibchenJersey {...{lastName:undefined,number:null,position:undefined,variant:'field',pitchStyleBack} as any}/>);
  assert(missing.includes('<svg'));
  const bench=renderToStaticMarkup(<LeibchenJersey lastName="Gamböck" number={4} position="" variant="field" size="compact" showBackPrint={false} pitchStyleBack={pitchStyleBack}/>);
  assert(bench.includes('GAMBÖCK'));assert(bench.includes('Nummer 4'));
  const keeper=renderToStaticMarkup(<LeibchenJersey lastName="Gasteiner" number={1} position="TW" variant="goalkeeper"/>);
  assert(keeper.includes('Position TW'));
 }
 console.log('PASS: tournament bench renders, missing position/name cannot crash, goalkeeper remains correct');
 `},bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent'});require(file);
}finally{rmSync(tmp,{recursive:true,force:true})}
