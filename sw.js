const CACHE='fujinomiya-kanko-v2';
const ASSETS=[
  './','./index.html','./manifest.webmanifest','./apple-touch-icon.png',
  './icon-192.png','./icon-512.png','./icon-1024.png','./fujinomiya-bg.jpg'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
