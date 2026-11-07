// =========================================================
//  gaari-gps.js  v1.2 (2026-11-07) — 📍 GAARI KA PHONE → din ke km (khud)
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
//
//  v1.1 (2026-11-05) — 🛰 FALCON-I KM KHUD (malik: "Falcon apps wala bana do · ye milage trips hain")
//    Malik ke phone ka MacroDroid (app ⚙️ se bani .macro, wahi gaariKey) Falcon-i → Reports → Trips → Today's Trips
//    khud khol kar screen ka text (Read Screen Contents → JSON, upar-neeche scroll, kai dafa) gaariGps mein "FX1|…" bhejta hai.
//    Ye script trip ka waqt ("05 Nov 2026 09:37 PM") + "Total Distance: 8.86 Km" jori dhoond kar gaariDay/<din> mein
//    MERGE karti hai: fk (din ke Falcon km), fn (trips), ft (JSON [["21:37", 8.86], …]), fa (kab) — dohra trip ek dafa
//    (waqt se), naya parha km purane par (chalta trip baad mein poora). GPS wale khane ab merge se (Falcon na mite).
//    gaariDay/_falcon = aakhri dafa ka haal (kitne trip, kachcha text ka namoona) — app ⚙️ mein (samajh na aaye to dikhe).
//    AI NAHI.
//
//  v1.2 (2026-11-07) — 🗺 TRIP DETAIL + PATA SE NUQTA (malik: "map ki shakal chahiye · Falcon Trip Detail mein Start / End pata aata hai")
//    Macro v2 (falcon-macro.js) har trip khol kar Trip Detail parhta hai → body mein "~~DET~~{…}" hisse (Start / End pata, Distance, Time).
//    Ye script: DET hisse alag (trips ki jori mein kabhi nahi — "to 10:09 PM" doosra waqt orphan ban jata tha) → har trip {t, km, f (Start pata), e (End pata)}
//    → pata se nuqta: OpenStreetMap NOMINATIM (muft, 1 sawal / 1.1 s, User-Agent zaroori) — "0.31 Km away From, X, Sargodha Rd, Kunjah, Punjab, Pakistan"
//      ka "X, Sargodha Rd, Kunjah, …" poochho; na mile to pehla hissa hata kar dobara (sarak → mohalla → shehr) = ANDAZA (q = kitne hisse hataye).
//      Ek pata ek dafa (gaari-geo.json cache). gaariDay/<din>.fd = JSON [{t, km, f, e, p:[la1,lo1,la2,lo2]|null, q:[q1,q2]}] (merge, waqt se).
//    "MENU?~~…" body = macro ko ☰ nahi mila — _falcon.why 'menu nahi' + raw (agli dafa screen dekh kar theek). Google ka map / API nahi. AI NAHI.
// =========================================================
const path = require('path');
const https = require('https');
const fs = require('fs');
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

