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

const {removeOuterDarkBackground}=await import('../lib/logoBackground.mjs');
const darkLogo={width:14,height:14,data:new Uint8Array(14*14*4)};for(let i=0;i<14*14;i++){darkLogo.data.set([8,8,8,255],i*4);}
// White lettering/crest and colored sponsor must remain byte-for-byte intact.
for(let y=4;y<10;y++)for(let x=4;x<10;x++)darkLogo.data.set(x<7?[255,255,255,255]:[40,150,70,255],(y*14+x)*4);
assert.ok(removeOuterDarkBackground(darkLogo)>0);assert.deepEqual([...darkLogo.data.slice((5*14+5)*4,(5*14+5)*4+4)],[255,255,255,255]);assert.deepEqual([...darkLogo.data.slice((5*14+8)*4,(5*14+8)*4+4)],[40,150,70,255]);assert.equal(darkLogo.data[3],0);
const once=new Uint8Array(darkLogo.data);assert.equal(removeOuterDarkBackground(darkLogo),0);assert.deepEqual(darkLogo.data,once);
const transparent={width:10,height:10,data:new Uint8Array(400)};assert.equal(removeOuterDarkBackground(transparent),0);
const touches={width:10,height:10,data:new Uint8Array(400)};for(let i=3;i<400;i+=4)touches.data[i]=255;touches.data.set([255,255,255,255],(2*10+2)*4);const beforeTouch=new Uint8Array(touches.data);assert.equal(removeOuterDarkBackground(touches),0);assert.deepEqual(touches.data,beforeTouch);
console.log('PASS dark logo opt-in: connected backdrop removed, white/green preserved, transparent and nonempty rims untouched.');
