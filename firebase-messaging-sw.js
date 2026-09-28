/* firebase-messaging-sw.js — app band ho tab bhi notification (Firebase Cloud Messaging).
   Ye file repo ki jar (root) mein honi chahiye, isi naam se. */
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');
importScripts('./firebase-config-sw.js');   // yahan se firebaseConfig milta hai

firebase.initializeApp(self.NT_FIREBASE_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'Noor Traders Hazri', {
    body: d.body || '',
    icon: new URL('./icon-192.png', self.location.href).href,
    badge: new URL('./icon-192.png', self.location.href).href,
    tag: d.tag || 'nt-hazri',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { link: d.link || new URL('./', self.location.href).href },
    actions: [{ action: 'open', title: 'Kholein' }]
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data?.link || './';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { try { if (new URL(c.url).origin === self.location.origin) { await c.focus(); try { await c.navigate(link); } catch { /* ignore */ } return; } } catch { /* ignore */ } }
    await clients.openWindow(link);
  })());
});
