// =========================================================
//  gaari-gps.js  v1.0 (2026-11-01) — 📍 GAARI KA PHONE → din ke km (khud)
//  Malik: "gaari mein mobile rakh dein to pura din ka khud minus ho (milage map se) · driver kuch nahi dabayega · jahan 4G na ho?"
//
//  Gaari ka phone (MacroDroid, har 1 min) jagah apni list mein jorta hai, phir khufia chaabi (blueAccess/gaariKey) ke saath
//  businesses/noor-traders/gaariGps/<auto> {k, p} bhejta hai — signal na ho to list phone mein barhti rehti, signal aate hi sab ek saath.
//  Ye script har 2 min:
//    • naye gaariGps docs parhti (p = "lat,lon,waqt;lat,lon,waqt;…" — MacroDroid jo bhi likhe: number dhoond kar),
//    • din-war (Pakistan waqt) gaariDay/<YYYY-MM-DD> (chhota: km, ruke 10 min+, phone chup 5 min+ — beech ka andaza seedhi lakeer, 'gap' alag)
//      + gaariPath/<din> (naqshe ka raasta, har 200 m — app sirf naqsha kholne par) + gaariGpsRaw/<din> (saari jagah, sirf PC) — JSON text (list ke andar list NAHI),
//    • gaariDay/_live {t, lat, lon, recv, n} = aakhri jagah (app: "📵 phone chup"),
//    • parhe hue gaariGps docs mita deti (Firestore halka).
//  AI NAHI. POS / khata mein KUCH nahi likhti. Chalana: gaari-gps-auto.bat (doctor). Log: gaari-gps-log.txt.
// =========================================================
const path = require('path');
const ZINDA = (() => { try { return require('./zinda.js')(__filename, {}); } catch (e) { const f = path.join(__dirname, path.basename(__filename, '.js') + '.alive'); const fs = require('fs'); setInterval(() => { try { fs.writeFileSync(f, String(Date.now())); } catch {} }, 30000); return { guard: fn => fn }; } })();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
if (!getApps().length) initializeApp({ credential: cert(require(path.join(__dirname, 'firebase-key.json'))) });
const db = getFirestore(), biz = db.collection('businesses').doc('noor-traders'), RAW = biz.collection('gaariGps'), DAY = biz.collection('gaariDay'), PATH = biz.collection('gaariPath'), KEEP = biz.collection('gaariGpsRaw');   // KEEP = din ki saari jagah (sirf PC parhta)
const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const EVERY = 2 * 60000, PK = 5 * 3600000;   // Pakistan = UTC+5 (din ki hadd)
const dayOf = t => { const d = new Date(t + PK); return d.toISOString().slice(0, 10); };
const R = 6371.0088, rad = x => x * Math.PI / 180;
function hav(a, b) { const dLa = rad(b[1] - a[1]), dLo = rad(b[2] - a[2]), s = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))); }

