const CACHE="anime-imposteur-v8-0";
const SHELL=[
  "./",
  "./index.html",
  "./style.css?v=8.0",
  "./app.js?v=8.0",
  "./ai-engine.js?v=8.0",
  "./bot-engine.js?v=8.0",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  const u=new URL(event.request.url);

  if(
    u.hostname.includes("googleapis.com") ||
    u.hostname.includes("firebase") ||
    u.hostname.includes("jikan.moe") ||
    u.hostname.includes("anilist.co")
  ) return;

  const same=u.origin===self.location.origin;

  if(
    event.request.mode==="navigate" ||
    (same && ["script","style","document"].includes(event.request.destination))
  ){
    event.respondWith(
      fetch(event.request,{cache:"no-store"})
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy));
          return res;
        })
        .catch(()=>caches.match(event.request).then(x=>x||caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request))
  );
});
