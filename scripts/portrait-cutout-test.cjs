const assert=require('node:assert/strict'),esbuild=require('esbuild'),Module=require('node:module');
(async()=>{
 const built=await esbuild.build({entryPoints:['src/lib/portraitAlpha.ts','src/lib/removePortraitBackground.ts'],outdir:'/tmp/portrait-cutout-test',bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'fixture',setup(b){b.onResolve({filter:/playerPhotoDisplay$/},()=>({path:'display',namespace:'fixture'}));b.onResolve({filter:/^@mediapipe\/tasks-vision$/},()=>({path:'segmenter',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='display'?'export const playerPhotoDisplayUrl=s=>s;':'export const FilesetResolver={forVisionTasks:async()=>({})};export const ImageSegmenter={createFromOptions:async(v,options)=>{globalThis.cutoutOptions=options;return {segment:(c,callback)=>callback({confidenceMasks:globalThis.cutoutMasks}),close:()=>globalThis.closes++}}};',loader:'js'}));}}]});
 const modules={};for(const file of built.outputFiles){const name=file.path.split('/').at(-1).replace('.js','');const mod=new Module(process.cwd()+'/cutout-test.cjs');mod.paths=module.paths;mod._compile(file.text,process.cwd()+'/cutout-test.cjs');modules[name]=mod.exports;}
 const {portraitAlpha}=modules.portraitAlpha;
 const w=21,h=21,confidence=new Float32Array(w*h).fill(.05);
 for(let y=3;y<18;y++)for(let x=3;x<18;x++)confidence[y*w+x]=.99;
 for(let y=3;y<18;y++)confidence[y*w+3]=.4;
 const normal=portraitAlpha(confidence,w,h),strong=portraitAlpha(confidence,w,h,'strong');
 assert.equal(normal[10*w+10],255,'Certain clothing and skin interiors stay opaque');assert.equal(normal[10*w+3],0,'Uncertain fringe is removed');assert.equal(normal[0],0);
 assert(strong.every((v,i)=>v<=normal[i]),'Stronger cleanup cannot add background');assert.throws(()=>portraitAlpha(confidence,2,2));
 const soft=new Float32Array(9).fill(.75);assert(portraitAlpha(soft,3,3,'strong')[4]<portraitAlpha(soft,3,3)[4]);
 const nan=new Float32Array(9).fill(NaN);assert(portraitAlpha(nan,3,3).every(v=>v===0));
 // Real runtime wrapper with a synthetic six-class model response.
 let revoked=0,matte;global.closes=0;
 global.URL.createObjectURL=()=>'/temporary';global.URL.revokeObjectURL=()=>revoked++;
 global.Image=class{naturalWidth=21;naturalHeight=21;decode=async()=>{}};
 global.fetch=async()=>({ok:true,blob:async()=>new Blob(['photo'])});
 global.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:data=>{matte=data;}}),toBlob:cb=>cb(new Blob(['cutout'],{type:'image/png'}))})};
 const bg=Float32Array.from(confidence,x=>1-x);global.cutoutMasks=Array.from({length:6},(_,i)=>({width:w,height:h,getAsFloat32Array:()=>i===0?bg:new Float32Array(w*h)}));
 const remove=modules.removePortraitBackground.removePortraitBackground;
 const blob=await remove('/portrait.jpg');assert.equal(blob.type,'image/png');assert(global.cutoutOptions.baseOptions.modelAssetPath.includes('selfie_multiclass_256x256/float32/1/'));
 assert.equal(matte.data[(10*w+10)*4+3],255,'Background class is inverted, not used as foreground');assert.equal(matte.data[3],0);assert.equal(global.closes,1);assert.equal(revoked,1);
 global.cutoutMasks=[global.cutoutMasks[0]];await assert.rejects(()=>remove('/portrait.jpg'),/Keine Person erkannt/);assert.equal(global.closes,2);assert.equal(revoked,2,'Failure closes runtime and temporary image');
 console.log('PASS cutout: multiclass background interpretation, uncertain fringe cleanup, strong mode, opaque interior, mask validation and runtime cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
