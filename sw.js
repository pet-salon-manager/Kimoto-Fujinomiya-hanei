const CACHE="fujinomiya-kanko-v5";
const ASSETS=[
 "./","./index.html","./admin.html","./manifest.webmanifest",
 "./apple-touch-icon.png","./icon-192.png","./icon-512.png","./icon-1024.png",
 "./fujinomiya-bg.jpg","./app-config.js","./spots-default.js","./data-store.js"
];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
