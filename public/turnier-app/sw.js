// Independent spectator scope. No authenticated app caches or account subscriptions.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{}}catch{}
 const url=typeof payload.data?.url==='string'&&/^\/turnier-app\/[a-f\d-]{36}$/i.test(payload.data.url)?payload.data.url:'/turnier-app/';
 event.waitUntil(self.registration.showNotification(String(payload.title||'Spielzeit Turniere').slice(0,100),{body:String(payload.body||'Es gibt Neuigkeiten zu deinem Turnier.').slice(0,300),icon:'/turnier-app/clock-icon-192.png',badge:'/badge-72.png',tag:typeof payload.tag==='string'?payload.tag.slice(0,100):'turnier',data:{url}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const raw=event.notification.data?.url;
 const path=typeof raw==='string'&&/^\/turnier-app\/[a-f\d-]{36}$/i.test(raw)?raw:'/turnier-app/';
 const url=new URL(path,self.location.origin).href;
 event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const own=clients.find(c=>c.url.startsWith(self.location.origin+'/turnier-app/'));if(own){await own.navigate(url);await own.focus()}else await self.clients.openWindow(url)})());
});
