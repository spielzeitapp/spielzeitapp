// Display only: release readiness always comes from the protected release planner.
function checkPresentation(check, status) {
 let url;
 try { const candidate=new URL(status?.target_url); if(candidate.protocol==='https:'&&candidate.hostname==='vercel.com')url=candidate.href; } catch {}
 const limited=check.state==='failure'&&url&&new URL(url).searchParams.get('upgradeToPro')==='build-rate-limit';
 const label=limited?'Vercel-Build-Limit erreicht':check.state==='success'?'Prüfung erfolgreich':check.state==='pending'?'Bereitstellung wird noch geprüft':check.state==='missing'?'Prüfung fehlt noch':'Bereitstellungsprüfung fehlgeschlagen';
 const help=limited?'Vercel erlaubt momentan keine weitere Bereitstellung für dieses Projekt. Sobald wieder Kapazität frei ist, die Bereitstellung in Vercel erneut starten und danach hier „Stand prüfen“ drücken. Die bisherige LIVE-Version wird dadurch nicht ersetzt.':check.state==='success'?null:check.state==='pending'?'Bitte warten und danach „Stand prüfen“ drücken.':check.state==='missing'?'In Vercel prüfen, ob die Bereitstellung für diesen TEST-Stand gestartet wurde. Danach hier erneut prüfen.':'Die Ursache in Vercel ansehen. Nach der Behebung die Bereitstellung erneut starten und hier „Stand prüfen“ drücken.';
 return {...check,label,help,...(url?{detailsUrl:url}:{})};
}
module.exports={checkPresentation};
