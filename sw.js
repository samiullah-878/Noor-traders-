/* Noor Traders Hisab — service worker
   Sirf STATIC assets ka cache. User/business data (localStorage, IndexedDB,
   Firebase/Firestore) ko ye file kabhi haath nahi lagati. */
const APP_VERSION='v115';
const CACHE='noor-traders-static-'+APP_VERSION;

self.addEventListener('install',e=>{self.skipWaiting()});

self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    clients.claim(),
    // Sirf purane STATIC caches delete hote hain — data stores nahi.
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE&&(k.startsWith('noor-traders-')||k.startsWith('noor-traders-static-')))
          .map(k=>caches.delete(k))
    ))
  ]));
});

self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  const isLive=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('index.html')||u.pathname.endsWith('version.json')||u.pathname.endsWith('sw.js');
  e.respondWith(
    // Network-first: nayi deployment hamesha foran milti hai.
    fetch(e.request,{cache:'no-store'}).then(r=>{
      if(!r||!r.ok)return r;
      const cp=r.clone();
      caches.open(CACHE).then(c=>c.put(isLive?new Request(u.pathname):e.request,cp)).catch(()=>{});
      return r;
    }).catch(()=>caches.match(isLive?new Request(u.pathname):e.request).then(x=>x||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))
  );
});

// Owner page ki notifications par click handle karta hai.
self.addEventListener('notificationclick',event=>{
  const data=event.notification.data;event.notification.close();
  if(data?.type==='NT_STAFF_SUGGESTION'&&typeof data.ownerUid==='string'){
    event.waitUntil((async()=>{const scope=new URL(self.registration.scope),windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){const url=new URL(client.url);if(url.origin===scope.origin&&url.pathname.startsWith(scope.pathname)){await client.focus();client.postMessage(data);return}}const url=new URL('index.html',scope);url.hash='staffCenter';await clients.openWindow(url.href)})());return;
  }
  if(data?.type!=='NT_TASK_NOTIFICATION'||typeof data.taskId!=='string'||typeof data.ownerUid!=='string')return;
  event.waitUntil((async()=>{
    const scope=new URL(self.registration.scope),windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){const url=new URL(client.url);if(url.origin===scope.origin&&url.pathname.startsWith(scope.pathname)){await client.focus();client.postMessage({type:'NT_TASK_NOTIFICATION',taskId:data.taskId,ownerUid:data.ownerUid});return}}
    const url=new URL('index.html',scope);url.hash='staffTasks';url.searchParams.set('noticeTask',data.taskId);url.searchParams.set('noticeOwner',data.ownerUid);await clients.openWindow(url.href);
  })());
});
