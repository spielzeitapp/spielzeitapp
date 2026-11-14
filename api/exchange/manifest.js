// Separate PWA identity: saved marketplace opens the guest route, never /app.
module.exports=function(req,res){
 const club=String(req.query.club||'').toLowerCase();
 if(req.method!=='GET')return res.status(405).end();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(club))return res.status(400).end();
 res.setHeader('Content-Type','application/manifest+json');res.setHeader('Cache-Control','no-cache');
 return res.status(200).json({id:`/marktplatz/${club}`,name:'Vereinsmarkt · SpielzeitApp',short_name:'Vereinsmarkt',start_url:`/marktplatz/${club}`,scope:'/marktplatz/',display:'standalone',background_color:'#08080b',theme_color:'#08080b',icons:[{src:'/vereinsmarkt/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/vereinsmarkt/icon-512.png',sizes:'512x512',type:'image/png'}]});
};
