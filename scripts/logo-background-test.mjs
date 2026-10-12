import assert from 'node:assert/strict';
import { removeOuterWhiteBackground } from '../lib/logoBackground.mjs';
const image={width:7,height:7,data:new Uint8Array(7*7*4).fill(255)};
// Closed red crest outline, white inner area.
for(let y=1;y<=5;y++)for(let x=1;x<=5;x++)if(x===1||x===5||y===1||y===5){const i=(y*7+x)*4;image.data[i]=180;image.data[i+1]=0;image.data[i+2]=0;}
assert.equal(removeOuterWhiteBackground(image),24);
assert.equal(image.data[3],0);assert.equal(image.data[(3*7+3)*4+3],255);assert.equal(image.data[(1*7+1)*4],180);
const before=new Uint8Array(image.data);assert.equal(removeOuterWhiteBackground(image),0);assert.deepEqual(image.data,before);
const black={width:3,height:3,data:new Uint8Array(36)};for(let i=3;i<36;i+=4)black.data[i]=255;
assert.equal(removeOuterWhiteBackground(black),0);
const white={width:3,height:3,data:new Uint8Array(36).fill(255)};assert.equal(removeOuterWhiteBackground(white),0);
console.log('PASS outer white removed, inner white/color preserved, existing transparency untouched, nonwhite/ambiguous image kept');
