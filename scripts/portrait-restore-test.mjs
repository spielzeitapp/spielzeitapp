import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
async function bundle(path){const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {matchingPortraitFrame,restorePortraitStroke}=await bundle('src/lib/portraitRetouch.ts');
assert(matchingPortraitFrame(700,1000,1400,2000));assert(!matchingPortraitFrame(700,1000,1000,1000));assert(!matchingPortraitFrame(0,1000,1400,2000));
const {portraitAlpha}=await bundle('src/lib/portraitAlpha.ts');
const confidence=new Float32Array(25).fill(.05);confidence[12]=.75;confidence[13]=.6;
const gentle=portraitAlpha(confidence,5,5,'gentle'),normal=portraitAlpha(confidence,5,5,'normal');
assert.equal(gentle[12],255,'narrow certain clothing is not eroded away');assert(gentle[13]>0,'uncertain sleeve edge is retained');assert.equal(normal[12],0,'original erosion would remove a narrow protrusion');assert.equal(gentle[0],0,'certain background stays transparent');
let operations=[];
function context(){return {lineWidth:1,globalCompositeOperation:'source-over',save(){operations.push(['save']);},restore(){operations.push(['restore']);},beginPath(){operations.push(['path']);},moveTo(x,y){operations.push(['move',x,y]);},lineTo(){},arc(x,y,r){operations.push(['arc',x,y,r]);},fill(){},stroke(){operations.push(['erase',this.globalCompositeOperation]);},clip(){operations.push(['clip']);},clearRect(){operations.push(['clear']);},drawImage(source,...rest){operations.push(['draw',source,...rest]);},translate(){},rotate(v){operations.push(['rotate',v]);}};}
const genuineOriginal={id:'genuine-original'};restorePortraitStroke(context(),{size:2,points:[{x:.1,y:.2},{x:.3,y:.2}]},1000,600,genuineOriginal);
assert(operations.filter(x=>x[0]==='arc').length>2,'connected brush path has no gaps');const drawIndex=operations.findIndex(x=>x[0]==='draw');assert.equal(operations[drawIndex-1][0],'clip');assert.equal(operations[drawIndex][1],genuineOriginal);assert.deepEqual(operations[drawIndex].slice(2),[0,0,1000,600]);assert.equal(operations.at(-1)[0],'restore');
const old={fetch:globalThis.fetch,bitmap:globalThis.createImageBitmap,document:globalThis.document};
let requests=[],bitmapCount=0,closed=0,failOriginal=false,mismatch=false,applied=[];
globalThis.fetch=async url=>{requests.push(url);return {ok:!(failOriginal&&String(url).includes('original')),blob:async()=>new Blob(['fixture'],{type:'image/png'})};};
globalThis.createImageBitmap=async()=>{bitmapCount++;return {width:mismatch&&bitmapCount%2===0?600:1000,height:600,close(){closed++;}};};
const canvas={width:1000,height:600,getContext:()=>context(),getBoundingClientRect:()=>({left:0,top:0,width:500,height:300}),setPointerCapture(){},toBlob(cb,type){cb(new Blob(['result'],{type}));}};
globalThis.document={activeElement:{focus(){}},createElement:()=>({width:0,height:0,getContext:()=>context(),toBlob(cb,type){cb(new Blob(['result'],{type}));}})};
const {PortraitCutoutRetouch}=await bundle('src/manager/PortraitCutoutRetouch.tsx');let root;
async function mount(originalSource='https://example.test/original.jpg',rotation=0){await act(async()=>{root=create(React.createElement(PortraitCutoutRetouch,{source:'https://example.test/cutout.png',originalSource,rotation,onApply:b=>applied.push(b),onClose(){}}),{createNodeMock:el=>el.type==='canvas'?canvas:el.props.role==='dialog'?{focus(){},querySelectorAll(){return[];}}:null});await new Promise(r=>setImmediate(r));});}
const button=label=>root.root.findAllByType('button').find(n=>n.children.join('')===label);
const e=(x,y)=>({button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y,currentTarget:canvas,preventDefault(){}});
try{
 await mount();assert.equal(closed,2,'both bitmaps released');assert.equal(button('Aus Original wiederherstellen').props.disabled,false);assert.equal(applied.length,0,'loading never edits saved photo');
 await act(async()=>button('Aus Original wiederherstellen').props.onClick());assert.equal(root.root.findByType('canvas').props['aria-label'],'Fehlende Bildteile aus Original wiederherstellen');
 operations=[];await act(async()=>{const c=root.root.findByType('canvas');c.props.onPointerDown(e(100,100));c.props.onPointerMove(e(140,100));c.props.onPointerUp(e(140,100));});assert(operations.some(x=>x[0]==='clip'),'restoration clips original pixels to brush');assert.equal(button('Korrektur in Vorschau übernehmen').props.disabled,false);
 operations=[];await act(async()=>button('Rückgängig').props.onClick());assert(!operations.some(x=>x[0]==='clip'),'undo rebuilds the untouched cutout');assert.equal(button('Korrektur in Vorschau übernehmen').props.disabled,true);
 await act(async()=>{const c=root.root.findByType('canvas');c.props.onPointerDown(e(100,100));c.props.onPointerCancel(e(100,100));});assert.equal(button('Korrektur in Vorschau übernehmen').props.disabled,true);
 await act(async()=>{const c=root.root.findByType('canvas');c.props.onPointerDown(e(100,100));c.props.onPointerUp(e(100,100));});await act(async()=>button('Korrektur in Vorschau übernehmen').props.onClick());assert.equal(applied[0].type,'image/png');await act(async()=>root.unmount());
 await mount(undefined,270);assert.equal(button('Aus Original wiederherstellen').props.disabled,false);assert.equal(canvas.width,600);assert.equal(canvas.height,1000);await act(async()=>root.unmount());
 bitmapCount=0;mismatch=true;await mount();assert.equal(button('Aus Original wiederherstellen').props.disabled,true,'mismatched crop cannot silently stretch source');assert.equal(button('Radierer').props.disabled,false);assert(root.root.findAllByProps({role:'status'}).some(x=>x.children.join('').includes('unterschiedliche Bildausschnitte')));await act(async()=>root.unmount());
 mismatch=false;failOriginal=true;await mount();assert.equal(button('Aus Original wiederherstellen').props.disabled,true);assert.equal(button('Radierer').props.disabled,false,'failed original leaves eraser usable');await act(async()=>root.unmount());
 failOriginal=false;await mount(null);assert.equal(button('Aus Original wiederherstellen').props.disabled,true,'no original disables restoration');await act(async()=>root.unmount());
 console.log('PASS: gentle sleeves, original-pixel brush, connected path and clipping, undo/cancel, rotated originals, PNG preview, mismatched crop and unavailable-original fallback.');
}finally{globalThis.fetch=old.fetch;globalThis.createImageBitmap=old.bitmap;globalThis.document=old.document;}
