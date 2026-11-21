// Only an offline notice is cached. Never cache editorial APIs or authenticated pages.
const CACHE='bazarsport-mobile-v3';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/mobile/offline.html')));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bazarsport-mobile-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!['/','/index.html','/mobile','/mobile/'].includes(url.pathname)||event.request.mode!=='navigate')return;event.respondWith(fetch(event.request).catch(()=>caches.match('/mobile/offline.html')));});
