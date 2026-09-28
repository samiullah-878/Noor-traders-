// notify.js — v211: app band ho tab bhi malik/manager ke phone par khabar (muft "ntfy" app ke zariye).
// Koi server nahi: jo phone kaam karta hai (staff ki parchi, late Check-In, ticket) wohi seedha ntfy.sh ko paigham bhejta hai.
// Malik aur manager ntfy app mein wohi "topic" subscribe karte hain. Topic ka naam hi chabi hai — kisi aur ko na batayein.
export const NOTIFY_KINDS = [
  ['out', 'Bahar jane ki parchi'],
  ['leave', 'Chutti / correction ki request'],
  ['late', 'Late aaya (Check-In par)'],
  ['ticket', 'Bina bataye gaya ka ticket']
];
export function newTopic() {
  const a = new Uint8Array(12); (globalThis.crypto || window.crypto).getRandomValues(a);
  return 'nt-hazri-' + [...a].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}
/** Fire-and-forget. Kabhi ghalti nahi phenkta (internet na ho to chup). */
export function sendNotify(cfg = {}, kind, { title, message, priority = 3, tags = [], click = '' }, fetchFn = globalThis.fetch) {
  const n = cfg?.notify;
  if (!n?.on || !n.topic || n[kind] === false || typeof fetchFn !== 'function') return Promise.resolve(false);
  const body = JSON.stringify({ topic: n.topic, title: String(title || '').slice(0, 120), message: String(message || '').slice(0, 400), priority, tags, ...(click ? { click } : {}) });
  // text/plain (default) = CORS preflight nahi; ntfy JSON khud samajh leta hai
  return Promise.race([fetchFn('https://ntfy.sh/', { method: 'POST', body }).then(r => !!r?.ok).catch(() => false), new Promise(r => setTimeout(() => r(false), 8000))]);
}
export const appLink = () => { try { const l = window.location; return l.origin + l.pathname.replace(/index\.html$/, ''); } catch { return ''; } };
