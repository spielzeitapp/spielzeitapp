const {unzipSync,strFromU8}=require('fflate');
async function downloadReport(token,id){
 if(!Number.isSafeInteger(id)||id<1)throw Error('Ungültiger Prüfbericht.');
 const response=await fetch(`https://api.github.com/repos/spielzeitapp/spielzeitapp/actions/artifacts/${id}/zip`,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});
 if(response.status!==302)throw Error('Prüfbericht konnte nicht geladen werden.');
 const url=new URL(response.headers.get('location'));
 if(url.protocol!=='https:'||!(url.hostname.endsWith('.blob.core.windows.net')||url.hostname.endsWith('.actions.githubusercontent.com')||url.hostname.endsWith('.githubusercontent.com')||url.hostname.endsWith('.github.com')))throw Error('Ungültige Berichtadresse.');
 const zip=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!zip.ok)throw Error('Prüfbericht konnte nicht geladen werden.');
 const reader=zip.body.getReader();const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000)throw Error('Prüfbericht ist zu groß.');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const files=unzipSync(bytes,{filter:file=>file.name==='report.json'&&file.originalSize<=256000});
 if(!files['report.json'])throw Error('Prüfbericht fehlt.');return JSON.parse(strFromU8(files['report.json']));
}
module.exports={downloadReport};
