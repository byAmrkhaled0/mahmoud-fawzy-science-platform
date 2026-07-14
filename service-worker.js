const CACHE_NAME = "mf-science-v568-production-booking-refresh";
const APP_SHELL = [
  "/", "/index.html", "/student.html", "/exams.html", "/materials.html",
  "/services.html", "/parent.html", "/reviews.html", "/privacy.html",
  "/terms.html", "/teacher-login.html", "/offline.html", "/assets/site.css", "/assets/v55.css", "/assets/v56.css", "/assets/app.js", "/assets/admin.js",
  "/assets/firebase-sync.js", "/assets/firebase-config.js", "/assets/v53-upgrades.js", "/assets/v55-admin.js", "/assets/v56-fixes.js", "/assets/logo-icon.svg",
  "/assets/icon-192.png", "/assets/icon-512.png", "/assets/icon-maskable-512.png", "/assets/teacher.webp", "/site.webmanifest", "/teacher.webmanifest"
];

// Firebase Messaging shares the same service worker as the PWA, avoiding a
// second worker with a conflicting root scope.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey:'AIzaSyANU2fln6kuYCtdm1WRMtG-AD5pUwV9a4g',
    authDomain:'mahmoud-fawzy-science-platform.firebaseapp.com',
    projectId:'mahmoud-fawzy-science-platform',
    storageBucket:'mahmoud-fawzy-science-platform.firebasestorage.app',
    messagingSenderId:'805108517684',
    appId:'1:805108517684:web:68c0cb7e506a583e3a7361'
  });
  firebase.messaging().onBackgroundMessage(payload => {
    const notification = payload.notification || payload.data || {};
    self.registration.showNotification(notification.title || 'حجز جديد', {
      body: notification.body || 'تم تسجيل حجز طالب جديد',
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      data: { url: '/teacher-login.html?section=bookings' },
      tag: `booking-${payload.data?.bookingCode || Date.now()}`
    });
  });
} catch (error) {
  console.warn('Firebase Messaging is unavailable', error);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/teacher-login.html?section=bookings'));
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
        const response=await fetch(request,{cache:"no-store"});
        if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
        return response;
      }catch(_){
        return (await caches.match(request)) || (await caches.match("/offline.html"));
      }
    })());
    return;
  }

  if(url.pathname.startsWith("/assets/") || url.pathname.endsWith(".webmanifest") || url.pathname==="/service-worker.js"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:"no-store"});
        if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
        return response;
      }catch(_){return caches.match(request);}
    })());
  }
});
