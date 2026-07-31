const CACHE_NAME = "mf-science-v5946";
const APP_SHELL = [
  "/", "/index.html", "/student.html", "/exams.html", "/materials.html",
  "/services.html", "/parent.html", "/reviews.html", "/privacy.html",
  "/terms.html", "/offline.html", "/assets/site.bundle.css",
  "/assets/public.bundle.js", "/assets/firebase-sync.js",
  "/assets/firebase-config.js",
  "/assets/logo-icon.svg", "/assets/icon-192.png",
  "/assets/icon-512.png", "/assets/icon-maskable-512.png",
  "/assets/teacher.webp", "/site.webmanifest"
];

// Handle standards-based Web Push directly so the PWA never depends on a
// third-party script during service-worker startup.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json?.() || {}; } catch (_) {
    payload = { notification: { body: event.data?.text?.() || '' } };
  }
  const notification = payload.notification || payload.data || payload || {};
  event.waitUntil(self.registration.showNotification(notification.title || 'تنبيه جديد', {
    body: notification.body || 'يوجد تحديث جديد في منصة مستر محمود فوزي',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: { url: notification.url || payload.data?.url || '/teacher-login.html' },
    tag: notification.tag || `mf-notification-${payload.data?.bookingCode || Date.now()}`
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=event.notification.data?.url||'/teacher-login.html?section=bookings';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(rows=>{
    const existing=rows.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){existing.navigate(target);return existing.focus();}
    return clients.openWindow(target);
  }));
});

self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(url=>cache.add(new Request(url,{cache:"reload"}))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if(event.data && event.data.type==="SKIP_WAITING") self.skipWaiting();
  if(event.data && event.data.type==="CLEAR_OLD_CACHES") event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));
});

self.addEventListener("fetch", event => {
  const request=event.request;
  if(request.method!=="GET") return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}
        return response;
      }catch(_){
        // Query strings such as ?code=12345678 must fall back to the cached
        // HTML page, not to offline.html.
        return (await caches.match(url.pathname,{ignoreSearch:true})) ||
          (await caches.match(request,{ignoreSearch:true})) ||
          (await caches.match("/offline.html"));
      }
    })());
    return;
  }

  const criticalAssets=new Set([
    "/assets/firebase-config.js", "/assets/firebase-sync.js",
    "/assets/public.bundle.js", "/assets/admin.bundle.js",
    "/assets/site.bundle.css"
  ]);
  if(criticalAssets.has(url.pathname)){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:"no-store"});
        if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
        return response;
      }catch(_){return caches.match(request,{ignoreSearch:true});}
    })());
    return;
  }

  if(url.pathname.startsWith("/assets/") || url.pathname.endsWith(".webmanifest")){
    // Versioned static assets are returned from cache immediately on repeat
    // visits while a background request refreshes them. Large QR and Excel
    // bundles enter this cache only after the user actually opens that tool.
    const network=fetch(request).then(async response=>{
      if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}
      return response;
    });
    event.respondWith(caches.match(request).then(cached=>{
      if(cached){event.waitUntil(network.catch(()=>null));return cached;}
      return network.catch(()=>caches.match(request));
    }));
  }
});