// ---------- 🛰 v1.1 FALCON-I: screen ka text → trips [{day, t:'HH:MM', km}] ----------
//   waqt: "05 Nov 2026 09:37 PM" · "Nov 05, 2026 21:37" · "2026-11-05 21:37" · "05/11/2026 09:37 PM" (din pehle — Pakistan)
//   km: "Total Distance: 8.86 Km" (label alag view mein ho to bhi, 90 harf tak) — km/h (speed) kabhi nahi
//   jori: har km apne se PEHLE wale pehle waqt se (card ka heading); waqt ke baghair km = chhor do
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MRX = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const DT_RX = [
  new RegExp('\\b(\\d{1,2})[\\s\\-\\/.]+' + MRX + '[\\s\\-\\/.,]+(\\d{4})[\\s,T]*(?:at\\s*)?(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*([ap]\\.?\\s?m\\.?)?', 'gi'),   // 05 Nov 2026 09:37 PM
  new RegExp('\\b' + MRX + '\\s+(\\d{1,2}),?\\s+(\\d{4})[\\s,T]*(?:at\\s*)?(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*([ap]\\.?\\s?m\\.?)?', 'gi'),   // Nov 05, 2026 09:37 PM
  /\b(\d{4})-(\d{1,2})-(\d{1,2})[\sT]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?/gi,   // 2026-11-05 21:37
  /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})[\s,]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?/gi   // 05/11/2026 09:37 PM
];
const KM_LBL = /distance[\s\S]{0,90}?(?<![\w.])(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:km|kms|kilomet)(?![a-z]*\s*\/\s*h|ph|\/hr)/gi;
const KM_ANY = /(?<![\w.])(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:km|kms)\b(?!\s*\/\s*h|ph|\/hr)/gi;
function fxParse(txt) {
  const s = String(txt || ''), ev = [];
  const hh = (h, ap) => { h = Number(h); if (ap) { const p = /^p/i.test(ap); h = h % 12 + (p ? 12 : 0); } return h; };
  DT_RX.forEach((rx, k) => { rx.lastIndex = 0; let m; while ((m = rx.exec(s))) {
    let y, mo, d, h, mi, ap;
    if (k === 0) { d = +m[1]; mo = MON[m[2].slice(0, 3).toLowerCase()]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else if (k === 1) { mo = MON[m[1].slice(0, 3).toLowerCase()]; d = +m[2]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else if (k === 2) { y = +m[1]; mo = +m[2]; d = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else { d = +m[1]; mo = +m[2]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    const H = hh(h, ap);
    if (!mo || mo > 12 || d < 1 || d > 31 || y < 2024 || y > 2100 || H > 23 || mi > 59) continue;
    ev.push({ i: m.index, end: m.index + m[0].length, kind: 'dt', day: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, t: `${String(H).padStart(2, '0')}:${String(mi).padStart(2, '0')}` });
  } });
  const kmEv = rx => { const out = []; rx.lastIndex = 0; let m; while ((m = rx.exec(s))) { const v = Number(String(m[1]).replace(',', '.')); if (v >= 0 && v < 800) out.push({ i: m.index + m[0].lastIndexOf(m[1]), kind: 'km', km: Math.round(v * 100) / 100 }); } return out; };
  let K = kmEv(KM_LBL); if (!K.length) K = kmEv(KM_ANY);
  // dohre waqt (do regex ek hi jagah) — ek
  const D = ev.sort((a, b) => a.i - b.i).filter((x, i, A) => !i || x.i >= A[i - 1].end);
  const all = [...D, ...K].sort((a, b) => a.i - b.i), trips = [];
  let first = null, orphan = 0;
  for (const e of all) {
    if (e.kind === 'dt') { if (!first) first = e; continue; }
    if (first) { if (e.km > 0) trips.push({ day: first.day, t: first.t, km: e.km }); first = null; } else orphan++;
  }
  return { trips, nDt: D.length, nKm: K.length, orphan };
}
// trips ko din-war purane trips ke saath jor (waqt se pehchan, naya km jeete) → { day: [[t, km], …] }
function fxMerge(oldJ, add) {
  const m = new Map(); try { for (const [t, km] of JSON.parse(oldJ || '[]') || []) if (t) m.set(String(t), Number(km) || 0); } catch {}
  for (const x of add) m.set(x.t, x.km);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
// ---------- 🗺 v1.2 Trip Detail hisse + pata → nuqta ----------
const GEO_FILE = path.join(__dirname, 'gaari-geo.json');
let GEO = null; function geoLoad() { if (GEO) return GEO; try { GEO = JSON.parse(fs.readFileSync(GEO_FILE, 'utf8')); } catch { GEO = {}; } return GEO; }
function geoSave() { try { fs.writeFileSync(GEO_FILE, JSON.stringify(GEO)); } catch {} }
// body ko ~~ par todo: DET ke BAAD wala hissa = detail; baqi = list (fxParse ke liye)
function fxSplit(body) {
  const parts = String(body || '').split('~~'), list = [], det = [];
  for (let i = 0; i < parts.length; i++) { const q = parts[i]; if (q.trim() === 'DET') { if (parts[i + 1]) det.push(parts[i + 1]); i++; } else if (q.trim()) list.push(q); }
  return { list: list.join('~~'), det };
}
// ek Trip Detail screen ka text (JSON, quotes → ') → {t:'HH:MM', km, f, e}
function fxDetail(txt) {
  const S = []; const rx = /'((?:[^']|'(?=[^,}:]))*)'/g; let m; while ((m = rx.exec(txt))) S.push(m[1].trim());
  const val = i => { for (let j = i + 1; j < Math.min(S.length, i + 4); j++) { const v = S[j]; if (/[ ,]/.test(v) && /[a-z]/i.test(v) && !/^(start|end|distance|time)$/i.test(v)) return v; } return ''; };
  const lab = n => S.findIndex(q => q.toLowerCase() === n);
  const out = { t: '', km: 0, f: '', e: '' };
  const si = lab('start'), ei = lab('end'), di = lab('distance'), ti = lab('time');
  if (si >= 0) out.f = val(si); if (ei >= 0) out.e = val(ei);
  if (di >= 0) { for (let j = di + 1; j < Math.min(S.length, di + 4); j++) { const k = /(\d{1,4}(?:[.,]\d{1,3})?)\s*km/i.exec(S[j]); if (k) { out.km = Math.round(Number(k[1].replace(',', '.')) * 100) / 100; break; } } }
  if (ti >= 0) { for (let j = ti + 1; j < Math.min(S.length, ti + 4); j++) { const P = fxParse(S[j]); if (P.nDt) { const e = []; DT_RX.forEach(rx2 => { rx2.lastIndex = 0; let q; while ((q = rx2.exec(S[j]))) e.push(q.index); }); out.t = fxFirstTime(S[j]); if (out.t) break; } } }
  if (!out.t) { out.t = fxFirstTime(txt); }
  return out.t && (out.f || out.e) ? out : null;
}
function fxFirstTime(txt) { const P = fxParseTimes(txt); return P.length ? P[0].t : ''; }
// sirf waqt (din + HH:MM) nikalo — fxParse jaisa magar km ke baghair
function fxParseTimes(s) {
  const ev = [], hh = (h, ap) => { h = Number(h); if (ap) { const p = /^p/i.test(ap); h = h % 12 + (p ? 12 : 0); } return h; };
  DT_RX.forEach((rx, k) => { rx.lastIndex = 0; let m; while ((m = rx.exec(s))) {
    let y, mo, d, h, mi, ap;
    if (k === 0) { d = +m[1]; mo = MON[m[2].slice(0, 3).toLowerCase()]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else if (k === 1) { mo = MON[m[1].slice(0, 3).toLowerCase()]; d = +m[2]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else if (k === 2) { y = +m[1]; mo = +m[2]; d = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    else { d = +m[1]; mo = +m[2]; y = +m[3]; h = m[4]; mi = +m[5]; ap = m[6]; }
    const H = hh(h, ap); if (!mo || mo > 12 || d < 1 || d > 31 || y < 2024 || y > 2100 || H > 23 || mi > 59) continue;
    ev.push({ i: m.index, day: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, t: `${String(H).padStart(2, '0')}:${String(mi).padStart(2, '0')}` });
  } });
  return ev.sort((a, b) => a.i - b.i);
}
// "0.31 Km away From, Canal View …, Sargodha Rd, Kunjah, Punjab, Pakistan" → poochhne wala pata (hisse)
function geoParts(addr) {
  let a = String(addr || '').replace(/^[\d.,]+\s*km\s*away\s*from\s*,?\s*/i, '').trim();
  const parts = a.split(',').map(q => q.trim()).filter(Boolean);
  return parts;
}
let geoLast = 0;
function nominatim(q) {
  return new Promise(res => {
    const wait = Math.max(0, geoLast + 1100 - Date.now());
    setTimeout(() => { geoLast = Date.now();
      const rq = https.request({ hostname: 'nominatim.openstreetmap.org', path: '/search?format=json&limit=1&countrycodes=pk&q=' + encodeURIComponent(q), method: 'GET', headers: { 'User-Agent': 'NoorTraders-BlueKhata/1.0 (shop PC; gaari naqsha)', 'Accept-Language': 'en' }, timeout: 15000 }, r => {
        let b = ''; r.on('data', c => b += c); r.on('end', () => { try { const J = JSON.parse(b); res(Array.isArray(J) && J[0] ? [Number(J[0].lat), Number(J[0].lon)] : null); } catch { res(null); } });
      });
      rq.on('error', () => res(null)); rq.on('timeout', () => { rq.destroy(); res(null); }); rq.end();
    }, wait);
  });
}
// pata → [lat, lon, q] (q = kitne hisse hata kar mila; 0 = poora pata) · cache
async function geocode(addr) {
  const parts = geoParts(addr); if (parts.length < 2) return null;
  const G = geoLoad(), key = parts.join(', ').toLowerCase();
  if (G[key] && (G[key].p || Date.now() - (G[key].at || 0) < 7 * 86400000)) return G[key].p ? G[key].p : null;   // na mila = 7 din baad dobara
  for (let q = 0; q < parts.length - 1 && q < 4; q++) {   // kam az kam 2 hisse (shehr, Punjab) rahein
    const p = await nominatim(parts.slice(q).join(', '));
    if (p) { G[key] = { p: [p[0], p[1], q], at: Date.now() }; geoSave(); return G[key].p; }
  }
  G[key] = { p: null, at: Date.now() }; geoSave(); return null;
}
// fd merge: purane + naye (waqt se), nuqte sirf jin ka nahi
async function fxDetails(oldJ, dets) {
  const m = new Map(); try { for (const x of JSON.parse(oldJ || '[]') || []) if (x && x.t) m.set(String(x.t), x); } catch {}
  for (const d of dets) { const o = m.get(d.t) || {}; m.set(d.t, { t: d.t, km: d.km || o.km || 0, f: d.f || o.f || '', e: d.e || o.e || '', p: o.p || null, q: o.q || null }); }
  for (const x of m.values()) {
    if (x.p || (!x.f && !x.e)) continue;
    const a = x.f ? await geocode(x.f) : null, b = x.e ? await geocode(x.e) : null;
    if (a || b) { x.p = [a ? a[0] : null, a ? a[1] : null, b ? b[0] : null, b ? b[1] : null]; x.q = [a ? a[2] : null, b ? b[2] : null]; }
  }
  return [...m.values()].sort((a, b) => a.t.localeCompare(b.t));
}
async function falconTick(docs) {
  const today = dayOf(Date.now()), minDay = dayOf(Date.now() - 3 * 86400000);
  for (const d of docs) {
    const x = d.data() || {}, raw = String(x.p || ''), body = raw.replace(/^FX[12]\|[^|]*\|/, '');
    if (/^MENU\?/.test(body)) { await DAY.doc('_falcon').set({ at: Date.now(), recv: d.createTime ? d.createTime.toMillis() : Date.now(), n: 0, nDt: 0, nKm: 0, reads: 0, km: {}, why: 'menu nahi (☰ nahi mila)', raw: body.slice(0, 3500) }); log('🛰 Falcon: macro ko ☰ menu nahi mila — _falcon.raw dekho'); continue; }
    const SP = fxSplit(body), P = fxParse(SP.list), reads = SP.list.split('~~').filter(q => q.trim()).length;
    const dets = SP.det.map(fxDetail).filter(Boolean);   // v1.2: Trip Detail (Start / End pata)
    const byDay = new Map(); let bad = 0;
    for (const t of P.trips) { if (t.day > today || t.day < minDay) { bad++; continue; } if (!byDay.has(t.day)) byDay.set(t.day, []); byDay.get(t.day).push(t); }
    const kmOut = {};
    for (const [day, L] of byDay) {
      const ref = DAY.doc(day), cur = await ref.get(), old = cur.exists ? cur.data() || {} : {};
      const ft = fxMerge(old.ft, L), fk = Math.round(ft.reduce((s, q) => s + (Number(q[1]) || 0), 0) * 100) / 100;
      const myDet = dets.filter(q => ft.some(z => z[0] === q.t));   // is din ke trips ke detail (waqt se)
      let fd = null; if (myDet.length || old.fd) { try { fd = await fxDetails(old.fd, myDet); } catch (e) { log('⚠️ geocode', e.message || e); } }
      const upd = { date: day, fk, fn: ft.length, ft: JSON.stringify(ft), fa: Date.now() }; if (fd) upd.fd = JSON.stringify(fd);
      await ref.set(upd, { merge: true });
      kmOut[day] = fk;
      log(`🛰 ${day}: Falcon ${fk} km · ${ft.length} trip (is dafa ${L.length})${fd ? ` · detail ${myDet.length}, nuqte ${fd.filter(q => q.p).length}/${fd.length}` : ''}`);
    }
    const why = P.trips.length ? (bad && !byDay.size ? 'purane din' : '') : !P.nDt && !P.nKm ? 'kuch nahi' : !P.nKm ? 'km nahi' : !P.nDt ? 'waqt nahi' : 'jori nahi';
    await DAY.doc('_falcon').set({ at: Date.now(), recv: d.createTime ? d.createTime.toMillis() : Date.now(), n: P.trips.length, nDt: P.nDt, nKm: P.nKm, reads, det: dets.length, km: kmOut, why, raw: body.slice(0, 3500) });
    if (!P.trips.length) log(`🛰 Falcon text aaya magar trip nahi (${why}) — ${body.length} harf`);
  }
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
  const touched = new Set(); let n = 0, last = null, real = 0; const fx = [];
  for (const d of snap.docs) {
    const x = d.data() || {}, recv = d.createTime ? d.createTime.toMillis() : Date.now();
    if (/^RABTA TEST/.test(String(x.p || ''))) continue;   // app ka 🔎 rabta test — sirf mitao
    if (/^FX[12]\|/.test(String(x.p || ''))) { fx.push(d); continue; }   // v1.1: 🛰 Falcon-i ka text (malik ka phone) · v1.2 FX2 = detail bhi
    real++;
    const pts = parse(x.p, recv); n += pts.length;
    for (const q of pts) { const day = dayOf(q[0]); (await loadDay(day)).push(q); touched.add(day); if (!last || q[0] > last[0]) last = q; }
  }
  for (const day of touched) {
    const raw = cache.get(day).sort((a, b) => a[0] - b[0]).filter((x, i, A) => !i || x[0] !== A[i - 1][0]); cache.set(day, raw);
    const S = summarize(raw);
    await KEEP.doc(day).set({ raw: JSON.stringify(raw), at: Date.now() });
    await PATH.doc(day).set({ j: JSON.stringify(S.path), at: Date.now() });
    await DAY.doc(day).set({ date: day, km: S.km, gapKm: S.gapKm, n: S.n, first: S.first, last: S.last, j: JSON.stringify({ stops: S.stops, gaps: S.gaps }), at: Date.now() }, { merge: true });   // v1.1: merge — 🛰 Falcon ke khane (fk/ft) na mitein
    log(`📍 ${day}: ${S.km} km · ${S.n} jagah · ${S.stops.length} ruke · ${S.gaps.length} chup${S.gapKm ? ` (${S.gapKm} km andaza)` : ''}`);
  }
  let fxFail = false; if (fx.length) { try { await falconTick(fx); } catch (e) { fxFail = true; log('⚠️ Falcon', e.message || e); } }   // ghalti = Falcon ka text agle chakkar dobara
  if (last) await DAY.doc('_live').set({ t: last[0], lat: last[1], lon: last[2], recv: Date.now(), n }, { merge: true });
  else if (real) await DAY.doc('_live').set({ recv: Date.now(), bad: String(snap.docs[snap.docs.length - 1].data()?.p || '').slice(0, 160) }, { merge: true });   // list aayi magar jagah nahi — app setup mein dikhaye
  const b = db.batch(); snap.docs.forEach(d => { if (!(fxFail && fx.includes(d))) b.delete(d.ref); }); await b.commit();
  for (const k of [...cache.keys()]) if (k < dayOf(Date.now() - 3 * 86400000)) cache.delete(k);
}
let busy = false;
async function loop() { if (busy) return; busy = true; try { await tick(); } catch (e) { log('⚠️', e.message || e); } finally { busy = false; } }
if (require.main === module) log('📍 gaari-gps v1.2 shuru — har 2 min gaari ke phone ki jagah → din ke km · 🛰 Falcon-i trips → din ke Falcon km');
if (require.main === module) { loop(); setInterval(ZINDA.guard(loop, 5 * 60000, 'gaari-gps'), EVERY); }
module.exports = { parse, summarize, dayOf, fxParse, fxMerge, fxSplit, fxDetail, geoParts, fxDetails };
