const CACHE="anime-imposteur-v7-3";
const SHELL=["./","./index.html","./style.css?v=7.3","./app.js?v=7.3","./ai-engine.js?v=7.3","./bot-engine.js?v=7.3","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;

  const u=new URL(e.request.url);

  if(
    u.hostname.includes("googleapis.com") ||
    u.hostname.includes("firebase") ||
    u.hostname.includes("jikan.moe") ||
    u.hostname.includes("anilist.co")
  ) return;

  const same=u.origin===self.location.origin;

  if(
    e.request.mode==="navigate" ||
    (same && ["script","style","document"].includes(e.request.destination))
  ){
    e.respondWith(
      fetch(e.request,{cache:"no-store"})
        .then(r=>{
          const c=r.clone();
          caches.open(CACHE).then(x=>x.put(e.request,c));
          return r;
        })
        .catch(()=>caches.match(e.request).then(x=>x||caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
});
