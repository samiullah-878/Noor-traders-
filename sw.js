/* Noor Traders Hazri — service worker (v203: tez).
   App ki files aur Firebase SDK phone se foran milte hain (peeche se taza bhi hote rehte hain).
   Hazri/salary ka DATA yahan se nahi guzarta — wo Firebase khud sambhalta hai.
   Nayi version: app version.json dekhti hai; nayi ho to cache mita kar reload karti hai. */
const APP_VERSION = 'v215';
const CACHE = 'nt-hazri-' + APP_VERSION;
const SDK_CACHE = 'nt-hazri-sdk-12.18.0';
const SHELL = ['./', './index.html', './styles.css', './boot.js', './app.js', './core.js', './auth.js', './data.js', './ui.js', './owner.js', './staffview.js', './breaks.js', './tickets.js', './manager.js', './notify.js', './push.js', './pdf.js', './firebase-config.js', './archivo-latin.woff2', './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
const SDK = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => 'https://www.gstatic.com/firebasejs/12.18.0/' + f);

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(Promise.all([
    caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))))),
    caches.open(SDK_CACHE).then(c => Promise.allSettled(SDK.map(u => c.add(new Request(u, { mode: 'cors' })))))
  ]));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== SDK_CACHE && (k.startsWith('nt-hazri') || k.startsWith('noor-traders-'))).map(k => caches.delete(k))))
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Firebase SDK: version wala URL kabhi nahi badalta -> hamesha phone se
  if (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(caches.open(SDK_CACHE).then(c => c.match(request).then(hit => hit || fetch(request).then(res => { if (res.ok) c.put(request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;               // Firestore / login seedha internet se
  if (url.pathname.endsWith('version.json')) return;         // update check hamesha taza
  if (url.searchParams.has('nocache')) return;              // boot.js ki file jaanch: seedha internet
  const key = request.mode === 'navigate' ? './index.html' : url.pathname;
  // Phone wali copy foran do, peeche se taza copy le kar rakh lo
  event.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key, { ignoreSearch: true });
    const fresh = fetch(request, { cache: 'no-store' }).then(res => { if (res && res.ok) c.put(key, res.clone()); return res; });
    if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh.catch(() => c.match('./index.html'));
  }));
});
