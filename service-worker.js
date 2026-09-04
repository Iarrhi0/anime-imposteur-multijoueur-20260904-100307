const CACHE="anime-imposteur-v7-1";
const SHELL=["./","./index.html","./style.css?v=7.1","./app.js?v=7.1","./ai-engine.js?v=7.1","./bot-engine.js?v=7.1","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(u.hostname.includes("googleapis.com")||u.hostname.includes("firebase")||u.hostname.includes("jikan.moe")||u.hostname.includes("anilist.co"))return;
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put("./index.html",c));return r}).catch(()=>caches.match("./index.html")));return;
  }
  e.respondWith(caches.match(e.request).then(cached=>{
    const network=fetch(e.request).then(r=>{if(r.ok&&u.origin===self.location.origin){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>cached);
    return cached||network;
  }));
});
