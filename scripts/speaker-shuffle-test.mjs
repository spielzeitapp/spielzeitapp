import test from 'node:test';
import assert from 'node:assert/strict';
import {shuffleAudio,validateAudioSetup} from '../src/lib/speakerAudio.ts';
test('shuffle preserves every entry and does not mutate playlist',()=>{
 const ids=['a','b','c','d'];const mixed=shuffleAudio(ids,()=>0);
 assert.deepEqual(ids,['a','b','c','d']);assert.notDeepEqual(mixed,ids);
 assert.deepEqual([...mixed].sort(),[...ids].sort());
 assert.deepEqual(shuffleAudio([],()=>0),[]);assert.deepEqual(shuffleAudio(['a'],()=>0),['a']);
 assert.deepEqual(shuffleAudio(['a','a','b'],()=>0).sort(),['a','a','b']);
});
test('shuffle setting is retained safely in offline setup',()=>{
 assert.equal(validateAudioSetup({shuffle:true},'team').shuffle,true);
 assert.equal(validateAudioSetup({shuffle:'true'},'team').shuffle,false);
});
