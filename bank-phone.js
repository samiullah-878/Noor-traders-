// =========================================================
//  bank-phone.js v1.0 (2026-11-19, app v2.325.0) — 🏦 Alfa app ki NOTIFICATION → bankSms (sirf malik)
//  Malik: "aisa pop (Alfa · PKR … received … BAF A/C) aaye to add kar do · SMS aaye to double na ho".
//  Malik ke phone ka MacroDroid '🏦 Alfa notification' (md/tools/alfa.py) notification ko WAHI bankSms mein bhejta hai jahan SMS jata hai
//  (src 'notif') → PC bank-parchi v2.8 khud khate mein lagata hai; wahi Tx ID / waqt wala SMS = jurwan (ek hi entry).
//  Chaabi + link REPO MEIN NAHI: app (malik) din mein ek dafa Falcon wale webhook ke device par `nt_bank` ko bkU (Firestore link) + bkK
//  (blueAccess/bankKey) bhejti hai — phone par khamoshi se (koi paigham nahi). no-cors: jawab nahi parh sakte. AI nahi.
// =========================================================
import { firebaseConfig as F } from './config.js?v=2.376.0';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
export async function bankPhoneSend(cloud, force = false) {
  try {
    const k = String((await cloud?.getBankKey?.()) || '');
    if (k.length < 16) return 'chaabi nahi';   // HBL Inbox ⚙️ Setup mein chaabi bani hi nahi — khud nahi banate (SMS / Gmail script tootenge)
    const C = (await cloud.getFxCfg?.()) || {}, m = String(C.wh || '').trim().match(/^(https:\/\/trigger\.macrodroid\.com\/[A-Za-z0-9_-]{6,})\//);
    if (!m) return 'webhook nahi';
    const sig = today() + '|' + k.slice(0, 5) + '|' + m[1].slice(-5);
    if (!force) { try { if (localStorage.getItem('sam-bk-ph') === sig) return 'pehle'; } catch {} }
    const u = `https://firestore.googleapis.com/v1/projects/${F.projectId}/databases/(default)/documents/businesses/noor-traders/bankSms?key=${F.apiKey}`;
    await fetch(m[1] + '/nt_bank?bkU=' + encodeURIComponent(u) + '&bkK=' + encodeURIComponent(k) + '&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' });
    try { localStorage.setItem('sam-bk-ph', sig); } catch {}
    return 'bheja';
  } catch (e) { return 'masla: ' + (e?.message || e); }
}
