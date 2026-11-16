// Separate public spectator scope. No authenticated app caches or push subscription.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