// ---------- MacroDroid ki list → [[t, lat, lon]] (jo bhi shakal ho: number dhoondo) ----------
//   lat = Pakistan ke andar (20–40), lon (55–80) · waqt = 10 hindse (sec) ya 13 (ms) · waqt na ho = doc ke waqt se pichhe 1–1 min
function parse(p, recvAt) {
  const seg = String(p || '').split(/[;|\n]+/).map(s => s.trim()).filter(Boolean), out = [];
  seg.forEach((s, i) => {
    const nums = (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const lat = nums.find(x => x >= 20 && x <= 40 && !Number.isInteger(x)), lon = nums.find(x => x >= 55 && x <= 80 && !Number.isInteger(x) && x !== lat);
    if (lat == null || lon == null) return;
    let t = nums.find(x => Number.isInteger(x) && x > 1e12 && x < 4e12) || (nums.find(x => Number.isInteger(x) && x > 1.5e9 && x < 4e9) || 0) * 1000;
    if (!t || t > recvAt + 10 * 60000 || t < recvAt - 30 * 86400000) t = recvAt - (seg.length - 1 - i) * 60000;   // waqt nahi / ghalat = tarteeb se
    out.push([Math.round(t), Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6]);
  });
  return out;
}

// ---------- ek din ka hisaab ----------
//   km: "langar" (anchor) se 40 m door hone par hi jorna (khari gaari ki GPS hil-jul nahi) · 160 km/h se tez chhalang = ghalat point
//   ruka: 150 m ke andar 10 min+ · chup: 5 min+ koi point nahi (aur gaari hili) = gap (seedhi lakeer ka andaza, km mein shamil + alag likha)
function summarize(P) {
  P = P.slice().sort((a, b) => a[0] - b[0]).filter((x, i, A) => !i || x[0] !== A[i - 1][0]);
  const good = []; for (const x of P) { const l = good[good.length - 1]; if (l) { const d = hav(l, x), h = (x[0] - l[0]) / 3600000; if (h > 0 && d / h > 160 && d > 0.3) continue; } good.push(x); }
  let km = 0, gapKm = 0, anc = null; const gaps = [], stops = [];
  for (let i = 0; i < good.length; i++) {
    const x = good[i];
    if (!anc) { anc = x; continue; }
    const d = hav(anc, x), prev = good[i - 1], dt = x[0] - prev[0];
    if (dt > 5 * 60000) { const g = hav(prev, x); if (g > 0.3) { gaps.push([prev[0], x[0], Math.round(g * 10) / 10]); gapKm += g; } }
    if (d >= 0.04) { km += d; anc = x; }
  }
  for (let i = 0; i < good.length;) {   // ruke
    let j = i; while (j + 1 < good.length && hav(good[i], good[j + 1]) <= 0.15) j++;
    if (good[j][0] - good[i][0] >= 10 * 60000) stops.push([good[i][0], good[j][0], good[i][1], good[i][2]]);
    i = j + 1;
  }
  // raasta: har 200 m ek point — naqshe ke liye kaafi, doc halka
  const path = []; let pl = null; for (const x of good) { if (!pl || hav(pl, x) >= 0.2) { path.push(x); pl = x; } } if (good.length && path[path.length - 1] !== good[good.length - 1]) path.push(good[good.length - 1]);
  return { km: Math.round(km * 10) / 10, gapKm: Math.round(gapKm * 10) / 10, n: good.length, first: good[0]?.[0] || 0, last: good[good.length - 1]?.[0] || 0, gaps, stops, path };
}

const cache = new Map();   // day -> raw points (is chakkar ke liye)
async function loadDay(day) {
  if (cache.has(day)) return cache.get(day);
  let pts = [];
  const s2 = await KEEP.doc(day).get(); if (s2.exists) { try { pts = JSON.parse(s2.data().raw || '[]'); } catch {} }
  cache.set(day, pts); return pts;
}
async function tick() {
  const snap = await RAW.limit(400).get();
  if (snap.empty) return;
  const touched = new Set(); let n = 0, last = null, real = 0;
  for (const d of snap.docs) {
    const x = d.data() || {}, recv = d.createTime ? d.createTime.toMillis() : Date.now();
    if (/^RABTA TEST/.test(String(x.p || ''))) continue;   // app ka 🔎 rabta test — sirf mitao
    real++;
    const pts = parse(x.p, recv); n += pts.length;
    for (const q of pts) { const day = dayOf(q[0]); (await loadDay(day)).push(q); touched.add(day); if (!last || q[0] > last[0]) last = q; }
  }
  for (const day of touched) {
    const raw = cache.get(day).sort((a, b) => a[0] - b[0]).filter((x, i, A) => !i || x[0] !== A[i - 1][0]); cache.set(day, raw);
    const S = summarize(raw);
    await KEEP.doc(day).set({ raw: JSON.stringify(raw), at: Date.now() });
    await PATH.doc(day).set({ j: JSON.stringify(S.path), at: Date.now() });
    await DAY.doc(day).set({ date: day, km: S.km, gapKm: S.gapKm, n: S.n, first: S.first, last: S.last, j: JSON.stringify({ stops: S.stops, gaps: S.gaps }), at: Date.now() });
    log(`📍 ${day}: ${S.km} km · ${S.n} jagah · ${S.stops.length} ruke · ${S.gaps.length} chup${S.gapKm ? ` (${S.gapKm} km andaza)` : ''}`);
  }
  if (last) await DAY.doc('_live').set({ t: last[0], lat: last[1], lon: last[2], recv: Date.now(), n }, { merge: true });
  else if (real) await DAY.doc('_live').set({ recv: Date.now(), bad: String(snap.docs[snap.docs.length - 1].data()?.p || '').slice(0, 160) }, { merge: true });   // list aayi magar jagah nahi — app setup mein dikhaye
  const b = db.batch(); snap.docs.forEach(d => b.delete(d.ref)); await b.commit();
  for (const k of [...cache.keys()]) if (k < dayOf(Date.now() - 3 * 86400000)) cache.delete(k);
}
let busy = false;
async function loop() { if (busy) return; busy = true; try { await tick(); } catch (e) { log('⚠️', e.message || e); } finally { busy = false; } }
if (require.main === module) log('📍 gaari-gps v1.0 shuru — har 2 min gaari ke phone ki jagah → din ke km');
if (require.main === module) { loop(); setInterval(ZINDA.guard(loop, 5 * 60000, 'gaari-gps'), EVERY); }
module.exports = { parse, summarize, dayOf };
