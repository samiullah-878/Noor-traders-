// push.js — v212: Firebase ka asal notification (app band ho tab bhi, NT Hazri ke apne icon ke sath).
// Token phone par banta hai aur Firestore (staffConfig ke sath wali pushTokens) mein rakha jata hai;
// bhejne ka kaam Cloud Functions karti hain (functions/index.js).
const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js';
// v216: notification ka service worker ALAG jagah (scope) par — warna app ka sw.js usay hata deta tha aur token mar jata tha.
const SW_URL = './firebase-messaging-sw.js', SW_SCOPE = './firebase-cloud-messaging-push-scope';
async function messagingRegistration(create = false) {
  const regs = await navigator.serviceWorker.getRegistrations();
  // purani ghalat registration (app ki jagah par notification wala) hatao
  for (const r of regs) { const u = (r.active || r.waiting || r.installing)?.scriptURL || ''; if (u.includes('firebase-messaging-sw.js') && !r.scope.includes('firebase-cloud-messaging-push-scope')) { try { await r.unregister(); } catch { /* ignore */ } } }
  let reg = regs.find(r => r.scope.includes('firebase-cloud-messaging-push-scope'));
  if (!reg && create) reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  return reg || null;
}
let mod = null;
const load = async () => (mod ||= await import(SDK));
// v219: app KHULI ho to Firebase khabar seedha page ko deta hai (phone par kuch nahi bajta tha). Ab page khud phone ki
// notification (awaaz + vibration) dikhata hai. Parchi / ticket ki khabar app pehle se toast + awaaz se deti hai — wo dobara nahi.
let fgBound = false;
function bindForeground(m, messaging, reg, onMessage) {
  if (fgBound) return; fgBound = true;
  m.onMessage(messaging, payload => {
    const d = payload?.data || {}, tag = String(d.tag || 'nt-hazri');
    if (/^(out|tkt)-/.test(tag)) return;
    try {
      const icon = new URL('./icon-192.png', location.href).href;
      reg?.showNotification?.(d.title || 'Noor Traders Hazri', { body: d.body || '', icon, badge: icon, tag, renotify: true, vibrate: [200, 100, 200], data: { link: d.link || location.href } });
    } catch { /* ignore */ }
    try { onMessage?.(d); } catch { /* ignore */ }
  });
}

export async function pushSupported() {
  try { const m = await load(); return (await m.isSupported()) && 'Notification' in window && 'serviceWorker' in navigator; } catch { return false; }
}
export const pushPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

/** Is phone par notification chalu karein. vapidKey = Firebase > Cloud Messaging > "Web Push certificates" ki key. */
export async function enablePush({ app, vapidKey, onToken, onMessage }) {
  if (!vapidKey) throw new Error('Pehle Firebase se "Web Push key" (VAPID) le kar Settings mein daalein.');
  if (!(await pushSupported())) throw new Error('Is phone/browser mein notification ki sahulat nahi. Chrome mein app ko home screen par install kar ke dobara koshish karein.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification ki ijazat nahi mili. Chrome > site settings > Notifications mein "Allow" karein.');
  const reg = await messagingRegistration(true);
  const m = await load(), messaging = m.getMessaging(app);
  const token = await m.getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error('Token nahi mila. Internet check kar ke dobara koshish karein.');
  bindForeground(m, messaging, reg, onMessage);
  await onToken?.(token);
  return token;
}
export async function currentToken({ app, vapidKey }) {
  try {
    if (!vapidKey || pushPermission() !== 'granted') return '';
    const reg = await messagingRegistration(false);
    if (!reg) return '';
    const m = await load();
    return await m.getToken(m.getMessaging(app), { vapidKey, serviceWorkerRegistration: reg }) || '';
  } catch { return ''; }
}

/** Is phone par band karein (token khatam). */
export async function disablePush({ app }) {
  const m = await load();
  try { await m.deleteToken(m.getMessaging(app)); return true; } catch { return false; }
}

/** App khulte hi (ijazat pehle se ho to) chupke se token taza karo — button dabane ki zaroorat nahi. */
export async function refreshPush({ app, vapidKey, onToken, onMessage }) {
  try {
    if (!vapidKey || pushPermission() !== 'granted' || !(await pushSupported())) return '';
    const reg = await messagingRegistration(true);
    const m = await load(), messaging = m.getMessaging(app);
    const token = await m.getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    bindForeground(m, messaging, reg, onMessage);
    if (token) await onToken?.(token);
    return token || '';
  } catch (error) { console.warn('push refresh', error); return ''; }
}
